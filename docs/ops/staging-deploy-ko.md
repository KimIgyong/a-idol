# A-idol Staging — 배포 가이드 (총괄)

> 본 문서는 staging 배포의 **단일 진입점(index)** 입니다. 실제 작업은 변형(variant)
> 별로 분기된 상세 가이드를 참고하되, 어떤 변형을 쓸지 / 첫 1회 vs 일상 재배포
> 흐름 / 운영 체크리스트는 본 문서에서 일괄 안내합니다.
>
> Owner: Gray Kim · Last updated: 2026-05-02

---

## 1. 변형(variant) 선택

A-idol staging 은 **두 가지 토폴로지**를 지원합니다. 환경에 맞춰 한 가지를 선택.

| | **Standalone (단독 VPS)** | **Shared-host (사내 공용 VPS)** ✅ 현행 |
|---|---|---|
| 대상 | A-idol 전용 호스트 (VPS·EC2 등) | 다른 서비스(`tpi.amoeba.site` 등)와 박스 공유 |
| nginx | **컨테이너 nginx** (`a-idol-stg-nginx`) | **호스트 nginx** (`/etc/nginx/`) |
| TLS | Let's Encrypt + `certbot` 컨테이너 (12h renew) | 호스트의 `*.amoeba.site` wildcard cert 재사용 |
| 80/443 | 컨테이너가 직접 점유 | 호스트 nginx 가 점유, backend 는 `127.0.0.1:3001` |
| CMS dist 위치 | `packages/cms/dist` 마운트 | `/var/www/a-idol-cms` 로 rsync |
| Compose 파일 | [`docker-compose.staging.yml`](../../deploy/staging/docker-compose.staging.yml) | [`docker-compose.shared-host.yml`](../../deploy/staging/docker-compose.shared-host.yml) |
| 배포 스크립트 | [`deploy.sh`](../../deploy/staging/deploy.sh) | [`deploy-shared.sh`](../../deploy/staging/deploy-shared.sh) |
| 상세 가이드 | [`staging-deploy-vps-ko.md`](./staging-deploy-vps-ko.md) | §4 (본 문서) |

> **현재 운영(2026-05-02 기준): Shared-host 변형.** `a-idol-stg.amoeba.site` 호스트가
> `tpi.amoeba.site` 와 wildcard cert + nginx 를 공유 중. AWS 이전 시 standalone 으로
> 전환 검토 — 결정 트리거는 [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md).

---

## 2. 공통 사전 준비

두 변형 모두 동일하게 적용됩니다.

### 2.1 로컬 (배포 머신)

- macOS / Linux + zsh/bash
- `pnpm` 9+ (워크스페이스 빌드)
- `rsync`, `ssh`, `scp`, `openssl`
- 워크스페이스 루트 클론 + `pnpm install` 1회

### 2.2 서버

- Ubuntu 22 / 24 LTS 권장
- Docker Engine 24+ + `docker compose` plugin
- 사용자 `aidol` (sudo + `docker` 그룹)
- 디렉토리: `/srv/a-idol/{releases,backups}` 가 `aidol:aidol` 소유

```bash
# 서버 1회 셋업
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker aidol      # 재로그인 필요
sudo mkdir -p /srv/a-idol/{releases,backups} && sudo chown -R aidol:aidol /srv/a-idol
```

### 2.3 SSH key 등록 (필수)

```bash
# 로컬
ssh-copy-id aidol@a-idol-stg.amoeba.site
# 서버 (옵션) — 패스워드 인증 비활성화
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

> Shared-host 변형은 `~/.ssh/config` 에 `Host a-idol-stg` alias 등록 권장
> (`deploy-shared.sh` 의 `SSH_HOST` 기본값).

### 2.4 DNS

`a-idol-stg.amoeba.site` → 서버 IP 가 정상 resolve. `dig +short a-idol-stg.amoeba.site` 로 검증.

### 2.5 시크릿 (.env.staging)

```bash
cd <repo-root>
cp deploy/staging/.env.staging.example deploy/staging/.env.staging

# 강력 시크릿 생성 (출력값을 .env.staging 에 붙여넣기)
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 28)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

vim deploy/staging/.env.staging
```

채워야 하는 항목 (필수):

| 항목 | 비고 |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose 내부 통신 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 서로 다른 64-byte 랜덤 |
| `CORS_ORIGINS` | `https://a-idol-stg.amoeba.site` |
| `BCRYPT_ROUNDS` | 12 (prod 동일) |
| `THROTTLE_LIMIT_PER_MINUTE` | 200 (k6 측정 시 100000 일시 상향) |
| `HIBP_CHECK_ENABLED` | 1 |
| `SENTRY_DSN`(옵션) | 비우면 graceful no-op |
| `KAKAO_CLIENT_ID` / `APPLE_CLIENT_ID` / `GOOGLE_CLIENT_ID`(옵션) | OAuth sandbox |

> `.env.staging` 은 `.gitignore` 등록. 백업은 [`env-info.md`](../../env-info.md) (gitignore) 또는 사내 secret store.

---

## 3. 변형 A — Standalone (단독 VPS)

상세 절차는 [`staging-deploy-vps-ko.md`](./staging-deploy-vps-ko.md) 참고. 핵심만 요약:

```bash
# 첫 배포
./deploy/staging/deploy.sh
# 서버에서 TLS 1회 발급
ssh aidol@a-idol-stg.amoeba.site
cd /srv/a-idol/current/deploy/staging && ./init-tls.sh

# 일상 재배포
./deploy/staging/deploy.sh                 # 코드 변경
./deploy/staging/deploy.sh --no-cms-build  # CMS 빌드 skip
./deploy/staging/deploy.sh --skip-migrate  # Prisma migrate skip
```

`deploy.sh` 가 자동으로 처리하는 단계는 [`staging-deploy-vps-ko.md` §3](./staging-deploy-vps-ko.md) §3 참조.

---

## 4. 변형 B — Shared-host (사내 공용 VPS) ✅ 현행

호스트 박스가 이미 system-level nginx 1.24 + Let's Encrypt `*.amoeba.site` wildcard
cert 를 운영 중. A-idol 은 **backend 만** docker compose 로 띄우고 `127.0.0.1:3001`
으로 노출, 호스트 nginx 가 reverse proxy.

### 4.1 호스트 nginx 설정 (1회)

`a-idol-stg.amoeba.site` server block 을 호스트 nginx 에 등록.

```bash
# 서버에서
sudo cp /srv/a-idol/current/deploy/staging/nginx-system/a-idol-stg.amoeba.site.conf \
        /etc/nginx/sites-available/

sudo ln -s /etc/nginx/sites-available/a-idol-stg.amoeba.site.conf \
           /etc/nginx/sites-enabled/

# 정적 SPA dist 위치 + ACME webroot
sudo mkdir -p /var/www/a-idol-cms /var/www/certbot
sudo chown -R www-data:www-data /var/www/a-idol-cms /var/www/certbot

sudo nginx -t && sudo systemctl reload nginx
```

> Wildcard cert (`/etc/letsencrypt/live/amoeba.site/`) 는 **이미 다른 서비스가 발급/갱신** 중이라 본
> 가이드에서 cert 발급은 다루지 않음. 신규 호스트면 standalone 변형의 `init-tls.sh` 흐름을 참고하거나
> 호스트 운영자에게 cert 공유 권한 요청.

### 4.2 첫 배포

로컬에서:

```bash
./deploy/staging/deploy-shared.sh
```

스크립트가 자동으로 수행:

1. `pnpm --filter @a-idol/shared build` (shared dist)
2. `VITE_GIT_SHA=<sha> pnpm --filter @a-idol/cms build` (Vite production, Sentry release tagging)
3. rsync 로 monorepo 송신 (node_modules / dist / .env / .git 제외 — `mobile` 은 lockfile 정합성 위해 포함)
4. CMS dist → `/var/www/a-idol-cms` rsync (호스트 nginx 가 정적 서빙)
5. `.env.staging` scp → release 디렉토리 안
6. `docker compose -f docker-compose.shared-host.yml up -d --build` (postgres + redis + backend)
7. `prisma migrate deploy` (idempotent)
8. `/health` 60s polling (`db: up + redis: up`)
9. `/srv/a-idol/current` symlink atomic 갱신
10. 7개 release 만 보존, 이전 정리

### 4.3 헬스체크

```bash
# 호스트 nginx 통과 확인
curl -fsS https://a-idol-stg.amoeba.site/healthz                  # → ok
curl -fsS https://a-idol-stg.amoeba.site/api/health | jq          # → {"status":"ok",...}
curl -fsSI https://a-idol-stg.amoeba.site/                        # → 200 (CMS SPA index)
curl -fsSI https://a-idol-stg.amoeba.site/docs                    # → 200 (Swagger)
```

### 4.4 일상 재배포

```bash
./deploy/staging/deploy-shared.sh                  # 풀 빌드 + 재배포
./deploy/staging/deploy-shared.sh --no-cms-build   # 백엔드만 변경
./deploy/staging/deploy-shared.sh --skip-migrate   # schema 변경 없음
```

### 4.5 Seed (선택)

```bash
ssh a-idol-stg
cd /srv/a-idol/current
docker compose -f deploy/staging/docker-compose.shared-host.yml \
  --env-file deploy/staging/.env.staging -p a-idol-stg \
  exec -T backend pnpm --filter @a-idol/backend run seed
```

> seed 는 idempotent (`stableUuidFor`). 운영 데이터 들어간 다음에는 호출 자제.

---

## 5. 운영 체크리스트 (변형 공통)

### 5.1 로그

```bash
ssh a-idol-stg
docker compose -p a-idol-stg logs -f --tail 200 backend
sudo journalctl -u nginx -f          # shared-host 변형 (호스트 nginx)
docker compose -p a-idol-stg logs -f nginx   # standalone 변형
```

### 5.2 컨테이너 상태

```bash
docker compose -p a-idol-stg ps
docker stats $(docker ps --filter "name=a-idol-stg" -q)
```

### 5.3 DB 백업 (cron 권장)

```bash
# 서버 cron — 매일 03:00 KST
0 3 * * * docker exec a-idol-stg-postgres pg_dump -U aidol -Fc aidol \
  > /srv/a-idol/backups/aidol-$(date +\%F).dump \
  && find /srv/a-idol/backups -name 'aidol-*.dump' -mtime +14 -delete
```

복원:

```bash
docker exec -i a-idol-stg-postgres pg_restore -U aidol -d aidol -c < backup.dump
```

### 5.4 롤백

```bash
ssh a-idol-stg
ls -1dt /srv/a-idol/releases | head -5     # 직전 release 확인
PREV=$(ls -1dt /srv/a-idol/releases | sed -n 2p)
ln -sfn "$PREV" /srv/a-idol/current
cd /srv/a-idol/current
# 변형에 맞는 compose 파일 사용
docker compose -f deploy/staging/docker-compose.shared-host.yml \
  --env-file deploy/staging/.env.staging -p a-idol-stg up -d
```

> Prisma 마이그레이션은 forward-only. 롤백 시 schema drift 가능 — 마이그레이션 동반된 release
> 직후엔 코드만 롤백하지 말고, schema down migration 도 함께 검토. 중대 사고 시 §5.3 백업 기반 복원.

### 5.5 Throttle 일시 상향 (k6 측정 등)

```bash
ssh a-idol-stg
sed -i 's/^THROTTLE_LIMIT_PER_MINUTE=.*/THROTTLE_LIMIT_PER_MINUTE=100000/' \
  /srv/a-idol/current/deploy/staging/.env.staging
docker compose -p a-idol-stg up -d backend     # env reload
# 측정 후 200 으로 복귀 + 재시작
```

자세한 부하 시나리오: [`k6-staging-runbook-ko.md`](./k6-staging-runbook-ko.md).

---

## 6. 보안 점검 (1차 배포 직후 + 분기별)

| 항목 | 확인 방법 | Pass 기준 |
|---|---|---|
| HTTP→HTTPS 강제 | `curl -sI http://a-idol-stg.amoeba.site` | 301 → https |
| HSTS | `curl -sI https://a-idol-stg.amoeba.site \| grep -i strict-transport` | `max-age` 헤더 존재 |
| CSP | response header `Content-Security-Policy` | `default-src 'self'` 포함 |
| `/metrics` 차단 | `curl -sI https://.../metrics` | 404 (allowlist 외) |
| Swagger | `curl -sI https://.../docs` | 200 (staging 한정 — prod 차단) |
| dev secret 분리 | login response token 디코드 | secret hash 가 dev 와 다름 |
| 로그 PII redact | `docker logs backend \| grep -i 'authorization:'` | 0 hits |
| Throttle 복귀 | `.env.staging` 의 `THROTTLE_LIMIT_PER_MINUTE` | 200 (측정 직후 확인) |

---

## 7. 옵저버빌리티 (T-080)

### 7.1 Sentry

`SENTRY_DSN` 채우면 즉시 활성화. release tagging 은 `deploy*.sh` 가
`git rev-parse --short HEAD` 로 자동 주입 (`GIT_SHA` env / `VITE_GIT_SHA` build env).

상세: [`staging-deploy-vps-ko.md` §6](./staging-deploy-vps-ko.md) §6.

### 7.2 Prometheus + Alert Rules

`/metrics` (Prometheus exposition) — backend 컨테이너 3000 포트 자체 노출.

- standalone: 컨테이너 nginx `location /metrics` 의 `allow` 라인에 Prometheus IP 추가
- shared-host: 호스트 nginx server block 에 동일 처리 (현재 `deny all` → 404)

규칙 + 알림은 [`deploy/staging/prometheus/`](../../deploy/staging/prometheus/) 의 3개 파일:
- [`prometheus.yml`](../../deploy/staging/prometheus/prometheus.yml) — scrape config
- [`staging-rules.yml`](../../deploy/staging/prometheus/staging-rules.yml) — 8건 alert (availability 2 + perf 3 + security 3)
- [`sentry-alerts.md`](../../deploy/staging/prometheus/sentry-alerts.md) — Sentry rule 매핑

상세: [`staging-deploy-vps-ko.md` §7](./staging-deploy-vps-ko.md) §7.

---

## 8. 트러블슈팅

| 증상 | 원인 후보 | 1차 조치 |
|---|---|---|
| `deploy*.sh` 가 `❌ deploy/staging/.env.staging 가 없습니다` | `.env.staging` 미생성 | §2.5 단계 수행 |
| backend health timeout (60s) | DB 연결 실패 / migration 실패 / env 누락 | `docker compose -p a-idol-stg logs --tail 80 backend` |
| 502 Bad Gateway (shared-host) | 호스트 nginx → `127.0.0.1:3001` 도달 불가 / backend 컨테이너 down | `docker ps` + `sudo nginx -t` + `curl http://127.0.0.1:3001/health` (서버에서) |
| TLS 인증서 만료 (standalone) | certbot 컨테이너 down | `docker compose -p a-idol-stg logs certbot` + `init-tls.sh` 재실행 |
| TLS 인증서 만료 (shared-host) | 호스트 wildcard cert 갱신 누락 | 호스트 운영자에게 문의 (다른 서비스도 영향) |
| 503 + log `redis ECONNREFUSED` | redis 컨테이너 down / restart 중 | `docker compose -p a-idol-stg restart redis` |
| `prisma migrate deploy` 실패 | drift / 권한 / 연결 | `docker compose -p a-idol-stg exec backend pnpm --filter @a-idol/backend prisma:status` |
| CMS 화면이 stale (구버전) | 브라우저 캐시 / `/var/www/a-idol-cms` rsync 실패 | hard refresh + `ssh a-idol-stg ls -la /var/www/a-idol-cms` |
| 디스크 부족 | release 7개 보존 정책 미동작 / log 누적 | `df -h` + `docker system prune -af --volumes` (volume 주의 — DB 제외) |

---

## 9. 관련 문서

- [`staging-deploy-vps-ko.md`](./staging-deploy-vps-ko.md) — Standalone 변형 상세 (TLS 발급, Sentry, Prometheus)
- [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) — 인프라 결정 (AWS 이전 트리거)
- [`k6-staging-runbook-ko.md`](./k6-staging-runbook-ko.md) — 부하 측정 절차
- [`runbook-ko.md`](./runbook-ko.md) — 운영 중 사건 / 변경 이력
- [`postmortems/`](./postmortems/) — 사고 사후 분석

---

## 10. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-02 | 신설 — 두 변형(standalone/shared-host) 한곳에서 비교, 시크릿/SSH/DNS 등 공통 사전 준비 통합, shared-host 변형 절차(호스트 nginx 등록 + `/var/www/a-idol-cms` 마운트 + `deploy-shared.sh` 흐름)를 정식 문서화. 기존 `staging-deploy-vps-ko.md` 는 standalone 상세본으로 유지. |
