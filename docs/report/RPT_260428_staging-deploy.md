---
document_id: RPT-260428-A
version: 1.0.0
status: Final
created: 2026-04-28
author: Gray Kim <gray.kim@amoeba.group>
---

# [RPT-260428-A] 스테이징 서버 배포 정보 정리

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260428-A |
| **제목** | A-idol Staging Deployment — Infra · Pipeline · Issue Log |
| **작성일** | 2026-04-28 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 운영 보고 / 인계 (Ops Handover) |
| **트리거** | 2026-04-27 야간 amoeba 사내 VPS 신규 셋업 + 첫 배포 완료 |
| **대상 환경** | `https://a-idol-stg.amoeba.site` |
| **관련 WBS** | T-008 (Environments), T-085 (Store Submission), T-081 (Load Test 후속) |

---

## 1. Executive Summary

A-idol staging 환경을 amoeba 사내 다중 테넌트 VPS (`125.133.49.165`) 에 **shared-host 패턴**으로 신규 구축. 호스트의 system nginx + wildcard `*.amoeba.site` cert 를 재활용하여 backend 컨테이너만 `127.0.0.1:3001` 로 노출. 배포는 `deploy/staging/deploy-shared.sh` 한 스크립트로 rsync → docker compose build → prisma migrate deploy → health polling 까지 자동 처리.

- **상태**: Live, healthy (backend / postgres / redis 컨테이너 3개 모두 healthy)
- **공개 URL**: `https://a-idol-stg.amoeba.site/healthz` → 200 (`ok`), `/docs` → Swagger UI, `/` → CMS SPA
- **DB**: 20/20 migrations applied, 시드 미적용 (admin/idol)
- **배포 빈도**: 수동 (스크립트 실행), CI 자동 배포 미연동

배포 도중 docker context · pnpm hoisting · prisma 엔진 호환 · bcrypt native binding · alpine libssl 등 **8건의 빌드/런타임 이슈**를 해결. 본 리포트가 그 결과를 운영 가이드 형태로 정리한다.

---

## 2. 환경 토폴로지

```
                     amoeba.site DNS
                            │
                            ▼
            ┌───────────────────────────────┐
            │  VPS 125.133.49.165 (Ubuntu   │
            │  24.04, host nginx 1.24, *.amoeba.site cert)
            │                               │
            │   :443 ──┬─ tpi.amoeba.site → 127.0.0.1:3000 (tac-frontend)
            │         ├─ a-idol-stg.amoeba.site
            │         │     ├─ /            → /var/www/a-idol-cms (SPA)
            │         │     ├─ /api/        → 127.0.0.1:3001
            │         │     ├─ /docs        → 127.0.0.1:3001
            │         │     └─ /metrics     → 403 (deny)
            │         │
            │   docker network: a-idol-stg_default
            │     ├─ a-idol-stg-backend  (127.0.0.1:3001 published)
            │     ├─ a-idol-stg-postgres (internal :5432)
            │     └─ a-idol-stg-redis    (internal :6379)
            │
            │   동거 컨테이너 (별도 프로젝트 — 영향 없음):
            │     tac-{frontend, backend, mysql, redis}
            └───────────────────────────────┘
```

- **격리**: 각 프로젝트 docker compose 가 자체 network 를 가짐. `a-idol-stg-redis` 와 `tac-redis` 가 호스트 6379 충돌 없도록 `tac-redis` 는 `127.0.0.1:6379` 로, `a-idol-stg-redis` 는 expose 만 사용 (외부 published 포트 없음).
- **TLS**: 호스트 system nginx 가 `/etc/letsencrypt/live/amoeba.site/{fullchain,privkey}.pem` (wildcard, DNS-01) 사용. A-idol 는 별도 certbot 미사용.

---

## 3. 인프라 스펙

| 계층 | 구성요소 | 버전 |
|---|---|---|
| Host OS | Ubuntu | 24.04 |
| Reverse proxy | nginx | 1.24.0 (system) |
| Container runtime | Docker | 29.4.1 |
| App image base | `node:20-alpine` | (multi-stage Dockerfile) |
| Database | PostgreSQL | 16.13 (alpine) |
| Cache | Redis | 7.4.8 (alpine) |
| ORM | Prisma | 5.22.0 |
| Node.js (in image) | 20.x | LTS |
| pnpm | 9.12.0 | (corepack pinned) |

### 3.1 호스트 정보 (`env-info.md` 참조 — 이 리포트엔 패스워드 미포함)

| 항목 | 값 |
|---|---|
| 호스트명 (DNS) | `a-idol-stg.amoeba.site` |
| 공인 IP | `125.133.49.165` |
| SSH 사용자 | `aidol` (key 인증), 초기 세팅용 `root`/`amb` 별도 |
| SSH key (local) | `~/.ssh/id_ed25519_amb_staging` |
| SSH alias | `a-idol-stg` (`~/.ssh/config`) |
| 작업 디렉토리 | `/srv/a-idol/{releases,backups,current}` (aidol 소유) |
| CMS webroot | `/var/www/a-idol-cms` (host nginx 직접 서빙) |

### 3.2 컨테이너 (현재 가동)

```
NAME                   IMAGE                       STATUS
a-idol-stg-backend     a-idol-stg-backend:latest   Up 15 hours (healthy)
a-idol-stg-postgres    postgres:16-alpine          Up 16 hours (healthy)
a-idol-stg-redis       redis:7-alpine              Up 16 hours (healthy)
```

- backend: `127.0.0.1:3001 → 3000`
- postgres: internal-only (`expose: 5432`)
- redis: internal-only

---

## 4. 배포 산출물 (코드)

| 경로 | 역할 |
|---|---|
| [`deploy/staging/docker-compose.shared-host.yml`](../../deploy/staging/docker-compose.shared-host.yml) | shared-host 변형 compose. backend 만 `127.0.0.1:3001` 노출, postgres/redis 내부 전용. tini PID1, healthcheck 표준화. |
| [`deploy/staging/nginx-system/a-idol-stg.amoeba.site.conf`](../../deploy/staging/nginx-system/a-idol-stg.amoeba.site.conf) | 호스트 system nginx 사이트 설정. wildcard cert 재사용, `/api/` + `/docs` proxy, SPA fallback (`try_files $uri /index.html`), `/metrics` deny. |
| [`deploy/staging/deploy-shared.sh`](../../deploy/staging/deploy-shared.sh) | 한 방향 배포 스크립트. release-stamped rsync + CMS dist sync + compose up + migrate deploy + 60s health polling. `--no-cms-build`, `--skip-migrate` 플래그 지원. |
| [`deploy/staging/.env.staging`](../../deploy/staging/.env.staging) | (gitignore) DB 패스워드 / JWT 시크릿 / CORS · HIBP · bcrypt 설정. `openssl rand -hex 32` 로 생성. |
| [`packages/backend/Dockerfile`](../../packages/backend/Dockerfile) | multi-stage (deps → build → runtime). 이번 셋업 과정에서 .npmrc 포함, openssl/prisma CLI 설치, bcrypt prebuild 카피, USER node 일시 제거 (§ 6.7) 등 8건 수정. |
| [`packages/backend/prisma/schema.prisma`](../../packages/backend/prisma/schema.prisma) | `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` 추가 (alpine 3.20+ libssl 3.x 호환). |
| [`.dockerignore`](../../.dockerignore) | `node_modules` + `**/*.tsbuildinfo` + `packages/*/src/**/*.{js,d.ts}` 잔존물 제외 (§ 6.1). |

---

## 5. 빌드 / 배포 파이프라인

### 5.1 단일 명령으로 배포

```bash
# 옵션 없음 = 전체 (CMS 빌드 + rsync + compose build + migrate + health)
./deploy/staging/deploy-shared.sh

# CMS 변경 없으면 빌드 스킵 (~30초 단축)
./deploy/staging/deploy-shared.sh --no-cms-build

# 마이그레이션 없는 hot-fix
./deploy/staging/deploy-shared.sh --skip-migrate
```

### 5.2 단계 순서

1. **로컬**
   - `pnpm --filter @a-idol/shared build` (호스트 사전 빌드)
   - `pnpm --filter @a-idol/cms build` (CMS dist 생성, `--no-cms-build` 시 skip)
   - `git rev-parse --short HEAD` 로 release tag 추출 → `GIT_SHA` 환경변수
2. **rsync (코드)**
   - `--exclude node_modules dist .git coverage` 등
   - `packages/mobile/` 포함 (Dockerfile 의 workspace package.json 으로 필요)
   - 대상: `aidol@a-idol-stg:/srv/a-idol/releases/<RELEASE_TS>`
3. **rsync (CMS dist)**
   - `packages/cms/dist/` → `/var/www/a-idol-cms/`
4. **scp `.env.staging`**
   - 로컬 `deploy/staging/.env.staging` → 원격 `/srv/a-idol/releases/<RELEASE_TS>/.env`
5. **원격 docker compose**
   - `docker compose -f docker-compose.shared-host.yml --env-file .env up -d --build`
6. **prisma migrate deploy**
   - `docker compose exec -T backend pnpm --filter @a-idol/backend prisma:deploy`
7. **health polling**
   - 60s 동안 `curl http://127.0.0.1:3001/healthz` 200 대기

### 5.3 release pointer 패턴 (옵션)

현재 `current` 심링크는 사용 안 함. 향후 무중단 배포 시 `/srv/a-idol/current → releases/<RELEASE_TS>` 로 atomic 갱신.

---

## 6. 발생 이슈 & 해결 (8건)

### 6.1 BuildKit COPY 가 `socket.io` 디렉토리에서 멈춤

```
ERROR: cannot copy to non-directory: .../packages/backend/node_modules/socket.io
```

- **원인**: 레포 root 에 `.dockerignore` 가 없어 호스트 `node_modules` (pnpm 심링크) 가 빌드 컨텍스트에 포함됨. BuildKit overlayfs 가 심링크 → 디렉토리 변환을 처리 못함.
- **해결**: `.dockerignore` 추가 (`node_modules/`, `**/node_modules/`, `dist/`, `**/*.tsbuildinfo`, `packages/*/src/**/*.{js,d.ts,*.map}` 등).

### 6.2 transitive dep `ioredis` resolve 실패

```
TS2307: Cannot find module 'ioredis' or its corresponding type declarations.
```

- **원인**: 프로젝트 root `.npmrc` 에 `node-linker=hoisted` (RN/Expo 호환용) 가 있는데 Dockerfile 이 이를 COPY 안 해서 docker 의 pnpm 이 isolated 레이아웃 사용 → transitive dep 가 root `node_modules/` 로 hoist 안 됨.
- **해결**: Dockerfile deps + runtime 단계 모두 `.npmrc` 명시 COPY.

### 6.3 shared package 의 `index.d.ts` 빈 emit

- **원인**: `packages/shared/src/` 에 과거 build 산출물 (`*.js`, `*.d.ts`) 36개가 잔존. `composite: true` 모드의 tsc 가 src 의 .d.ts 를 "이미 emit 된 것" 으로 간주해 dist emit 을 스킵.
- **해결**: 호스트에서 산출물 일괄 삭제 + .dockerignore 에 `packages/*/src/**/*.{js,d.ts,*.map}` 패턴 + `**/*.tsbuildinfo` 제외 추가.

### 6.4 bcrypt native binding 누락

```
Error: Cannot find module '/app/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node'
```

- **원인**: runtime 단계가 `pnpm install --prod --ignore-scripts` 로 postinstall 차단 → bcrypt 의 prebuild 다운로드 안 됨.
- **해결**: build 단계가 이미 prebuild 받아두므로 `COPY --from=build /repo/node_modules/bcrypt/lib/binding ...` 으로 이전.

### 6.5 prisma 엔진 libssl 1.1 의존

```
Error loading shared library libssl.so.1.1: No such file or directory
```

- **원인**: alpine 3.20+ 가 OpenSSL 3.x 만 보유. Prisma 가 빌드 시 openssl 감지 실패 → default `linux-musl` (libssl 1.1) 엔진 다운로드.
- **해결**: schema.prisma 의 generator block 에 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` 추가 + runtime 단계에 `apk add openssl` (런타임 감지 보강).

### 6.6 prisma CLI 부재 (runtime `--prod`)

```
Command "prisma" not found
```

- **원인**: prisma CLI 는 devDependency 라 `pnpm install --prod` 시 누락 → `prisma migrate deploy` 실행 불가.
- **해결**: runtime 단계에 `npm install -g prisma@5.22.0` (client 와 동일 버전, 엔진 호환 보장).

### 6.7 `chown -R node:node /app` 무한 진행

- **원인**: USER node 전환 직전 전 트리 chown 시도 — node_modules 수만 개 파일 때문에 매우 느림. Prisma 가 일부 임시 파일을 쓰려 할 때 권한 차단도 별도 이슈.
- **해결 (잠정)**: USER node 단계 제거, runtime 을 root 로 실행. staging 은 host nginx → `127.0.0.1:3001` internal-only 노출이라 외부 위험 노출 없음. **프로덕션 전 `COPY --chown=node:node` 패턴으로 재정비 필요** (§ 9.1).

### 6.8 lockfile drift (`ERR_PNPM_OUTDATED_LOCKFILE`)

- **원인**: 이전 commit 에서 `cms/package.json` 의 react 버전 revert 가 있었으나 `pnpm-lock.yaml` 업데이트 누락.
- **해결**: `pnpm install --no-frozen-lockfile` 로 동기화 후 lock 갱신 commit.

---

## 7. 검증 결과 (2026-04-28 09:27 KST)

| 검사 | 명령 / 경로 | 결과 |
|---|---|---|
| TLS + nginx | `curl -sI https://a-idol-stg.amoeba.site/healthz` | `HTTP/2 200`, `server: nginx/1.24.0 (Ubuntu)` |
| Backend health | `/healthz` | `200 OK` body `ok` |
| Swagger | `/docs` | `200 OK` (HTML) |
| CMS SPA index | `/` | `200 OK` (`<!doctype html>` 응답) |
| CMS SPA fallback | `/login`, `/project`, `/idols` | `200 OK` (모두 index.html) |
| API DTO 검증 | `POST /api/v1/auth/signup` (잘못된 body) | `400 Bad Request` (snake_case 필드 enforcement 정상) |
| Admin login 입력 검증 | `POST /api/v1/admin/auth/login` (단순 입력) | `400 Bad Request` (length rule) |
| DB migrations | `_prisma_migrations` count where finished | **20 / 20 applied** |
| 컨테이너 healthcheck | `docker ps` | 3 / 3 healthy |

---

## 8. 운영 명령 cheat sheet

### 8.1 재배포

```bash
# 일반 (코드 변경)
./deploy/staging/deploy-shared.sh

# Dockerfile 변경 없을 때 캐시 활용 빠른 재시작 (원격 SSH)
ssh a-idol-stg 'cd /srv/a-idol/releases/<RELEASE_TS> && docker compose -f docker-compose.shared-host.yml restart backend'
```

### 8.2 로그

```bash
ssh a-idol-stg 'docker logs -f a-idol-stg-backend'
ssh a-idol-stg 'docker logs --tail 100 a-idol-stg-postgres'
```

### 8.3 DB 진입 / 시드

```bash
# 어드미너 / SQL 콘솔
ssh a-idol-stg 'docker exec -it a-idol-stg-postgres psql -U aidol aidol'

# 시드 (백엔드 컨테이너에서)
ssh a-idol-stg 'docker exec a-idol-stg-backend pnpm --filter @a-idol/backend seed'
```

### 8.4 마이그레이션 단독 실행

```bash
ssh a-idol-stg 'docker exec a-idol-stg-backend pnpm --filter @a-idol/backend prisma:deploy'
```

### 8.5 롤백 (컨테이너 단)

```bash
# 이전 release 디렉토리로 SSH 후 compose up 재실행
ssh a-idol-stg 'ls /srv/a-idol/releases | tail -3'   # 최근 3 release
ssh a-idol-stg 'cd /srv/a-idol/releases/<PREV_RELEASE> && docker compose -f docker-compose.shared-host.yml up -d --build'
```

> ⚠️ DB 마이그레이션 롤백은 별도 — schema 변경 reverse migration 필요. 단순 코드 롤백은 가능.

### 8.6 nginx 변경 (호스트)

```bash
ssh a-idol-stg 'sudo nginx -t && sudo systemctl reload nginx'
```

### 8.7 환경변수 (.env.staging) 갱신

- 로컬 `deploy/staging/.env.staging` 수정 후 `./deploy-shared.sh` 재실행 (스크립트가 scp 갱신)
- 또는 원격 `/srv/a-idol/releases/<RELEASE_TS>/.env` 직접 수정 후 `docker compose ... up -d`

---

## 9. 잔존 이슈 / Known Limitations

### 9.1 USER node 복원 (보안)

- **현황**: runtime 단계에서 root 로 실행 중. staging 은 internal-only 노출이라 위험은 낮음.
- **할 일**: 모든 `COPY` 에 `--chown=node:node` 추가 + `USER node` 복원 + `prisma migrate deploy` 가 임시 쓰기 시도하는 경로 (`/tmp` 또는 `/app/.prisma`) 미리 chown.
- **목표 시점**: 프로덕션 환경 셋업 전.

### 9.2 시드 미적용

- DB 는 비어있음. admin user 생성 안 되어 있어 CMS 로그인 불가.
- **할 일**: `seed` 스크립트의 staging 모드 확인 후 1회 실행 (§ 8.3).

### 9.3 CI 자동 배포 미연동

- 현재 배포는 수동. GitHub Actions 의 lint-test job 만 동작.
- **할 일**: `develop` / `staging` 브랜치 push → 자동 deploy job 추가 (선택).

### 9.4 Sentry DSN 미주입

- backend / cms / mobile 3개 SDK 모두 graceful no-op 상태 (T-080 95%). DSN 발급 후 `.env.staging` 에 주입 필요.

### 9.5 backup 미설정

- `/srv/a-idol/backups/` 디렉토리만 존재. cron 또는 별도 스크립트로 `pg_dump` 백업 일정 필요. 데이터가 stub 단계라 우선순위는 낮음.

### 9.6 모니터링 미연결

- Prometheus `/metrics` 는 nginx 에서 deny 처리됨 (외부 노출 차단). Datadog agent 또는 host 단 prometheus scraper 가 `127.0.0.1:3001/metrics` 를 읽도록 추후 연결 필요.

---

## 10. 참조

| 항목 | 위치 |
|---|---|
| 프로젝트 instructions | [`CLAUDE.md`](../../CLAUDE.md) |
| 환경 자격증명 (gitignore) | `env-info.md` (repo root) |
| 옛 운영 가이드 | [`docs/ops/staging-deploy-vps-ko.md`](../ops/staging-deploy-vps-ko.md) (단독 VPS 시나리오 — 이번 셋업과는 다름, 참고용) |
| Runbook | [`docs/ops/runbook-ko.md`](../ops/runbook-ko.md) |
| WBS | [`docs/implementation/a-idol-wbs.md`](../implementation/a-idol-wbs.md) — T-008 / T-085 |
| 배포 산출물 | [`deploy/staging/`](../../deploy/staging/) |

---

## 11. 다음 단계 권장

1. **시드 1회** (§ 9.2) — admin user + idol 99 + 1 agency
2. **smoke 시나리오** — admin login → idol CRUD → mobile signup → audition vote (chat WS 포함)
3. **USER node 복원** + `COPY --chown` 정비 (§ 9.1)
4. **Sentry DSN 주입** (T-080 잔여 5%)
5. **GitHub Actions 자동 배포** 검토 (§ 9.3) — 현재 transfer 직후라 CI secret 점검 시점에 함께
6. **OWASP ASVS L2 audit 미팅** (T-082 잔여 3%) — staging 환경에서 라이브로 점검 가능
7. **k6 load test 본 측정** (T-081 50% → 100%) — staging 인프라 확보 완료, 측정 가능
