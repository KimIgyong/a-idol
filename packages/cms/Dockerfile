# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------
# A-idol CMS — build static bundle and serve via nginx
# Build context: repo root.
#   docker build -f packages/cms/Dockerfile -t a-idol-cms:local \
#     --build-arg VITE_API_BASE_URL=https://api.example.com .
# ---------------------------------------------------------------

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/cms/package.json packages/cms/
COPY packages/mobile/package.json packages/mobile/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @a-idol/cms... --filter @a-idol/shared...

COPY packages/shared/ packages/shared/
COPY packages/cms/ packages/cms/

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @a-idol/shared build \
 && pnpm --filter @a-idol/cms build

# ---------- runtime ------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY packages/cms/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/packages/cms/dist /usr/share/nginx/html

EXPOSE 80
# CORS-free health check — load balancer can probe `/`
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
