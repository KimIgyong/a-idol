# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------
# A-idol backend — multi-stage Dockerfile (pnpm workspace aware)
# Build context: repo root (so pnpm can resolve workspace deps).
#   docker build -f packages/backend/Dockerfile -t a-idol-backend:local .
# ---------------------------------------------------------------

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---------- 1) deps — install the full workspace ------------------
FROM base AS deps
# .npmrc 는 node-linker=hoisted 를 강제 (RN/Expo 호환) — 빠뜨리면 docker 의 pnpm 이
# isolated 레이아웃을 쓰면서 transitive dep (ioredis 등) 가 resolve 안 됨.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/cms/package.json packages/cms/
COPY packages/mobile/package.json packages/mobile/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- 2) build — shared + backend ---------------------------
FROM deps AS build
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
# shared builds first so backend's paths → ../shared/dist resolves
RUN pnpm --filter @a-idol/shared build \
 && pnpm --filter @a-idol/backend prisma:generate \
 && pnpm --filter @a-idol/backend build

# ---------- 3) runtime — slim prod image --------------------------
FROM node:20-alpine AS runtime
# tini: PID1 zombie reaper. openssl: prisma 가 libssl/openssl 버전 감지에 사용
# (없으면 'Defaulting to openssl-1.1.x' warn → engine .so 로드 실패).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
 && apk add --no-cache tini openssl
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Production deps only (from the pruned workspace).
# Note: prisma generate 는 build 단계에서 이미 실행됨 — 여기서는 build/runtime
# 사이의 prisma `node_modules/.prisma/client` (generated artifacts) 를 그대로
# COPY 만 하면 됨. runtime 에서 prisma CLI 재실행 시 devDep 부재로 실패.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/cms/package.json packages/cms/
COPY packages/mobile/package.json packages/mobile/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts \
 && pnpm store prune \
 && rm -rf /root/.npm /root/.cache

# Built artifacts + 생성된 prisma client (build 단계 산출물)
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/backend/dist packages/backend/dist
COPY --from=build /repo/packages/backend/prisma packages/backend/prisma
# RPT-260506 — project-doc sync usecase reads `${PROJECT_DOCS_REPO_ROOT or cwd}/docs/**`.
# 컨테이너 cwd 는 /app 이라 docs/ 가 같이 와야 admin sync-from-repo 가 동작.
# read-only 사용 (admin POST 가 fs.read 만), 이미지 크기 영향 ≈ 수 MB.
COPY docs/ docs/
# Prisma generate output — build 가 이미 만든 .prisma/client 를 통째로 가져옴.
# `node_modules/.prisma/client` 와 `node_modules/@prisma/client` 두 디렉토리.
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma node_modules/@prisma
# bcrypt 네이티브 바이너리 — runtime 의 `--ignore-scripts` 때문에 postinstall
# 이 안 돌고, 결과적으로 `lib/binding/napi-v3/bcrypt_lib.node` 가 누락됨.
# build 단계에서 이미 다운로드된 prebuild 를 그대로 가져옴.
COPY --from=build /repo/node_modules/bcrypt/lib/binding node_modules/bcrypt/lib/binding

# prisma CLI — `prisma migrate deploy` 를 컨테이너 내에서 실행하기 위해 필요.
# devDep 라 `--prod` 설치엔 빠지므로 별도 글로벌 설치. 고정 버전: 5.22.0
# (=== @prisma/client 와 동일, 엔진 호환 보장).
RUN npm install -g prisma@5.22.0

# 운영용 USER node 는 일단 제외 — node_modules 전체를 chown 하는 비용이 매우 크고
# (수만 개 파일), prisma migrate deploy 가 일부 임시 파일을 쓰려는 경우 권한이
# 막힘. staging 은 host nginx → 127.0.0.1:3001 internal-only 노출이라 root 로
# 실행해도 외부 노출이 없음. 프로덕션에서는 `COPY --chown=node:node` 패턴으로
# 재정비 (이슈 #추후).

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/backend/dist/main.js"]
