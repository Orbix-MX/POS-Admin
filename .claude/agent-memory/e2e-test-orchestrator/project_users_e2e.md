---
name: Users module E2E coverage
description: Key behavioral notes for the /api/users E2E suite discovered during implementation
type: project
---

The users E2E suite lives at `api/test/users.e2e-spec.ts` (22 tests, all passing).

Notable service behaviors confirmed through testing:
- `POST /api/users` creates the User record AND a `TenantMembership` with role `STAFF` for the current tenant — the user immediately appears in `GET /api/users` list.
- `password` is stripped from every response (create, findOne, update).
- `DELETE /api/users/:id` is a hard delete (Prisma `user.delete`) — subsequent `GET /:id` returns 404.
- Duplicate email check on `POST` is global (not tenant-scoped): `user.findUnique({ where: { email } })`.
- Duplicate email check on `PATCH` only triggers when the new email differs from the current one.
- `GET /api/users` filters by tenant membership: `tenantMemberships: { some: { tenantId } }`.
- Valid roles for `POST`/`PATCH`: `SUPER_ADMIN | ADMIN | MANAGER | STAFF` (UserRole enum from Prisma).

**Why:** Captured to avoid re-reading service code in future conversations.
**How to apply:** Use when adding more users tests or debugging failures in this suite.
