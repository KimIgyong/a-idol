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
# shared 를 가장 먼저 빌드 — CMS / mobile 가 컴파일된 `@a-idol/shared/dist`
# (entry: dist/index.js) 를 import 하므로, 새 export 가 추가되면 shared
# 가 먼저 컴파일되어야 한다. 이전에는 CMS 다음에 shared 를 빌드해 신규
# 컨트랙트 추가 시 vite build 가 "X is not exported" 로 실패했음.
echo "📦  build shared package"
pnpm --filter @a-idol/shared build

if [[ $DO_CMS_BUILD -eq 1 ]]; then
  # Vite 는 빌드 타임에 import.meta.env 를 inline. staging 도메인에 맞춰
  # API base URL 을 명시 — 미주입 시 default 'http://localhost:3000' 가
  # production bundle 에 박혀 CORS 차단됨.
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://a-idol-stg.amoeba.site}"
  # CMS preview iframe 의 임베드 대상 — 같은 도메인의 /m/ 서브패스에 mobile
  # Expo web 빌드를 호스팅. 미주입 시 env.ts default (http://localhost:8081/m)
  # 이 production bundle 에 박혀 staging 에서 preview 동작 X.
  VITE_MOBILE_PREVIEW_URL="${VITE_MOBILE_PREVIEW_URL:-https://a-idol-stg.amoeba.site/m}"
  echo "📦  build CMS — VITE_GIT_SHA=${GIT_SHA} VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_MOBILE_PREVIEW_URL=${VITE_MOBILE_PREVIEW_URL}"
  VITE_GIT_SHA="${GIT_SHA}" \
  VITE_API_BASE_URL="${VITE_API_BASE_URL}" \
  VITE_MOBILE_PREVIEW_URL="${VITE_MOBILE_PREVIEW_URL}" \
    pnpm --filter @a-idol/cms build

  # Mobile (Expo web) 빌드 — CMS preview iframe (/m/) 의 정적 SPA.
  # baseUrl=/m 은 packages/mobile/app.json experiments.baseUrl 에서 설정.
  # EXPO_PUBLIC_API_BASE_URL 은 metro 가 inline — 미주입 시 expoConfig.extra
  # 기본값 (localhost:3000) 이 박혀 staging 에서 API 호출 실패.
  EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-${VITE_API_BASE_URL}/api/v1}"
  echo "📱  build mobile (expo export --platform web) — EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}"
  EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL}" \
  EXPO_PUBLIC_APP_ENV="staging" \
    pnpm --filter @a-idol/mobile export:web
fi

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

# 3-1) Mobile (Expo web) dist → /var/www/a-idol-cms/m (CMS preview iframe).
# 같은 webroot 의 서브디렉토리에 두면 host nginx 의 try_files $uri $uri/
# /index.html 규칙이 /m/index.html 과 hashed 정적 자산을 모두 정상 서빙.
# 별도 nginx location 추가 불필요 → host nginx conf 변경 zero.
if [[ -d packages/mobile/dist ]]; then
  echo "📱  rsync mobile dist → ${SSH_HOST}:${CMS_WEBROOT}/m"
  ssh ${SSH_OPTS} "${SSH_HOST}" "mkdir -p '${CMS_WEBROOT}/m'"
  rsync -az --delete -e "ssh ${SSH_OPTS}" \
    packages/mobile/dist/ "${SSH_HOST}:${CMS_WEBROOT}/m/"
else
  echo "⚠️  packages/mobile/dist 없음 — preview 미반영. --no-cms-build 로 skip 했다면 export:web 별도 실행 필요."
fi

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
