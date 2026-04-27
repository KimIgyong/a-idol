---
description: Scaffold a new feature module following Clean Architecture conventions
argument-hint: <context-name> <use-case-name>
---

Scaffold a new feature following the conventions in `CLAUDE.md`.

**Inputs**:
- `$1` → bounded context name (e.g., `fandom`, `chat`, `commerce`, `audition`)
- `$2` → kebab-cased use case name (e.g., `join-fan-club`, `send-chat-message`, `cast-vote`)

**Steps**:

1. Under `packages/backend/src/modules/$1/`, create the 4 directories if they don't exist:
   `domain/`, `application/`, `infrastructure/`, `presentation/dto/`.

2. In `application/interfaces.ts`, add or extend port interfaces (`XxxRepository`, `XxxService`) plus string DI tokens.

3. Create `application/$2.usecase.ts` with:
   - `@Injectable()` class
   - Constructor receives ports via `@Inject(TOKEN)`
   - `execute(input)` method that does one thing
   - Throws `DomainError(ErrorCodes.XXX)` for business rule violations (add new codes to `packages/shared/src/domain/errors.ts` if needed — keep them in sync with the docs)

4. Create `infrastructure/prisma-xxx.repository.ts` implementing the port.

5. Create `presentation/$1.controller.ts` (or extend an existing one) plus `presentation/dto/*.dto.ts` using `class-validator` + `@ApiProperty`.

6. Register providers in `$1.module.ts` (create it or extend). Import the module into `AppModule`.

7. Write `application/$2.usecase.spec.ts` with 3+ cases: happy path + 2 rule violations. Map each test to a WBS `TC-###` id in a jsdoc comment.

8. Update `docs/design/a-idol-req-definition.md` traceability matrix: add/verify the `FR → FN → T → TC` row for this use case.

9. Run `pnpm typecheck && pnpm test -- $2` and report.

Keep the diff small and focused — one use case per PR. If the feature needs DB changes, run the `/migrate` command first and reference that migration in the PR description.
