#!/usr/bin/env bash
# A-idol staging 배포 스크립트
#
# 전제:
#   - 본 머신에서 staging 서버 (a-idol-stg.amoeba.site) 로 SSH 접속 가능
#   - SSH key 등록 권장. password 인증인 경우 SSH 매번 prompt
#   - 서버에 Docker + docker compose plugin 이 이미 설치돼 있을 것
#   - 서버에 deploy/staging/.env.staging 가 이미 채워져 있을 것 (시크릿)
#
# 사용:
#   ./deploy/staging/deploy.sh                     # 로컬에서 CMS build + rsync + remote compose up
#   ./deploy/staging/deploy.sh --no-cms-build      # CMS dist 재빌드 skip
#   ./deploy/staging/deploy.sh --skip-migrate      # prisma migrate deploy skip
set -euo pipefail

# -------- 설정 ----------
SSH_HOST="${SSH_HOST:-a-idol-stg.amoeba.site}"
SSH_USER="${SSH_USER:-aidol}"
REMOTE_ROOT="${REMOTE_ROOT:-/srv/a-idol}"
RELEASE_TS="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="${REMOTE_ROOT}/releases/${RELEASE_TS}"
CURRENT_LINK="${REMOTE_ROOT}/current"
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

# -------- 사전 체크 ----------
echo "🛫  A-idol staging deploy — release ${RELEASE_TS}"
echo "    target: ${SSH_USER}@${SSH_HOST}:${RELEASE_DIR}"
[[ -f deploy/staging/.env.staging ]] || {
  echo "❌ deploy/staging/.env.staging 가 없습니다. .example 복사 후 값을 채우세요."
  exit 1
}

# -------- 0) Release 태그 (Sentry release grouping) ----------
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "${RELEASE_TS}")"
echo "🏷  release tag: ${GIT_SHA}"

# -------- 1) 로컬 빌드 ----------
if [[ $DO_CMS_BUILD -eq 1 ]]; then
  echo "📦  build CMS (vite production) — VITE_GIT_SHA=${GIT_SHA}"
  VITE_GIT_SHA="${GIT_SHA}" pnpm --filter @a-idol/cms build
fi

echo "📦  build shared package"
pnpm --filter @a-idol/shared build

# -------- 2) rsync ----------
# 서버에서 docker build 가 monorepo context 를 필요로 하므로 pnpm 워크스페이스를 통째로 보냄.
# node_modules / 빌드 산출물 (dist) 는 서버에서 docker 가 다시 빌드하므로 제외 (cms/dist 만 예외).
echo "🚀  rsync sources → ${SSH_HOST}:${RELEASE_DIR}"
ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" "mkdir -p '${RELEASE_DIR}'"

rsync -az --delete \
  --exclude '/node_modules' \
  --exclude '*/node_modules' \
  --exclude 'packages/backend/dist' \
  --exclude 'packages/backend/uploads' \
  --exclude 'packages/shared/dist' \
  --include 'packages/mobile/' \
  --include 'packages/mobile/package.json' \
  --exclude 'packages/mobile/*' \
  --exclude 'packages/mobile/**' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.log' \
  -e "ssh ${SSH_OPTS}" \
  ./ "${SSH_USER}@${SSH_HOST}:${RELEASE_DIR}/"

# CMS 빌드 산출물은 별도로 (dist 는 위 exclude 됨)
rsync -az --delete -e "ssh ${SSH_OPTS}" \
  packages/cms/dist/ "${SSH_USER}@${SSH_HOST}:${RELEASE_DIR}/packages/cms/dist/"

# RPT-260506 — host nginx 가 /var/www/a-idol-cms 에서 정적 자산을 직접 서빙한다.
# release 디렉터리만 갱신하면 신규 CMS 가 활성화되지 않으므로 webroot 도 같이 동기화.
CMS_WEBROOT="${CMS_WEBROOT:-/var/www/a-idol-cms}"
echo "🎨  rsync CMS dist → ${SSH_HOST}:${CMS_WEBROOT}"
rsync -az --delete -e "ssh ${SSH_OPTS}" \
  packages/cms/dist/ "${SSH_USER}@${SSH_HOST}:${CMS_WEBROOT}/"

# .env.staging 은 별도로 보내고 release 안에 위치 (compose 의 --env-file 에서 사용)
scp ${SSH_OPTS} deploy/staging/.env.staging \
  "${SSH_USER}@${SSH_HOST}:${RELEASE_DIR}/deploy/staging/.env.staging"

# -------- 3) remote compose up + migrate ----------
echo "🐳  remote: docker compose build & up"
ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" "bash -se" <<REMOTE
set -euo pipefail
cd "${RELEASE_DIR}"
ENV_FILE="deploy/staging/.env.staging"
COMPOSE="docker compose -f deploy/staging/docker-compose.staging.yml --env-file \$ENV_FILE -p a-idol-stg"

# 새 release 빌드 + 부팅 (GIT_SHA 주입 — backend Sentry release 태그)
GIT_SHA="${GIT_SHA}" \$COMPOSE up -d --build

# Prisma migrate (idempotent)
if [ "${DO_MIGRATE}" = "1" ]; then
  echo "📜  prisma migrate deploy"
  \$COMPOSE exec -T backend pnpm --filter @a-idol/backend prisma:deploy
fi

# 헬스체크 polling — 60s 안에 backend healthy 안 되면 abort
echo "🩺  waiting for backend health..."
for i in \$(seq 1 12); do
  if \$COMPOSE exec -T backend wget -qO- http://localhost:3000/health | grep -q '"status":"ok"'; then
    echo "    backend healthy"
    break
  fi
  sleep 5
  if [ \$i -eq 12 ]; then
    echo "❌  backend health timeout — 로그 확인 필요"
    \$COMPOSE logs --tail 80 backend
    exit 1
  fi
done

# current symlink 갱신 (atomic) — 마지막 성공 release 추적
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

# 7개 release 만 보존 (이전 7개 외 청소)
ls -1dt ${REMOTE_ROOT}/releases/* | tail -n +8 | xargs -r rm -rf
REMOTE

echo "✅  배포 완료. https://a-idol-stg.amoeba.site"
echo "    log: ssh ${SSH_USER}@${SSH_HOST} 'docker compose -p a-idol-stg logs -f backend'"
