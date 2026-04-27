---
description: Run (or re-run) the local Prisma seed
---

Run the seed script: `pnpm seed`.

If the command fails with a unique-constraint error, it's usually because seeds are idempotent per-row — read the error and decide whether to extend the `upsert` keys or reset the DB (`make reset`).

After a successful seed, query the DB via Prisma Studio or by calling `GET /idols`:

```
curl http://localhost:3000/idols | jq
```

Report the resulting count of idols / fan clubs.
