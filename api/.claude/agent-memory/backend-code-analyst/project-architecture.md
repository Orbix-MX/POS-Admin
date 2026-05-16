---
name: project-architecture
description: Stack tecnológico, patrones arquitectónicos clave y convenciones del proyecto pos-admin (API + Web)
type: project
---

## API (NestJS 11 + Prisma 7)

- Stack: NestJS 11, Prisma 7, PostgreSQL (Neon), pnpm, TypeScript nodenext/ES2023, strictNullChecks
- Prefix global: `/api`, Swagger en `/api/docs`, puerto 3001
- Multi-tenant: cada query usa `this.tenantContext.requireTenantId()` — nunca confiar en tenantId del body
- Audit: `createdById`/`updatedById` se setean manualmente con `this.auditContext.getUserId()`
- `TenantContextService` y `AuditContextService` vienen de `CommonModule` (@Global) — NO re-declararlos en feature modules
- `DatabaseModule` es @Global — `PrismaService` se inyecta directo sin importar DatabaseModule en cada módulo
- Guards globales registrados en AppModule: `JwtAuthGuard` + `PermissionsGuard`
- Permisos: `@RequirePermissions('module:action')` — SUPER_ADMIN bypassa todo
- Patrón módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`
- Modelos Prisma multi-tenant usan `@@unique([tenantId, campo])` como patrón
- Prisma 7 eliminó `$use` middleware — audit columns se setean manualmente en services
- Schema driven por `prisma.config.ts`, no por `package.json`

## Web (React 19 + TypeScript + Vite)

- Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Axios
- Alias `@/` → `src/`
- API client: `web/src/lib/api-client.ts` — usar `api.get/post/patch/delete`
- Patrón estricto: service → hook → page
- Services: solo llamadas HTTP en `src/services/*-service.ts`
- Hooks: estado, efectos, CRUD, filtros, paginación, modal state en `src/hooks/use-*.ts`
- Pages: solo renderizado, destrutura el hook y define columnas con `useMemo`
- Stats en hooks: usar un único `for...of` (patrón `js-combine-iterations`)
- Handlers: siempre `useCallback`. Columnas: siempre `useMemo`
- Paginación client-side por defecto (PER_PAGE=6 en la mayoría de módulos)
- Componentes compartidos clave: `DataTable`, `FormModal`+`FormField`, `Pagination`, `AvatarInitials`, `StatusBadge`
- `FormField` con `options` no soporta value/label distintos — usar `<select>` nativo en esos casos

## Permisos y módulos

- Permisos canónicos en `src/modules/permissions/permissions.constants.ts` (`ALL_PERMISSIONS`)
- Orden de módulos en `MODULES_ORDER`
- POS subset hardcodeado en `AuthService.isPosOnlyUser` — mantener sincronizado con ALL_PERMISSIONS

## Why:
Decisiones de diseño documentadas en `CLAUDE.md` de cada proyecto. El multi-tenancy estricto previene fugas de datos entre tenants.

## How to apply:
Siempre leer CLAUDE.md antes de crear módulos. Seguir el patrón existente de módulos (customers, products, etc.) como referencia.
