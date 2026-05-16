# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 11 + Prisma 7 (PostgreSQL via `@prisma/adapter-pg` with a `pg.Pool`) + TypeScript (`nodenext`, ES2023, `strictNullChecks`). Package manager: **pnpm**. The `README.md` is the unmodified NestJS starter — ignore it.

## Commands

```powershell
pnpm install
pnpm run start:dev        # watch mode, default port 3001
pnpm run start:prod       # node dist/main (after pnpm run build)
pnpm run lint             # eslint --fix on src, apps, libs, test
pnpm run test             # Jest unit tests, rootDir = src, *.spec.ts
pnpm run test -- path/to/file.spec.ts        # single file
pnpm run test -- -t "substring of describe/it"  # by name
pnpm run test:e2e         # uses test/jest-e2e.json (rootDir = repo root)
pnpm run test:cov

# Prisma — driven by prisma.config.ts (NOT the legacy package.json "prisma" block)
pnpm exec prisma migrate dev --name <name>
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec prisma db seed     # runs `npx tsx prisma/seed.ts` per prisma.config.ts
```

`.env` is loaded by `@nestjs/config` (global) and again directly by `prisma.config.ts` / `prisma/seed.ts` via `dotenv/config`. Required: `DATABASE_URL`, `JWT_SECRET`, optional `CORS_ORIGIN` (default `http://localhost:3000`), `PORT` (default 3001). Server boots at `http://localhost:<port>` with global prefix `/api` and Swagger at `/api/docs`.

## Architecture

### Multi-tenant request context (critical)

Every request must execute inside two `AsyncLocalStorage` stores set by `AuditContextInterceptor` (registered as `APP_INTERCEPTOR` in `AppModule`):

- `TenantContextService` — `tenantId`, `tenantRole`, `branchId`
- `AuditContextService` — `userId`

Both are provided by a `@Global()` `CommonModule` so all modules share the **same instance** — do not re-declare them in feature modules or AsyncLocalStorage will silently return undefined. In services, scope every tenant-owned query with `this.tenantContext.requireTenantId()` (it throws if missing); never trust an incoming `tenantId` from the request body. Tenant-scoped Prisma models use composite uniques like `@@unique([tenantId, sku])` / `[tenantId, slug]` / `[tenantId, email]` — preserve that pattern when adding models.

Audit columns (`createdById`, `updatedById`) must be set **manually** in services using `this.auditContext.getUserId()`. Prisma 7 removed `$use` middleware (see the disabled block in `src/database/prisma.service.ts`) so there is no automatic injection.

### Two-step auth flow

JWT carries `{ sub, email, tenantId?, tenantRole?, branchId? }`. The flow is intentionally staged:

1. `POST /api/auth/login` → preliminary JWT (no `tenantId`) + `availableTenants[]`.
2. `PATCH /api/auth/select-tenant/:slug` → new JWT with `tenantId` + `tenantRole`. Also returns `posOnly: boolean` (true when the user's role permissions in this tenant are all in the POS subset — `AuthService.isPosOnlyUser`).
3. `PATCH /api/auth/select-branch/:branchId` → JWT with `branchId` added.

`User.lastTenantSelectedId` / `lastBranchSelectedId` persist the selection for `GET /auth/me`. `JwtStrategy.validate` re-fetches the user every request and merges `tenantId`/`tenantRole`/`branchId` from the token onto `req.user`, which the interceptor then pushes into the ALS stores.

### Authorization layering

`AuthModule` registers two `APP_GUARD`s globally — order matters:

1. `JwtAuthGuard` (extends Passport `AuthGuard('jwt')`) — bypassed by `@Public()` (`IS_PUBLIC_KEY`).
2. `PermissionsGuard` — reads `@RequirePermissions('module:action', ...)`. **`SUPER_ADMIN` bypasses all permission checks.** Effective permissions = union of role-assignment permissions ∪ individual `granted=true` grants, minus `granted=false` revokes, scoped to `(userId, tenantId)`. Cached in-memory for 60 s keyed by `userId:tenantId`; if you mutate role/permission assignments, that cache will lag up to 60 s.

`RolesGuard` (uses `UserRole`, the platform-wide enum) and `RequirePlanGuard` (FREE < STARTER < PRO < PLUS < ENTERPRISE) exist but are **not** globally registered — apply with `@UseGuards(...)` per controller/handler. `TenantRole` (OWNER/ADMIN/MANAGER/STAFF) is the per-tenant role on `TenantMembership` and is distinct from `UserRole`.

Canonical permission keys live in `src/modules/permissions/permissions.constants.ts` (`ALL_PERMISSIONS`); seed/UI ordering uses `MODULES_ORDER`. The POS subset is hard-coded inside `AuthService.isPosOnlyUser` — keep these two lists in sync if you add POS-related permissions.

### Module layout

`src/modules/<feature>/` follows the standard Nest triplet (`*.module.ts`, `*.controller.ts`, `*.service.ts`) plus `dto/`. `AppModule` imports each one explicitly. Cross-cutting:

- `src/common/` — guards, decorators (`@Public`, `@CurrentUser`, `@RequirePermissions`, `@Roles`), filters, ALS context services, shared `PaginationDto` / `PaginatedResponse<T>`.
- `src/database/` — `PrismaService` (`@Global` via `DatabaseModule`).
- `src/config/` — `@nestjs/config` namespaces `database` and `jwt`, loaded with `isGlobal: true`.

### Global request pipeline

`main.ts` wires: CORS (credentials on), `ValidationPipe({ transform, whitelist, forbidNonWhitelisted })`, global prefix `api`, Swagger with `addBearerAuth()`. DTOs rely on `class-validator` + `class-transformer` decorators; query DTOs that need numeric coercion must use `@Type(() => Number)` (see `PaginationDto`).

### Testing notes

Jest `rootDir` is `src` for unit tests, so co-located `*.spec.ts` files are discovered automatically. The e2e config (`test/jest-e2e.json`) uses repo root and the `*.e2e-spec.ts` suffix. `PrismaService.cleanDatabase()` refuses to run when `NODE_ENV === 'production'` and is the supported way to wipe between integration tests.
