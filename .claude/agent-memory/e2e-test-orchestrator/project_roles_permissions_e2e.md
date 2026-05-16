---
name: Roles & Permissions E2E tests
description: 25 passing E2E tests for /api/roles and /api/permissions endpoints; key behavioral notes
type: project
---

Test file: `api/test/roles.e2e-spec.ts` — 25 tests, zero failures across two consecutive runs.

**Why:** Roles/permissions module is critical for RBAC across all tenants. Tests verify CRUD, system-role guards, permission assignment, and 401/400/404/409 error paths.

**Key behavioral notes:**
- `GET /api/permissions` returns grouped array `{ module, permissions[] }`, not paginated.
- `GET /api/permissions/flat` returns a plain array with `id, key, name, module, action`.
- `GET /api/roles` returns a plain array (no pagination), includes `_count.permissions` and `_count.userAssignments`.
- `GET /api/roles/:id` includes `permissions` array of `{ permission: {...} }` objects — to extract IDs: `rp.permission.id`.
- Roles with `isSystem: true`: cannot be renamed (400) and cannot be deleted (400). Seed creates "Super Admin" and "Admin" as system roles.
- `PUT /api/roles/:id/permissions` returns 200 or 204 (accept both).
- To get real permission UUIDs for tests: pre-fetch `/api/permissions/flat` in `beforeAll`.
- `POST /api/roles` with `permissionIds` containing non-UUID strings → 400 (validated via `@IsUUID('4', { each: true })`).

**How to apply:** Follow this pattern when adding more role/permission coverage or debugging RBAC failures in other modules.
