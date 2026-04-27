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

## 6. 다음 단계

- **Sentry DSN 발급 + `.env.staging` 의 `SENTRY_DSN` 채우기** → 5xx burst 알림 활성화
- **OAuth sandbox client id** (Kakao/Apple/Google) → mobile 시 sandbox 진입 가능
- **k6 50k ramp** ([k6-staging-runbook-ko.md](./k6-staging-runbook-ko.md)) — 단일 VPS 한계 (5k VUs 권장) → 결과 보고 후 AWS 이전 결정
- **백업 cron** 설치 + restore drill 1회

---

## 7. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-27 | 초안 — single-VPS 배포 (nginx + docker compose + Let's Encrypt + atomic release) 가이드. AWS plan 은 [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) 에 별도 보존. |
