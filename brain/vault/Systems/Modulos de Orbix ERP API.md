---
title: Modulos de Orbix ERP API
type: index
owner: Requiere validación
updated: 2026-08-23
tags: [sistema, orbix-erp, indice, modulos]
---

# Módulos de Orbix ERP API

Índice de módulos de [[Orbix ERP API]], agrupados como en `api/src/modules/`: `core/`
(transversal), `retail/` (venta de productos/servicios), `restaurant/` (comedor/cocina) y
`platform/` (super-admin SaaS).

## core/

**Responsabilidad.** Todo lo que no es específico de una vertical: autenticación, sucursales,
caja, clientes, dashboards, dispositivos, email, empleados, licencias, cuentas por
pagar/cobrar, permisos, roles, reportes, tenants, usuarios, y el sitio público del tenant
(`site`, `store`, `store-orders`).

**Flujo (auth, el más relevante).**
```
POST /auth/login → JWT preliminar (sin tenantId) + availableTenants[]
PATCH /auth/select-tenant/:slug → JWT con tenantId + tenantRole + posOnly
PATCH /auth/select-branch/:branchId → JWT con branchId
```

**Reseteo de contraseña** (`POST /auth/forgot-password`, `GET`/`POST /auth/reset-password/:token`,
públicos, en `auth` mismo): mismo patrón de token opaco de un solo uso que
`TenantInvitation` (ver [[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)]]),
TTL de 1h en vez de 72h. Completar el reseteo revoca todos los refresh tokens de la cuenta
(`RefreshTokenService.revokeAllForUser`) y limpia el bloqueo por intentos fallidos si lo
había. Antes de esto solo `PlatformUser` podía autorresetearse.

**Vincular/desvincular Google** (autoservicio, en `web/configuracion` → "Mi cuenta"):
desvincular es `DELETE /auth/google`, bloqueado con 400 si el usuario no tiene `password`
local (esa cuenta solo entraría por Google, y desvincularla la dejaría sin acceso).
`GET /auth/me` expone `googleLinked`/`hasPassword` para que la UI decida qué botón mostrar.

Vincular NO reutiliza `resolveGoogleIdentity` (el que usa el login público) — ese resuelve
por correo sin saber quién pidió vincular, y si el correo de Google ya fuera de OTRO usuario
de Orbix, el callback terminaría iniciando sesión como esa otra cuenta en silencio en vez de
fallar. En su lugar: `POST /auth/google/link-start` (autenticado) emite un
`GoogleLinkTicket` de un solo uso (TTL 5 min, mismo patrón hash-only que `OAuthTicket`), el
frontend lo manda como `?linkTicket=` a `GET /auth/google`, y `GoogleOAuthGuard` lo
empaqueta junto con `redirect` dentro de `state` (base64url de `{r, lt}` — Google solo
devuelve un string opaco, no dos parámetros). El callback decodifica `state` y, si trae
`linkTicket`, llama `AuthService.linkGoogleIdentity` en vez del resolver de login: ese
método rechaza con 400 explícito si la identidad de Google ya es de otro usuario (por
`googleId` o por email), y solo si no hay choque la ata al usuario del ticket.

**Dependencias.** Base de todos los demás módulos: `retail/`, `restaurant/` y buena parte del
Web dependen de `tenants`, `branches`, `users`, `roles`/`permissions` y `cash-sessions`.

**Puntos de entrada.** Ver [[Autenticacion]] y [[Autorizacion]] para el detalle de guards.
Controllers relevantes: `auth`, `tenants`, `branches`, `users`, `invitations`, `roles`,
`permissions`, `cash-sessions`, `customers`, `employees`, `payables`, `receivables`,
`dashboard(s)`, `devices`, `license`, `printer-configs`, `reports`, `staff`, `email`, `site`,
`store`, `store-orders`.

`roles` expone `GET /roles/templates` y `POST /roles/templates/:key/apply` — biblioteca de
roles típicos por `BusinessVertical` (`role-templates.constants.ts`: RETAIL, RESTAURANT,
SERVICES; GYM sin plantilla, no tiene módulo de permisos propio) que el tenant aplica cuando
quiere, y que además se auto-siembran al onboardear un tenant nuevo
(`TenantsService.onboard` y `PlatformTenantsService`, ambos caminos de creación). Aplicar
rechaza si ya existe un rol con ese nombre, para no pisar una personalización. Mismo gotcha
de orden de registro que `invitations`: `templates` va declarado ANTES de `:id` en
`RolesController`, o `GET /roles/:id` lo capturaría.

`invitations` (alta de usuario por invitación, ver
[[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)]]) expone dos rutas bajo
`/users/invitations` (protegidas) y dos bajo `/invitations/:token` (públicas). Su módulo se
registra en `AppModule` **antes** que `UsersModule` a propósito: Express prioriza las rutas
por orden de registro, no por especificidad, así que `GET /users/invitations` quedaba
capturada por `GET /users/:id` (con `id="invitations"`) si `UsersModule` se cargaba primero
— devolvía 404 "User not found" en vez de la lista de pendientes. Vale tenerlo presente al
añadir cualquier ruta estática bajo un prefijo que ya tenga un `:id` dinámico en otro
controller.

**Tienda en línea.** `store` es el único controller **público** del API (`@Public()`): sirve
branding, secciones, catálogo y la recepción del pedido al storefront, sin sesión.
`store-orders` es su contraparte autenticada, para que el tenant avance el estado del
pedido. Reglas en [[Tienda en Linea (Orbix)]].

**Archivos importantes.**
- `api/src/common/guards/` — `jwt-auth.guard.ts`, `permissions.guard.ts`, `roles.guard.ts`,
  `license.guard.ts`, `require-plan.guard.ts`, `require-module.guard.ts`.
- `api/src/common/context/` — `TenantContextService`, `AuditContextService` (ALS).
- `permissions.constants.ts` — catálogo canónico de permisos (`ALL_PERMISSIONS`, `MODULES_ORDER`).

**Notas.** Los servicios deben leer el tenant vía `tenantContext.requireTenantId()`, nunca
confiar en un `tenantId` recibido en el body.

---

## retail/

**Responsabilidad.** Venta de productos y servicios fuera del flujo de restaurante: catálogo,
inventario, compras, checkout, cupones, órdenes de trabajo.

**Flujo.**
```
products/categories/supplies (catálogo) → purchases (compra a proveedor) → inventory
  (entra a almacén) → checkout/orders (venta) → payables (si aplica cuenta por pagar)
```

**Dependencias.** `core/` (tenant, caja, clientes). `service-quotes` puede convertirse en
`orders`. `work-orders` depende de `employees` (asignación).

**Puntos de entrada.** `products`, `categories`, `measurement-units`, `supplies`,
`suppliers`, `purchases` (`@Controller('purchase-orders')`), `inventory`, `checkout`,
`orders` (`@Controller('orders')`), `coupons`, `services`, `service-quotes`, `work-orders`.

**Archivos importantes.**
- `api/src/modules/retail/inventory/inventory.engine.ts` — motor de movimientos de
  inventario; 5 TODOs "Phase 2" pendientes.
- `products` — incluye subida de imagen a storage externo (R2 o equivalente).

**Notas.** `Order` es el modelo unificado de venta también para restaurante, vía
`OrderOrigin` (`RETAIL_POS`, `RESTAURANT_COMANDA`, `DELIVERY`, `KIOSK`, `ONLINE`).

---

## restaurant/

**Responsabilidad.** Comedor y cocina: mesas, áreas, comandas y KDS (kitchen display system).

**Flujo.**
```
dining-areas / tables (layout del comedor) → dining-orders (comanda abierta en una mesa)
  → kitchen (rondas enviadas a cocina, KitchenRound) → cierre de comanda → Order (venta)
```

**Dependencias.** `core/` (sucursal, caja). Reutiliza el modelo `Order`/`Payment` de `retail/`
para el cierre de venta.

**Puntos de entrada.** `restaurant.controller.ts` (`@Controller('restaurant')`),
`kitchen.controller.ts` (`@Controller('restaurant/kitchen')`), `dining-areas` y `tables`
(anidados bajo `branches/:branchId/...`), `dining-orders`.

**Notas.** Solo se activa si el tenant tiene la feature `TABLES`/`KITCHEN` habilitada (ver
`TenantFeature`).

---

## platform/

**Responsabilidad.** Super-administración de Orbix sobre **todos** los tenants: provisionar
tenants, gestionar licencias, sucursales y dashboards desde fuera del contexto de un tenant.
No es parte del ERP que usa un cliente final.

**Dependencias.** Ninguna hacia `retail/`/`restaurant/`; es un plano administrativo aparte.

**Puntos de entrada.** `platform-auth.controller.ts` (JWT `platform-jwt` propio),
`platform-tenants.controller.ts`, `platform-branches`, `platform-dashboards`,
`platform-licenses` — todo bajo el prefijo `platform/*`.

**Notas.** Protegido con `PlatformJwtGuard`, completamente separado de `JwtAuthGuard`/
`PermissionsGuard` del flujo de tenant normal. Ver [[Administracion Multi-tenant (Orbix)]].

---

## ai/ (fuera de `modules/`)

**Responsabilidad.** Plataforma de IA transversal, en `api/src/ai/` — **no** es un módulo de
vertical y por eso vive fuera de `modules/`. Da a cualquier feature del ERP una forma
uniforme de invocar un modelo, con límites de gasto y trazabilidad.

**Estructura.**
```
ai/
  contracts/      AiCapability, AiFeatureRegistry, tipos de invocación, errores
  gateway/        AiGatewayService (entrada única) + AiExecutionService + validador
  providers/      AiProviderPort + registry · anthropic/ · openai-compatible/ · mock/
  prompts/        PromptRegistry + PromptRenderer + templates/
  limits/         presupuesto (kill switch), cuota y rate limit
  usage/          consumo registrado por tenant y feature
  observability/  trazas de la invocación
  schemas/ config/
```

**Notas.** Cada feature se enlaza a un modelo sin tabla de routing intermedia
([[ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)]]), no hay fallback
automático entre proveedores ([[ADR-0027 Sin fallback entre proveedores en la v1 (Orbix)]])
y el gasto tiene corte duro ([[ADR-0028 Kill switch de gasto y segundo-tercer proveedor (Orbix)]]).
El proveedor local corre sobre llama.cpp ([[ADR-0024 Runtime de inferencia local llama.cpp (Orbix)]]).

**Requiere validación:** qué features del ERP la consumen hoy además del asistente de alta
de productos.
