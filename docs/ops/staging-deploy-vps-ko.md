# A-idol Staging — Single-VPS 배포 가이드

> 배경: [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) 의 AWS plan 은
> 6월 후반 ETA. **2026-04-27 PO 결정** — 1차 staging 은 amoeba 사내 VPS
> (`a-idol-stg.amoeba.site` / `125.133.49.165`) 1대로 시작. AWS 이전은 ARR / k6 50k
> 본 측정 결과에 따라 결정.
>
> Owner: Gray Kim · Last updated: 2026-04-27

---

## 1. 토폴로지 (현재)

```
┌──────────────────── a-idol-stg.amoeba.site (125.133.49.165) ────────────────────┐
│                                                                                 │
│   nginx (80/443, Let's Encrypt)                                                 │
│      │                                                                          │
│      ├─ /api/*  ──────────►  backend (NestJS, port 3000)                        │
│      │                          │                                               │
│      │                          ├─► postgres (16-alpine, internal)              │
│      │                          ├─► redis    (7-alpine,   internal)             │
│      │                          └─► backend_uploads volume                      │
│      │                                                                          │
│      ├─ /docs (Swagger)  ────►  backend                                         │
│      │                                                                          │
│      └─ /        (SPA)   ────►  /var/www/cms (Vite dist, mounted)               │
│                                                                                 │
│   certbot — 12h 마다 renew                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Compose project name**: `a-idol-stg`
- **Volumes**: `pg_data` · `redis_data` · `backend_uploads` · `certbot_etc` · `certbot_webroot`
- **외부 노출 포트**: 80, 443 (그 외 모두 internal docker network)

---

## 2. 사전 준비 (한 번만)

### 2.1 서버 OS 베이스

서버에 SSH 후:

```bash
# OS 정보
cat /etc/os-release

# 기본 도구 + Docker 설치 (Ubuntu 22+/24+)
sudo apt update && sudo apt install -y curl rsync ca-certificates gnupg ufw

# Docker (공식 Convenience script — staging 1회용으로 충분)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker aidol      # 재로그인 후 docker 그룹 적용

# 방화벽
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2.2 디렉토리 권한

```bash
sudo mkdir -p /srv/a-idol/releases
sudo chown -R aidol:aidol /srv/a-idol
```

### 2.3 SSH key 등록 (권장 — 패스워드 인증 비활성화)

로컬에서:

```bash
ssh-copy-id aidol@a-idol-stg.amoeba.site
# 이후 비밀번호 인증 사용 안 함
```

서버에서:

```bash
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

### 2.4 DNS

`a-idol-stg.amoeba.site` → `125.133.49.165` (확인 완료 — `dig +short`).

---

## 3. 첫 배포 — 5단계

### Step 1. 시크릿 채우기 (로컬)

```bash
cd /Users/gray/Documents/Claude/Projects/A-idol
cp deploy/staging/.env.staging.example deploy/staging/.env.staging

# 시크릿 생성 (편의 스크립트 — copy/paste)
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 28)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

# 위 출력을 .env.staging 의 해당 항목에 복붙 (편집 필수 — placeholder __GENERATE...)
vim deploy/staging/.env.staging
```

> `.env.staging` 은 `.gitignore` 에 등록되어 있어 commit 되지 않습니다. 백업은
> [`env-info.md`](../../env-info.md) (gitignore) 에 별도 저장.

### Step 2. 코드 ship

```bash
./deploy/staging/deploy.sh
```

스크립트가 자동으로 수행:

1. `pnpm --filter @a-idol/shared build` (shared dist)
2. `pnpm --filter @a-idol/cms build` (Vite production)
3. rsync 로 monorepo 송신 (node_modules / dist / mobile / .env 제외)
4. `.env.staging` scp
5. 서버에서 `docker compose up -d --build` (backend Docker multi-stage build)
6. `prisma migrate deploy` (idempotent)
7. `/health` 60s polling — `db: up + redis: up` 확인
8. `/srv/a-idol/current` symlink 갱신 (atomic release)

**주의**: 첫 배포는 nginx 가 아직 TLS 자산이 없어 `start_period` 안에 healthy
가 되지 않을 수 있음. → Step 3 으로 진행.

### Step 3. TLS 발급 (1회)

서버에서:

```bash
cd /srv/a-idol/current/deploy/staging
./init-tls.sh
```

스크립트 동작:

1. nginx server block 의 HTTPS 부분을 임시 제거 → HTTP-only 로 부팅
2. `certbot certonly --webroot` 로 Let's Encrypt 인증서 발급
3. HTTPS server block 복원 + `nginx -s reload`

이후 `certbot` 컨테이너가 12h 마다 `renew` 자동 실행.

### Step 4. 헬스체크

로컬에서:

```bash
curl -fsS https://a-idol-stg.amoeba.site/api/health | jq
# → {"status":"ok", "db":"up", "redis":"up", ...}

curl -fsS -o /dev/null -w "HTTP %{http_code}\n" https://a-idol-stg.amoeba.site/
# → HTTP 200 (CMS SPA index.html)

# Swagger
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://a-idol-stg.amoeba.site/docs
# → HTTP 200
```

### Step 5. 시드 (선택)

staging 을 데모 / k6 시드 데이터로 채우려면:

```bash
ssh aidol@a-idol-stg.amoeba.site
cd /srv/a-idol/current
docker compose -f deploy/staging/docker-compose.staging.yml --env-file deploy/staging/.env.staging \
  -p a-idol-stg exec -T backend pnpm --filter @a-idol/backend run seed
```

> seed 는 idempotent (`stableUuidFor` 기반). 운영 데이터가 들어간 다음에는 호출 자제.

---

## 4. 일상 운영

### 4.1 재배포 (코드 변경 후)

로컬에서:

```bash
git pull / 변경 작업
./deploy/staging/deploy.sh
```

`--no-cms-build` 또는 `--skip-migrate` 로 단계 skip 가능.

### 4.2 로그

```bash
ssh aidol@a-idol-stg.amoeba.site
docker compose -p a-idol-stg logs -f --tail 200 backend
docker compose -p a-idol-stg logs -f --tail 200 nginx
```

### 4.3 컨테이너 상태

```bash
docker compose -p a-idol-stg ps
docker stats $(docker ps --filter "name=a-idol-stg" -q)
```

### 4.4 DB 백업 (cron 권장)

```bash
# 서버 cron 에 등록 (매일 03:00 KST)
0 3 * * * docker exec a-idol-stg-postgres pg_dump -U aidol -Fc aidol > /srv/a-idol/backups/aidol-$(date +\%F).dump && find /srv/a-idol/backups -name 'aidol-*.dump' -mtime +14 -delete
```

복원:

```bash
docker exec -i a-idol-stg-postgres pg_restore -U aidol -d aidol -c < backup.dump
```

### 4.5 롤백

```bash
ssh aidol@a-idol-stg.amoeba.site
ls /srv/a-idol/releases   # 직전 release 확인
ln -sfn /srv/a-idol/releases/<PREV_TS> /srv/a-idol/current
cd /srv/a-idol/current
docker compose -f deploy/staging/docker-compose.staging.yml --env-file deploy/staging/.env.staging -p a-idol-stg up -d
```

> Prisma 마이그레이션은 forward-only — 롤백 시 schema 가 새 코드에 비해 앞서 있을 수 있음. drift 발생 시 별도 mitigation 필요.

---

## 5. 보안 점검 (1차 배포 직후)

| 항목 | 확인 방법 | Pass 기준 |
|---|---|---|
| TLS strong (A+) | `curl -sI https://a-idol-stg.amoeba.site \| grep -i strict-transport` | `max-age=31536000; includeSubDomains` |
| HTTP→HTTPS 강제 | `curl -sI http://a-idol-stg.amoeba.site` | 301 location: https://... |
| /metrics 차단 | `curl -sI https://.../metrics` | 404 |
| Swagger 노출 | `curl -sI https://.../docs` | 200 (staging only — prod 에서는 차단) |
| CSP 헤더 | response header `Content-Security-Policy` | `default-src 'self'` 포함 |
| 환경 분리 | login response | accessToken (dev secret 과 다름 — 새 random) |
| 로그 PII redact | `docker logs backend \| grep authorization` | 0 hits |

---

## 6. Sentry 활성화 (T-080 마지막 5%)

### 6.1 가입 + 프로젝트 생성

[`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) §2.1 권장: Developer plan (free, 5k errors/month).

[sentry.io](https://sentry.io) → 프로젝트 3개 생성:

| 이름 | Platform | DSN 변수 |
|---|---|---|
| a-idol-backend | Node.js | `SENTRY_DSN` (backend env) |
| a-idol-cms | React | `VITE_SENTRY_DSN` (CMS build env) |
| a-idol-mobile | React Native | `EXPO_PUBLIC_SENTRY_DSN` (Expo build env) |

### 6.2 .env.staging 채우기

```bash
# deploy/staging/.env.staging 의 SENTRY_DSN 항목
SENTRY_DSN=https://abc123@oXXXXXX.ingest.sentry.io/1234567
SENTRY_TRACES_SAMPLE_RATE=0.1
```

CMS 는 빌드 타임 inline 이라 별도 env 가 필요 — `.env.staging` 에 `VITE_SENTRY_DSN` 도 추가해서 deploy.sh 가 build 시 inject 하도록 하거나, 빌드 직전 export.

### 6.3 release 태그 자동 주입

`deploy/staging/deploy.sh` 가 `git rev-parse --short HEAD` 로 GIT_SHA 를 산출해:
- backend: `GIT_SHA` env → `Sentry.init({ release: process.env.GIT_SHA })`
- CMS: `VITE_GIT_SHA` build env → vite inline → `Sentry.init({ release: env.VITE_GIT_SHA })`

deploy 마다 새 release 가 생성되어 issue 가 `5f36fcb`, `574703e` 같은 SHA 별로 grouping. regression 추적 용이.

### 6.4 검증

배포 후:

```bash
# backend 가 의도적으로 5xx 발생시키기 (dev only — staging admin 으로):
curl -fsS https://a-idol-stg.amoeba.site/api/v1/admin/_internal/sentry-test \
  -H "Authorization: Bearer $ADMIN" || true
# 5초 내 Sentry issue stream 에 새 event 노출 확인
```

> 위 endpoint 는 미구현. 첫 burn-in 직후 `_internal/sentry-test` 라우트를 임시 추가
> (dev-only `@AdminOnly` + `throw new InternalServerErrorException()`) 하거나
> 자연 발생 5xx 가 없으면 `console.error('test')` + `Sentry.captureMessage` 로 검증.

### 6.5 Source map upload (선택, post-DSN)

Sentry CLI 로 unminify 된 stack trace:

```bash
pnpm dlx @sentry/cli releases new "${GIT_SHA}"
pnpm dlx @sentry/cli releases files "${GIT_SHA}" upload-sourcemaps packages/cms/dist
pnpm dlx @sentry/cli releases finalize "${GIT_SHA}"
```

`vite.config.ts` 의 `sourcemap: 'hidden'` 설정 덕에 .map 은 dist/ 에 생성되지만 client 응답에는 sourceMappingURL 미포함 — 보안 OK + Sentry 만 deminify 가능.

---

## 7. 모니터링 + 알람 (T-080 옵저버빌리티 마무리)

### 7.1 메트릭 수집

`/metrics` (Prometheus exposition) — backend 컨테이너의 3000 포트가 자체 노출.
nginx 단에서 deny all 기본값. 외부 prometheus 가 스크래이프 하려면
[`deploy/staging/nginx/conf.d/a-idol-stg.conf`](../../deploy/staging/nginx/conf.d/a-idol-stg.conf) 의
`location /metrics` 블록의 `allow` 라인 주석 해제 + Prometheus IP / CIDR 입력.

### 7.2 Prometheus 설정 (외부 인스턴스 가정)

[`deploy/staging/prometheus/prometheus.yml`](../../deploy/staging/prometheus/prometheus.yml) +
[`deploy/staging/prometheus/staging-rules.yml`](../../deploy/staging/prometheus/staging-rules.yml).

8건 alert 정의 (3 그룹):

| 그룹 | Alert | 임계 | Sev |
|---|---|---|---|
| availability | A-idol-Backend-5xx-Burst | 5xx >5/1min | 2 |
| availability | A-idol-Backend-Down | scrape fail 2min | 1 |
| perf | A-idol-Backend-p95-Latency | p95 >300ms 5min | 3 |
| perf | A-idol-Backend-Event-Loop-Lag | p99 lag >100ms | 3 |
| perf | A-idol-Backend-Memory-Growth | RSS >1.5GB 10min | 3 |
| security | A-idol-Login-Failure-Burst | login fail >50/5min | 2 |
| security | A-idol-Admin-Account-Locked | admin lockout >0/10min | 2 |
| security | A-idol-User-Account-Locked-Burst | user lockout >20/15min | 3 |

### 7.3 Sentry alerts

[`deploy/staging/prometheus/sentry-alerts.md`](../../deploy/staging/prometheus/sentry-alerts.md) —
issue rule (새 fingerprint, 5xx 빈도, release 24h regression) + metric rule
(Apdex, crash-free rate). Slack 채널은 cs-workflow 와 정합.

Prometheus = burst/saturation, Sentry = issue dedup + stack trace + release grouping. 보완관계.

### 7.4 메트릭 wiring 검증 (이미 통과)

다음 6개 메트릭이 /metrics 에 노출 확인:
- `http_requests_total`
- `http_request_duration_seconds_bucket`
- `http_server_errors_total`
- `auth_login_failures_total{kind="user|admin"}`
- `auth_account_locked_total{kind="user|admin"}`
- `nodejs_eventloop_lag_p99_seconds`

count 0 인 카운터는 trigger 후 시리즈 생성 (Prometheus client 표준 동작).
실제 발생 시 정상 증가 검증 완료 (`auth_login_failures_total{kind="admin"} 1` after 1 fail).

---

## 8. 다음 단계

- **Sentry DSN 발급 + `.env.staging` 채우기** → 5xx burst 알림 활성화
- **OAuth sandbox client id** (Kakao/Apple/Google) → mobile 시 sandbox 진입 가능
- **k6 50k ramp** ([k6-staging-runbook-ko.md](./k6-staging-runbook-ko.md)) — 단일 VPS 한계 (5k VUs 권장) → 결과 보고 후 AWS 이전 결정
- **백업 cron** 설치 + restore drill 1회

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-27 | 초안 — single-VPS 배포 (nginx + docker compose + Let's Encrypt + atomic release) 가이드. AWS plan 은 [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) 에 별도 보존. |
| 2026-04-27 | §6 Sentry 활성화 절차 추가 — DSN 발급 → .env 채움 → release 태그 (deploy.sh 가 GIT_SHA / VITE_GIT_SHA 자동 주입) → 검증 → source map upload (선택). vite `sourcemap: 'hidden'` + backend `release: process.env.GIT_SHA` 코드 wiring 동시 반영. |
| 2026-04-27 | §7 모니터링 + 알람 추가 — `deploy/staging/prometheus/{prometheus.yml,staging-rules.yml,sentry-alerts.md}` 신설. 8건 Prometheus alert (availability 2 + perf 3 + security 3) + Sentry issue/metric rule 매핑. 6개 메트릭 wiring 검증 완료 (auth_login_failures_total{kind="admin"} 1 after fail). nginx `/metrics` 블록은 IP allowlist 기반으로 변경 (deny all 기본, Prometheus IP 만 allow). |
