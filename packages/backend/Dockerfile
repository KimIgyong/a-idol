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
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
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
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
 && apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Production deps only (from the pruned workspace)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/cms/package.json packages/cms/
COPY packages/mobile/package.json packages/mobile/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod \
 && pnpm --filter @a-idol/backend exec prisma generate \
 && pnpm store prune \
 && rm -rf /root/.npm /root/.cache

# Built artifacts
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/backend/dist packages/backend/dist
COPY --from=build /repo/packages/backend/prisma packages/backend/prisma

EXPOSE 3000
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/backend/dist/main.js"]
