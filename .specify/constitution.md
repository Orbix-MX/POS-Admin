# Constitución — Orbix ERP

Reglas no negociables del producto. Un `plan` o una tarea que las viole no pasa el gate,
sin importar lo pequeña que parezca.

Cada regla cita dónde está respaldada. Una regla sin respaldo no es constitución, es
opinión — y se retira.

---

## 1. Multi-tenant

**C-001.** El `tenantId` se resuelve con `this.tenantContext.requireTenantId()`. **Nunca**
se lee del body, de un query param ni de un header del request.
→ `api/CLAUDE.md` § Multi-tenant request context.

**C-002.** Toda consulta sobre un modelo tenant-owned lleva el `tenantId` en su `where`.
Un `findMany` sin scope sobre un modelo con columna `tenantId` es un defecto de
aislamiento, no un descuido de rendimiento.

**C-003.** `TenantContextService` y `AuditContextService` los provee el `CommonModule`
global. No se re-declaran en un módulo de feature: AsyncLocalStorage devolvería
`undefined` en silencio.

**C-004.** Un modelo tenant-scoped nuevo usa unique compuesto con `tenantId`
(`@@unique([tenantId, sku])`). No un unique simple sobre el campo de negocio.

## 2. Autorización

**C-005.** `PermissionsGuard` deniega por defecto. Cada handler HTTP declara cómo se
autoriza: `@RequirePermissions`, `@Roles`, `@Public` o `@NoPermissionsRequired`.
→ Verificado en `api/src/common/guards/authorization-coverage.spec.ts`, que recorre la
metadata de Nest y falla ante un handler sin declarar.

**C-006.** `@Public()` solo en endpoints que de verdad funcionan sin sesión. Si necesita
usuario pero no un permiso concreto, es `@NoPermissionsRequired`.

**C-007.** `SUPER_ADMIN` salta todos los chequeos de permiso. Cualquier endpoint que
otorgue, revoque o escale permisos es vía `completo` y pasa por `/security-review`.

**C-008.** Las claves de permiso viven en
`api/src/modules/core/permissions/permissions.constants.ts` (`ALL_PERMISSIONS`). Un
permiso nuevo se añade ahí, y si es de POS, también en `AuthService.isPosOnlyUser` — las
dos listas se mantienen sincronizadas a mano.

**C-009.** La caché de permisos efectivos es de 60 s por `userId:tenantId`. Un test que
mute asignaciones y lea permisos inmediatamente después es un test mal escrito, no un bug.

## 3. Datos y migraciones

**C-010.** Las columnas de auditoría (`createdById`, `updatedById`) se escriben **a mano**
con `this.auditContext.getUserId()`. Prisma 7 eliminó `$use`; no hay inyección automática.

**C-011.** Toda migración se ejecuta vía `prisma.config.ts`, no vía el bloque `prisma` de
`package.json`.

**C-012.** Este repo tiene drift conocido: `prisma migrate dev` pide resetear la base. La
ruta soportada es `prisma db execute` + `prisma migrate resolve`. Nunca aceptar el reset.

**C-013.** Un cambio destructivo de schema (`DROP COLUMN`, `NOT NULL` sobre columna
existente, borrado de tabla) se separa de la fase aditiva: primero *expand*, después
*contract*, con ventana de estabilización entre ambas. El *contract* es un spec propio con
`reversible: false`.

**C-014.** Un dual-write nace con fecha de muerte. El mismo cambio que lo introduce
registra qué lo retira y qué lo bloquea.
→ Lección de `docs/plans/PLAN-VARIANTES-INVENTARIO-2026-09-05.md` §5.1: el espejo
`mirrorLegacyProductStock` se convirtió en fuente de siembra.

**C-015.** Los datos ya corrompidos se diagnostican y se corrigen con conteo físico, nunca
con un `UPDATE` masivo que adivine qué parte de una cantidad era real.

## 4. Invariantes

**C-016.** Un invariante que solo vive en TypeScript se salta. Si la regla se puede
expresar como índice único parcial o `CHECK`, va en la base. Si no se puede, va como test
de invariante explícito — y el spec dice por qué no se pudo.

**C-017.** La UI refleja la regla o la contradice. Un campo que el backend ignora en
silencio es peor que un campo ausente.

## 5. Contrato de API

**C-018.** Prefijo global `/api`. `ValidationPipe` con `whitelist` y
`forbidNonWhitelisted`: un campo de más en el body es un 400. Al quitar un campo de un DTO
hay que revisar **todos** los clientes — web, pos-web y móvil — o empiezan a recibir 400.

**C-019.** Un cambio incompatible en un endpoint ya publicado es vía `completo`, con orden
de despliegue explícito. El campo nuevo entra opcional; se vuelve obligatorio en un cambio
posterior.

**C-020.** Los DTOs de query que necesiten coerción numérica usan `@Type(() => Number)`.

## 6. Verificación

**C-021.** La suite unitaria no prueba el cableado. Guards, interceptores, DI y
AsyncLocalStorage se verifican **con la app arrancada** y `curl` contra el endpoint real.
Un spec que toque cualquiera de esos cierra con evidencia en `verify.md`, no con tests en
verde.

**C-022.** Los 5 fallos de `retail` tenant-isolation son preexistentes. No son regresión y
no bloquean un cierre — pero tampoco se "arreglan" cambiando el test para que pase.

**C-023.** Un test que contradice un ADR es deuda, no cobertura. Se resuelve en el momento
en que se detecta; no se dejan los dos.
→ Lección de `PLAN-VARIANTES-INVENTARIO` §5.2.

## 7. Entrega

**C-024.** No se commitea sin permiso explícito. Se enseñan archivos y mensaje, se espera
el visto bueno. Nunca commitear de paso algo no pedido.

**C-025.** Los commits y PRs no llevan `Co-Authored-By` ni ningún trailer de sesión o de
herramienta.

**C-026.** `git fetch` + `git status` visibles antes de cualquier `push`.

**C-027.** Los entregables (planes, análisis, auditorías) son `.md` dentro de `docs/` del
paquete. Nunca un Artifact.

---

## force_completo

**Vive en `.specify/force-completo.md`.**

Rutas, símbolos, dominios y concurrencia que fuerzan la vía `completo`, más el
procedimiento de comprobación. Se sacó de aquí porque se consulta en caliente —en cada
asignación y en cada cierre de tarea— y cargar estas 170 líneas para comprobar una lista
de rutas es desperdicio.

Escala la **vía**, no el workflow: aplica igual en ODD y en SDD.
