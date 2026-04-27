---
description: Create and apply a new Prisma migration
argument-hint: <migration-name>
---

Create a new Prisma migration named `$ARGUMENTS`:

1. Verify Docker is running and `postgres` container is healthy (`docker compose ps`).
2. From the repo root run:
   ```
   pnpm --filter @a-idol/backend prisma:migrate -- --name $ARGUMENTS
   ```
3. Inspect the generated SQL under `packages/backend/prisma/migrations/<timestamp>_$ARGUMENTS/migration.sql` and show a summary to the user.
4. If any DDL change looks destructive (DROP COLUMN, DROP TABLE, constraint removal), ask the user to confirm before proceeding with commit.
5. Regenerate the Prisma client: `pnpm --filter @a-idol/backend prisma:generate` (Prisma usually does this automatically).
6. Run `pnpm --filter @a-idol/backend typecheck` to make sure no TS types break.

If the command fails because the DB is out of sync, suggest `make reset` (destroys local data) as a last resort.
