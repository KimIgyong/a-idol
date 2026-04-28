#!/usr/bin/env bash
# A-idol staging 배포 — shared-host 변형
#
# - 호스트가 system nginx + wildcard *.amoeba.site cert 를 이미 운영
# - backend 만 docker compose 로 띄우고 127.0.0.1:3001 노출
# - CMS dist 는 /var/www/a-idol-cms 로 rsync (host nginx 가 정적 서빙)
#
# 전제:
#   - SSH config 에 `a-idol-stg` 호스트 alias 등록 (key 인증)
#   - 서버에 /srv/a-idol/releases/, /var/www/a-idol-cms/ 가 mkdir 가능 권한
#   - deploy/staging/.env.staging 채워져 있음 (gitignore)
#
# 사용:
#   ./deploy/staging/deploy-shared.sh
#   ./deploy/staging/deploy-shared.sh --no-cms-build --skip-migrate
set -euo pipefail

SSH_HOST="${SSH_HOST:-a-idol-stg}"
REMOTE_ROOT="${REMOTE_ROOT:-/srv/a-idol}"
RELEASE_TS="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="${REMOTE_ROOT}/releases/${RELEASE_TS}"
CURRENT_LINK="${REMOTE_ROOT}/current"
CMS_WEBROOT="${CMS_WEBROOT:-/var/www/a-idol-cms}"
SSH_OPTS="${SSH_OPTS:-}"

DO_CMS_BUILD=1
DO_MIGRATE=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cms-build) DO_CMS_BUILD=0; shift ;;
    --skip-migrate) DO_MIGRATE=0; shift ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

echo "🛫  A-idol staging deploy (shared-host) — release ${RELEASE_TS}"
echo "    target: ${SSH_HOST}:${RELEASE_DIR}"
[[ -f deploy/staging/.env.staging ]] || {
  echo "❌ deploy/staging/.env.staging 가 없습니다. .example 복사 후 값을 채우세요."
  exit 1
}

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "${RELEASE_TS}")"
echo "🏷  release tag: ${GIT_SHA}"

# 1) 빌드
if [[ $DO_CMS_BUILD -eq 1 ]]; then
  echo "📦  build CMS — VITE_GIT_SHA=${GIT_SHA}"
  VITE_GIT_SHA="${GIT_SHA}" pnpm --filter @a-idol/cms build
fi
echo "📦  build shared package"
pnpm --filter @a-idol/shared build

# 2) rsync 코드
ssh ${SSH_OPTS} "${SSH_HOST}" "mkdir -p '${RELEASE_DIR}'"
rsync -az --delete \
  --exclude '/node_modules' \
  --exclude '*/node_modules' \
  --exclude 'packages/backend/dist' \
  --exclude 'packages/backend/uploads' \
  --exclude 'packages/shared/dist' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.log' \
  -e "ssh ${SSH_OPTS}" \
  ./ "${SSH_HOST}:${RELEASE_DIR}/"
# Note: packages/mobile 도 포함 — Dockerfile 의 multi-stage 가 mobile/package.json
# 을 워크스페이스 lockfile 정합성 검증에 요구. mobile node_modules 는 위에서
# 제외돼 있어 transfer 비용 작음.

# 3) CMS dist → /var/www/a-idol-cms (host nginx 가 정적 서빙)
echo "🎨  rsync CMS dist → ${SSH_HOST}:${CMS_WEBROOT}"
rsync -az --delete -e "ssh ${SSH_OPTS}" \
  packages/cms/dist/ "${SSH_HOST}:${CMS_WEBROOT}/"

# 4) .env.staging 전송
scp ${SSH_OPTS} deploy/staging/.env.staging \
  "${SSH_HOST}:${RELEASE_DIR}/deploy/staging/.env.staging"

# 5) remote: docker compose build + up + migrate
ssh ${SSH_OPTS} "${SSH_HOST}" "bash -se" <<REMOTE
set -euo pipefail
cd "${RELEASE_DIR}"
ENV_FILE="deploy/staging/.env.staging"
COMPOSE="docker compose -f deploy/staging/docker-compose.shared-host.yml --env-file \$ENV_FILE -p a-idol-stg"

GIT_SHA="${GIT_SHA}" \$COMPOSE up -d --build

if [ "${DO_MIGRATE}" = "1" ]; then
  echo "📜  prisma migrate deploy"
  \$COMPOSE exec -T backend pnpm --filter @a-idol/backend prisma:deploy
fi

# 헬스 polling — 60s
echo "🩺  waiting for backend health..."
for i in \$(seq 1 12); do
  if \$COMPOSE exec -T backend wget -qO- http://localhost:3000/health | grep -q '"status":"ok"'; then
    echo "    backend healthy"
    break
  fi
  sleep 5
  if [ \$i -eq 12 ]; then
    echo "❌  backend health timeout — 로그 확인"
    \$COMPOSE logs --tail 80 backend
    exit 1
  fi
done

ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
ls -1dt ${REMOTE_ROOT}/releases/* | tail -n +8 | xargs -r rm -rf
REMOTE

echo "✅  배포 완료. https://a-idol-stg.amoeba.site"
echo "    log: ssh ${SSH_HOST} 'docker compose -p a-idol-stg logs -f backend'"
