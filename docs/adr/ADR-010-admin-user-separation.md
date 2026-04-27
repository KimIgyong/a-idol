---
id: ADR-010
title: Separate AdminUser from User for CMS RBAC
status: Accepted
date: 2026-04-22
author: Gray Kim
related_tasks: [T-011]
related_context: AdminOps
---

## Context

The MVP needs a CMS login distinct from the mobile app's end-user login:
- Mobile users authenticate via `POST /api/v1/auth/login` (email/password, social later).
  The `User` record carries `nickname`, `birthdate`, `provider`, marketing flags, etc.
- CMS users are internal operators/admins with **role-based access** (admin,
  operator, viewer), audit logging requirements, and a separate login surface
  (`admin@a-idol.dev`-style accounts, not consumer emails).

The dev-plan already lists **AdminOps** as its own bounded context in
`docs/design/a-idol-architecture.md` §2.4 with aggregates `AdminUser`, `Role`,
`AuditLog`, `ModerationReport`.

## Decision

Keep `User` and `AdminUser` as **two completely separate aggregates**:

1. Different Prisma tables (`users`, `admin_users`) — different columns,
   independent lifecycles.
2. Different login endpoints:
   - `POST /api/v1/auth/login` → `User` + `access/refresh` JWTs with `type: "access"` / `type: "refresh"`.
   - `POST /api/v1/admin/auth/login` → `AdminUser` + JWTs with `type: "admin-access"` / `type: "admin-refresh"` **and a `role` claim**.
3. Different guards:
   - `JwtAuthGuard` accepts only `type: "access"` tokens → mobile flows.
   - `AdminJwtAuthGuard` accepts only `type: "admin-access"` tokens → CMS flows.
4. `RolesGuard` + `@Roles('admin','operator',…)` decorator enforce role
   requirements on top of `AdminJwtAuthGuard`.

## Consequences

**Positive**
- Clear blast-radius separation: a stolen user token cannot reach `/admin/*`
  endpoints (verified via E2E case *user access token → `/api/v1/admin/me` → 401*).
- Admin accounts can be provisioned out-of-band (infra / secrets manager) and
  never appear in the consumer user base.
- Role claim is self-contained in the admin JWT — no extra DB lookup per
  request to authorize by role.

**Negative**
- Two login flows → two sets of shared DTOs (`AuthResponseDto`,
  `AdminAuthResponseDto`) and two stores on the client side.
- A small amount of duplication between `JwtTokenService` and
  `AdminJwtTokenService`; kept separate to avoid conditional branching in guard
  code.

## Alternatives considered

1. **Single `users` table with a `is_admin` flag or `role` column.** Rejected.
   It couples consumer profile churn with admin account management, complicates
   `User.toJSON()` leakage (we already expose `passwordHash` for the identity
   module only), and risks privilege-escalation bugs where an updated `User`
   route accidentally alters an admin record.
2. **Reuse the consumer JWT with an additional `role` claim.** Rejected.
   Same issuer / same verify chain means a future bug that relaxes token
   validation on mobile-facing endpoints would immediately compromise `/admin/*`.

## Status of implementation

- Backend: `modules/admin-ops/` with domain, application (`LoginAdmin`,
  `RefreshAdminToken`, `GetAdminMe`), infra (`PrismaAdminUserRepository`,
  `AdminJwtTokenService`), presentation (`/api/v1/admin/auth/*`, `/api/v1/admin/me`).
- Guards: `AdminJwtAuthGuard`, `RolesGuard`; decorators `@Roles`, `@CurrentAdmin`.
- Seed: `admin@a-idol.dev` / `admin-dev-0000` (dev only).
- CMS: `AuthSession = AdminAuthResponseDto`; `hasRole()`; `RequireRole` gate on
  sensitive routes (`/analytics` → admin only; catalog → admin+operator).

## Future work

- Add `AuditLog` aggregate (T-082 security review) capturing admin actions.
- Persist refresh sessions for admin (stateless now; MVP).
- Introduce `viewer` role usage — currently defined but unused.
