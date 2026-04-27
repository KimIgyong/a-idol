---
description: Bootstrap the local dev environment (install → docker → migrate → seed → dev)
---

You are starting a fresh local development session for A-idol. Do the following in order, stopping at the first failure and reporting what went wrong:

1. If `.env` does not exist, copy `.env.example` to `.env`.
2. Ensure Docker is running. If not, ask the user to start Docker Desktop.
3. Run `pnpm install` at the repo root.
4. Run `docker compose up -d postgres redis`.
5. Wait until `docker compose exec postgres pg_isready -U aidol -d aidol` succeeds (retry up to 30s).
6. Run `pnpm migrate` (creates the DB schema via Prisma).
7. Run `pnpm seed` (populates 1 agency + 3 idols + 3 fan clubs).
8. Run `pnpm dev` to start the backend in watch mode.
9. Smoke-test by `curl http://localhost:3000/health` and confirm `{status:"ok", db:"up"}`.

Report each step's outcome briefly. If any step fails, diagnose using the Troubleshooting section of `README.md`.
