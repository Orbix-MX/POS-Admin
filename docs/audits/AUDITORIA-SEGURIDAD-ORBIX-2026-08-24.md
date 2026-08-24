# Orbix Security Audit — Pre-lanzamiento

**Fecha:** 2026-08-24
**Alcance:** `admin-repo/` (API NestJS, web React, POS web, apps móviles Expo/Flutter, e-commerce Astro)
**Método:** revisión estática de código, configuración y dependencias. Sin pruebas activas, sin modificar código, configuración ni datos. Únicas ejecuciones: `pnpm audit` (read-only) y `jest` (tests unitarios, sin base de datos), ambas en local.
**Commit base:** working tree limpio en el momento de la auditoría.

> Convenciones de este informe:
> **Confirmado** = respaldado por código citado. **Riesgo probable** = el código lo permite pero no verifiqué el efecto end-to-end. **NO VERIFICADO** = no es comprobable con este repositorio. **Recomendación** = mejora sin vulnerabilidad directa.

---

## 1. Executive Summary

**Nivel general: medio-alto en diseño, con fallos concretos de aislamiento multi-tenant y escalamiento de privilegios que son bloqueadores.**

Orbix ERP no es un proyecto descuidado: al contrario, es uno de los códigos más deliberadamente defensivos que se pueden encontrar en un ERP de este tamaño. `PermissionsGuard` **deniega por defecto** (un endpoint sin declarar autorización es inalcanzable), existe `EffectivePermissionsService.assertActorCanGrant()` que implementa "nadie otorga un privilegio que no posee", refresh tokens opacos con rotación y detección de reutilización, tickets de un solo uso para OAuth, lockout por cuenta con backoff exponencial, MFA TOTP con secreto cifrado AES-256-GCM, `AsyncLocalStorage` para el tenant con `requireTenantId()` usado 246 veces, cero SQL crudo, y un test que recorre la metadata de Nest para exigir que **todo** handler declare cómo se autoriza.

El problema es que hay huecos puntuales que **anulan esas mismas invariantes**:

- El motor de inventario resuelve productos e insumos **por id, sin filtro de tenant**, y las referencias `childProductId` / `supplyId` / `productId` de comandas se persisten sin validar propiedad. Un usuario de cualquier tenant puede **descontar el inventario de otro tenant** y leer sus costos. Esto no es una hipótesis: **el propio equipo tiene tests que lo prueban y están fallando** (`inventory-consumption.tenant-isolation.spec.ts`, `products.tenant-isolation.spec.ts`).
- `PATCH /users/:id` acepta `role: "SUPER_ADMIN"` y lo escribe en `User.role`. `SUPER_ADMIN` salta *todos* los chequeos de permisos. Basta `users:edit` para autoescalarse — sorteando por completo `assertActorCanGrant`.
- `PUT /roles/:id/permissions` no llama `assertActorCanGrant`: con `roles:edit` se pueden añadir todos los permisos del catálogo a un rol que ya se posee.

**Principales fortalezas:** autorización fail-closed, anti-escalación en las rutas de usuario, ciclo de refresh tokens, aislamiento de caja (índice único parcial + claim condicional), subidas de archivo re-codificadas con `sharp`, ausencia total de SQL crudo y de `child_process`, secretos fuera de git.

**Bloqueadores de lanzamiento:** C-01, C-02, H-01, H-02, H-03, C-03 (verificar en prod), M-12 (config Android), M-14 (`NODE_ENV`).

---

## 2. Security Score

Evaluación **interna**, no una métrica estándar. Refleja mis hallazgos sobre este repositorio, no una certificación.

```text
Authentication:   7/10   Diseño fuerte; falta revocar access tokens y auditar login
Authorization:    5/10   Excelente base fail-closed, dos vías de escalamiento reales
Multi-tenancy:    4/10   Disciplina alta pero escritura cross-tenant confirmada
API Security:     6/10   Cobertura declarativa buena; rate limiting parcial
Data Protection:  4/10   Prisma loguea queries+params en prod; /metrics público
Mobile Security:  4/10   SecureStore correcto; release no está configurado
Infrastructure:   3/10   NO VERIFICABLE — sin IaC, sin CI, sin proxy en el repo
Dependencies:     5/10   110 vulns (1 critical, 42 high); multer y nodemailer en runtime
Business Logic:   5/10   Servidor no es autoridad de precios ni concilia pagos
Monitoring:       3/10   Sin auditoría de auth, 500 sin log, sin alertas
──────────────────────────────────────
GLOBAL:          4.6/10
```

---

## 3. Launch Decision

### 🟠 NOT RECOMMENDED YET

No por la cantidad de hallazgos, sino por su naturaleza. Un SaaS multi-tenant tiene exactamente una promesa irrenunciable: los datos de un cliente no se tocan desde otro. Hoy esa promesa se rompe con una llamada HTTP legítima y un UUID que el propio storefront público publica. Además, cualquiera con `users:edit` o `roles:edit` — permisos que un dueño reparte sin pensarlo dos veces — se convierte en administrador total.

Ninguno de los tres bloqueadores es arquitectónico. C-01 es un `where` de tenant en tres funciones más validación de referencias; C-02 es sacar `role` del DTO; H-01 es una línea de `assertActorCanGrant`. **Con una a dos semanas de trabajo enfocado esto pasa a 🟡 READY WITH CONDITIONS.**

---

## 4. Critical Findings

### C-01 — Escritura y lectura cross-tenant de inventario vía resolución de producto/insumo sin filtro de tenant

| | |
|---|---|
| **Severity** | CRITICAL |
| **Category** | OWASP API1:2023 BOLA / A01 Broken Access Control |
| **Component** | Motor de inventario, catálogo de productos, comandas |
| **Launch blocker** | **YES** |

**Archivos afectados**

- `api/src/modules/retail/inventory/inventory-consumption.engine.ts:379-392` (`loadProduct`), `:163-169` (`supply.updateMany`), `:264`
- `api/src/modules/retail/inventory/inventory.engine.ts:174-186, 240-288` (`ensureBranchInventoryRow`)
- `api/src/modules/retail/inventory/variant-inventory.resolver.ts:56-70, 88-101`
- `api/src/modules/retail/products/products.service.ts:96, 191, 207-212, 492-499, 770-790, 829-848`
- `api/src/modules/restaurant/restaurant.service.ts:73, 131, 190-196, 285-311`

**Description**

`InventoryConsumptionEngine.loadProduct()` hace `tx.product.findUnique({ where: { id: productId } })` — sin `tenantId`. `PRODUCT_LOAD_SELECT` no incluye siquiera la columna `tenantId`, así que el motor **no tiene forma de detectar** que el producto es ajeno. El descuento de insumos hace `tx.supply.updateMany({ where: { id, stock: { gte: q } } })`, también sin tenant. Y `VariantInventoryResolver.resolveBranchId()`, cuando el contexto no trae sucursal, resuelve **la sucursal principal del tenant dueño del producto** — es decir, apunta directamente al inventario de la víctima.

Simultáneamente, `ProductsService` inserta `childProductId` (combos) y `supplyId` (recetas) tal cual como llegan en el body, y `RestaurantService` crea `orderItem` con `item.productId` del DTO sin validación alguna de propiedad.

**Attack scenario**

1. El atacante crea un tenant gratuito con `POST /api/tenants/onboarding` (autoservicio, sin aprobación).
2. Obtiene UUIDs de productos de la víctima desde `GET /api/store/products` — endpoint **público** cuya proyección incluye `id` y `variants[].id` (`store.service.ts:10`). Basta conocer el dominio de la tienda; incluso puede falsificar el header `Origin` contra `StoreDomainGuard`.
3. Camino A (retail, siempre disponible): crea un producto `COMBO` con `comboItems: [{ childProductId: "<uuid-de-la-víctima>", quantity: 100 }]` y lo vende con `POST /api/orders`. El motor expande el combo, carga el producto ajeno y descuenta su stock.
4. Camino B (más directo, `comanda:view|orders:create`): `POST /api/restaurant/checkout/direct` con `items: [{ productId: "<uuid-ajeno>", quantity: 500 }]`.
5. Lectura: `GET /api/products/:id` del propio combo devuelve `comboItems: { include: { child: true } }` (`products.service.ts:39`) → **la fila completa** del producto ajeno, incluyendo `costPrice`, `avgCost`, `lastCost`, `taxCode`.

**Impact**

Destrucción o manipulación del inventario de cualquier tenant identificable (sobreventa inducida, roturas de stock, valuación falseada); divulgación de costos y márgenes de la competencia — el dato comercial más sensible de un retailer. Repetible en bucle y sin límite de tasa.

**Evidence** — los tests del propio repositorio lo documentan y **fallan hoy**:

```text
✕ InventoryConsumptionEngine — aislamiento de tenant › la resolución del producto
  está acotada al tenant del contexto
✕ InventoryConsumptionEngine — aislamiento de tenant › el descuento de stock está
  acotado al tenant del contexto
✕ ProductsService — aislamiento de tenant en referencias › los hijos referenciados
  NO están protegidos › create(COMBO) comprueba la propiedad del hijo
✕ ... › upsertComboItems rechaza un childProductId de otro tenant
✕ ... › upsertRecipe rechaza un supplyId de otro tenant
```

El comentario en `inventory-consumption.tenant-isolation.spec.ts:6-14` describe el vector exactamente igual que arriba.

**Recommended fix**

1. Añadir `tenantId` a `PRODUCT_LOAD_SELECT` y pasar `ctx.tenantId` a `loadProduct` / `resolveEffects`; usar `findFirst({ where: { id, tenantId } })` y lanzar si no existe.
2. `supply.updateMany` y `supply.findUnique` del motor: incluir `tenantId`.
3. `VariantInventoryResolver`: recibir `tenantId` explícito y nunca derivar la sucursal del tenant del producto.
4. Validar propiedad al **escribir**: en `create`/`update`/`upsertComboItems` verificar `product.findMany({ where: { id: { in: childIds }, tenantId } })` y comparar el conteo (el patrón ya existe en `orders.service.ts:64-83`); igual para `supplyId`.
5. `RestaurantService`: replicar la precarga con filtro de tenant de `OrdersService.create`.
6. Dejar los cinco tests en verde y añadirlos a CI.
7. Defensa en profundidad: PostgreSQL RLS por `tenantId`, que haría inefectiva toda esta clase de bug.

---

### C-02 — Escalamiento a `SUPER_ADMIN` de plataforma desde un tenant con `users:edit`

| | |
|---|---|
| **Severity** | CRITICAL |
| **Category** | OWASP API3:2023 BOPLA (mass assignment) / A01 |
| **Component** | Módulo de usuarios |
| **Endpoints** | `PATCH /api/users/:id`, `POST /api/users` |
| **Files** | `api/src/modules/core/users/dto/update-user.dto.ts:24-27`, `create-user.dto.ts:26-28`, `users.service.ts:180-183` |
| **Launch blocker** | **YES** |

**Description**

`UpdateUserDto` expone `role?: UserRole` y `UsersService.update()` lo escribe directo: `this.prisma.user.update({ where: { id }, data: userFields })`. `UserRole` incluye `SUPER_ADMIN`. En `PermissionsGuard:49-51`, `SUPER_ADMIN` retorna `true` antes de cualquier chequeo, y `EffectivePermissionsService.compute()` le devuelve el catálogo completo de permisos.

La víctima del diseño es la propia defensa: `assertActorCanGrant()` protege `setRoles` y `setPermissions` con rigor, pero `update()` alcanza el mismo efecto —todos los permisos— por una puerta que ese guard no vigila.

**Attack scenario**

Un usuario con un rol tipo "RRHH" que incluya `users:edit` ejecuta `PATCH /api/users/<su-propio-id>` con `{"role":"SUPER_ADMIN"}`. En el siguiente request `JwtStrategy.validate()` relee el usuario de la BD (`jwt.strategy.ts:63`) y devuelve `role: 'SUPER_ADMIN'`; el guard lo deja pasar a todo: cierres de caja, reportes financieros, configuración del tenant, `pos.cash:authorize`, RBAC completo. Además `cash-sessions.service.ts:490,521,567` lo exime explícitamente de los permisos de autorización de caja — puede firmar sus propios descuadres.

**Impact**

Escalamiento de un permiso administrativo estrecho a control total del tenant, incluida la autorización de operaciones financieras que el diseño separa a propósito. `POST /users` con `role: SUPER_ADMIN` permite además sembrar cuentas privilegiadas persistentes.

**Evidence** — `users.service.ts:176-183`

```ts
const { status, ...userFields } = updateUserDto;   // `role` queda en userFields
if (status) { await this.setMembershipStatus(id, status); }
if (Object.keys(userFields).length > 0) {
  await this.prisma.user.update({ where: { id }, data: userFields });
```

No hay ningún chequeo del rol del actor ni llamada a `assertActorCanGrant`.

**Recommended fix**

Quitar `role` de `UpdateUserDto` y `CreateUserDto` (el rol dentro del tenant ya se maneja por `TenantMembership.role` y RBAC). Si `User.role` debe seguir siendo mutable, restringirlo al plano platform y prohibir explícitamente asignar `SUPER_ADMIN` desde una ruta con contexto de tenant. Auditar la BD de producción buscando `User.role = 'SUPER_ADMIN'` inesperados.

---

### C-03 — Seed con credenciales `SUPER_ADMIN` triviales y contraseña de super-admin de plataforma de 8 caracteres

| | |
|---|---|
| **Severity** | CRITICAL si el seed corrió en producción — **NO VERIFICADO** |
| **Category** | A07 Identification and Authentication Failures |
| **Component** | `prisma/seed.ts`, provisión inicial |
| **Files** | `api/prisma/seed.ts:52-64, 91-103, 636-648`; `api/.env` (`PLATFORM_ADMIN_PASSWORD`, longitud 8) |
| **Launch blocker** | **YES (verificación obligatoria)** |

**Description**

El seed —invocable con el comando documentado `pnpm exec prisma db seed`— crea `admin@ecommerce.com` con contraseña `admin123` y `role: 'SUPER_ADMIN'`, más `owner@tienda-norte.com` / `owner123` y `owner@fashion-plus.com` / `plus123`. No hay guardia de `NODE_ENV` (a diferencia de `cleanDatabase()`, que sí la tiene en `prisma.service.ts:45`). En paralelo, la variable `PLATFORM_ADMIN_PASSWORD` del entorno local mide 8 caracteres, y de ahí sale el `PlatformUser` que gobierna **todos** los tenants.

**Attack scenario**

Un atacante prueba `admin@ecommerce.com` / `admin123` en `POST /api/auth/login`. El throttle es de 5/min por IP y no hay lockout en el primer intento. Si la cuenta existe, obtiene `SUPER_ADMIN` de plataforma.

**Impact** — compromiso total de la instalación con una credencial de diccionario.

**Evidence** — `seed.ts:52-64`: `bcrypt.hash('admin123', 10)`, `role: 'SUPER_ADMIN'`.

**Recommended fix**

Verificar de inmediato en la BD de producción si existen esos tres correos y borrarlos/rotarlos. Añadir `if (process.env.NODE_ENV === 'production') throw` al inicio del seed de demo, o separarlo en `seed-demo.ts`. Fijar `PLATFORM_ADMIN_PASSWORD` con ≥24 caracteres aleatorios y activar MFA en esa cuenta.

---

## 5. High Findings

### H-01 — Escalamiento de privilegios vía permisos de rol (`assertActorCanGrant` no cubre las rutas de rol)

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | A01 / API5 BFLA |
| **Endpoints** | `PUT /api/roles/:id/permissions`, `PATCH /api/roles/:id`, `POST /api/roles` |
| **File** | `api/src/modules/core/roles/roles.service.ts:119-152, 154-177, 195-260` |
| **Launch blocker** | **YES** |

`RolesService` nunca invoca `assertActorCanGrant()`. `setPermissions(roleId, permissionIds)` borra y recrea `rolePermission` con cualquier permiso del catálogo global. Un usuario con `roles:edit` edita **un rol que él mismo tiene** y se añade `pos.cash:authorize`, `users:edit`, `tenant:edit`, `reports:*`. La invalidación de caché (`invalidateTenant`) hace el efecto inmediato. El único freno es `countAdmins() === 0`, que impide quitar permisos, no añadirlos.

**Attack scenario:** `PUT /api/roles/<rol-propio>/permissions` con el array completo de `GET /api/permissions` → permisos totales del tenant en un request.

**Fix:** llamar `assertActorCanGrant(keysForPermissionIds(permissionIds))` en `create`, `update` y `setPermissions` de `RolesService`, igual que ya se hace en `UsersService.setRoles/setPermissions` y en `StaffService.assignPin`.

---

### H-02 — Prisma registra todas las consultas SQL con sus parámetros, también en producción

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | A09 Security Logging and Monitoring Failures / A02 |
| **File** | `api/src/database/prisma.service.ts:20-23` |
| **Launch blocker** | **YES** |

```ts
super({ adapter, log: ['query', 'info', 'warn', 'error'] });
```

Sin condición por entorno. El canal `query` de Prisma emite cada sentencia junto con sus parámetros a stdout. Eso significa que en los logs de producción terminan: hashes bcrypt de contraseñas, `tokenHash` de refresh tokens / reset de contraseña / tickets OAuth / MFA, `pinHash` de empleados, `mfaSecretEnc`, correos, teléfonos, direcciones, totales de venta y saldos. Cualquiera con acceso a los logs (proveedor de hosting, agregador, un desarrollador con acceso de lectura) obtiene un volcado continuo de datos sensibles; y los hashes de PIN de 4 dígitos son reversibles por fuerza bruta en segundos.

Efecto secundario: coste de I/O por query en el camino crítico.

**Fix:** `log: process.env.NODE_ENV === 'production' ? ['warn','error'] : ['query','info','warn','error']`. Revisar y purgar los logs históricos; si ya se ejecutó en prod, rotar `JWT_SECRET`, `PLATFORM_JWT_SECRET` y `STAFF_PIN_PEPPER` (esto último invalida los PIN y exige reasignarlos).

---

### H-03 — Oráculo de verificación de contraseñas sin límite de intentos que evita el lockout de login

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | A07 / API4 Unrestricted Resource Consumption |
| **Endpoints** | `POST /api/cash-sessions/verify-close-auth`, `POST /api/cash-sessions/:id/close-with-auth`, retiros con autorización |
| **File** | `api/src/modules/core/cash-sessions/cash-sessions.service.ts:477-497, 500-533, 546-575` |
| **Launch blocker** | **YES** |

Estos endpoints reciben `authEmail` + `authPassword` arbitrarios y responden 403 o éxito. No están decorados con `ThrottlerGuard`, no incrementan `failedLoginAttempts`, no consultan `lockedUntil`, y no verifican `user.status` ni `membership.status`. El control de lockout de `AuthService.login` (umbral 5, backoff exponencial hasta 60 min) es por completo inaplicable aquí.

**Attack scenario:** un cajero con `pos.cash:close` itera la contraseña del gerente contra `verify-close-auth` sin ningún freno; la cuenta atacada nunca se bloquea ni deja rastro (no hay auditoría de intentos fallidos, ver M-06). Con acierto, autoriza sus propios descuadres de caja. Nota adicional: un usuario con `status: SUSPENDED` sigue sirviendo como autorizador válido.

**Fix:** aplicar `@UseGuards(ThrottlerGuard)` con límite estricto (p. ej. 5/min); enrutar la verificación por un método compartido que aplique y registre el lockout por cuenta; exigir `user.status === 'ACTIVE'` y `membership.status === 'ACTIVE'`; auditar cada intento fallido.

---

### H-04 — Endpoints de inventario por sucursal aceptan `productId` de otro tenant

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | API1 BOLA |
| **Endpoints** | `PATCH /api/branches/:id/inventory/:productId`, `POST /api/branches/:id/inventory/bulk`, `POST /api/branches/:id/inventory/transfer` |
| **File** | `api/src/modules/core/branches/branches.service.ts:148-200, 202-252, 254-320` |
| **Launch blocker** | **YES** |

La sucursal sí se valida (`findFirst({ id, tenantId })`), pero el `productId` nunca. Se pasa a `variants.ensureDefaultVariantId(prisma, productId)`, que hace `product.findUnique({ where: { id } })` y, si al producto ajeno le falta variante default, **la crea** (`variant-inventory.resolver.ts:53-73`) — una escritura en los datos de otro tenant. Luego se inserta una fila `branchInventory` que enlaza el producto ajeno con la sucursal del atacante, y `GET /api/branches/:id/inventory` la devuelve con `product: { name, sku, price, status, lowStockAlert }`.

Segunda instancia de la misma clase: `POST /api/branches/:id/members/:userId` (L-07) tampoco valida que el `userId` pertenezca al tenant.

**Fix:** validar `productId` con `product.findFirst({ where: { id, tenantId } })` en los tres métodos y pasar `tenantId` al resolver.

---

### H-05 — El servidor no es autoridad de precios ni concilia los pagos contra el total

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | A04 Insecure Design / Business Logic |
| **Endpoint** | `POST /api/orders` (permiso `orders:create`) |
| **Files** | `api/src/modules/retail/orders/dto/create-order.dto.ts:88-113, 158-171`; `orders.service.ts:118-196, 224-232` |
| **Launch blocker** | **YES** (al menos la conciliación y el `paymentStatus`, que son triviales) |

`item.price` viaja en el body con la única restricción `@Min(0)`; jamás se compara con `product.price`. `item.discount` es igualmente libre y `calculateLineSubtotal` solo aplica un piso en 0, así que el total se puede llevar a cero. `quantity` es `@Min(1)` sin techo. El servidor **sí** recalcula subtotal/impuesto/total de forma consistente — pero a partir de números que elige el cliente, lo que no aporta autoridad alguna.

Peor: para ventas no-apartado, `initialPaymentStatus = dto.paymentStatus ?? 'PENDING'` (línea 231) y `dto.status` también son del cliente. **No existe ninguna validación de que la suma de `payments` iguale el `total`.** `paidNow` se calcula pero solo se usa para apartados y CxC.

**Attack scenario:** un cajero envía `items: [{ productId, quantity: 1, price: 4999 }], payments: [{ method: "CASH", amount: 0 }], paymentStatus: "PAID"`. Se genera una venta de $4,999 marcada como pagada, sin CxC (`isCredit` es falso), con un `CashMovement` de $0 — la caja cuadra al cierre y el inventario sale. Variante equivalente: `price: 0.01` con descuento manual sin permiso ni traza.

**Impact:** fuga de mercancía sin rastro contable, precios/impuestos arbitrarios, reportes de margen inservibles. Es el modo de fraude clásico de un POS.

**Fix:**

- (a) tomar el precio del catálogo por defecto y exigir un permiso dedicado (`orders:price-override`) más un registro en `AuditLog` cuando se envíe uno distinto;
- (b) topar el descuento por línea a un porcentaje configurable por tenant, también con permiso;
- (c) rechazar la orden si `sum(payments) != total` salvo apartado/crédito explícito;
- (d) derivar `paymentStatus` y `status` en el servidor y quitarlos del DTO;
- (e) `@Max` razonable en `quantity`.

---

### H-06 — El access token sobrevive al cambio de contraseña, y la revocación es en memoria por instancia

| | |
|---|---|
| **Severity** | HIGH |
| **Category** | A07 / Session Management |
| **Files** | `auth.service.ts:833-855` (`changePassword`), `services/password-reset.service.ts:104-129`, `services/token-blacklist.service.ts:38-46`, `strategies/jwt.strategy.ts:59-61` |
| **Launch blocker** | NO (primera semana; el TTL de 1 día acota el daño) |

`changePassword` y `resetPassword` llaman `refreshTokens.revokeAllForUser()` — solo refresh tokens. El **access token** sigue siendo válido hasta su expiración (`JWT_EXPIRES_IN`, default `1d`) porque no hay noción de `tokensValidFrom` ni un revoke masivo por usuario en la blacklist. El escenario que el reseteo por correo existe para resolver —"perdí el control de mi cuenta"— deja al atacante operando hasta 24 h después.

Segundo problema, independiente: `TokenBlacklistService.isRevoked()` consulta **solo el `Map` en memoria**. La escritura persiste en `RevokedToken`, pero solo se relee en `onModuleInit`. Con más de una instancia del API, un `POST /auth/logout` en la instancia A **no revoca nada** en la instancia B. Y `JwtStrategy` omite el chequeo de blacklist por completo para tokens `typ: 'operator'` (12 h, permisos embebidos): un token de operador es irrevocable incluso revocando el dispositivo.

**Fix:** añadir `User.tokensValidFrom` (o `tokenVersion`) y compararlo con `payload.iat` en `JwtStrategy.validate`; actualizarlo en change/reset de contraseña, suspensión y expulsión. Para la blacklist: consultar la BD en fallo de caché, o mover a Redis. Aplicar el chequeo de `jti` también a tokens de operador y reducir su TTL. Bajar `JWT_EXPIRES_IN` a 15–60 min (el ciclo de refresh ya está construido y es sólido).

---

## 6. Medium Findings

**M-01 — Condiciones de carrera en saldos financieros.** `receivables.service.ts:78-97` y `payables.service.ts` leen el saldo **fuera** de la transacción y escriben un valor absoluto (`balance: newBalance`) dentro. Dos cobros concurrentes de $60 sobre un saldo de $100 pasan ambas validaciones y dejan el saldo en $40 en lugar de rechazar el segundo: el cliente pagó $120 por una deuda de $100 y el libro dice que aún debe $40. Igual patrón en `orders.service.ts:864-883, 1102-1140`. Tampoco hay claves de idempotencia en checkout: un doble submit crea dos ventas y consume stock dos veces. *Fix:* mover la lectura dentro de la transacción con `SELECT ... FOR UPDATE` o usar escrituras relativas condicionadas (`updateMany({ where: { id, balance: { gte: amount } }, data: { balance: { decrement: amount } } })`, el patrón que el motor de inventario ya usa bien); añadir `Idempotency-Key` a checkout. *Contraste positivo:* el ciclo de caja sí está bien resuelto (índice único parcial + claim condicional + `assertSessionOpen` dentro de la transacción).

**M-02 — PIN de 4 dígitos con protección insuficiente.** `POST /api/staff/pin-login` acepta PIN de 4–6 dígitos con throttle de 10/min **por IP**, sin lockout por dispositivo ni por tenant. 10.000 combinaciones distribuidas entre pocas IPs se agotan en minutos, y el premio es un JWT de operador de 12 h con los permisos del rol del empleado (caja incluida). El hash es `sha256(tenantId:pin:pepper)` determinista (`staff.service.ts:39-42`): ante una fuga de BD los PIN se recuperan al instante. *Fix:* lockout por dispositivo con backoff, PIN mínimo de 6 dígitos, hash lento (bcrypt/argon2 — el índice único `[tenantId, pinHash]` habría que sustituirlo por otro mecanismo de unicidad), y TTL del token de operador más corto.

**M-03 — `GET /api/metrics` público.** `api/src/ai/observability/metrics.controller.ts:17` marca el scrape de Prometheus como `@Public()`. Expone volumen de uso por feature, distribución de planes, tasas de error y latencias a cualquiera en Internet. *Fix:* bearer token de scrape o restricción de red.

**M-04 — Rate limiting parcial y mal anclado.** `ThrottlerGuard` no está registrado globalmente: solo lo llevan auth, devices y staff. Reportes, búsquedas, exportaciones y todo el CRUD no tienen límite. Además el store es en memoria (los límites no se comparten entre instancias) y `main.ts` **no configura `trust proxy`**, así que detrás de Cloudflare/nginx `req.ip` es la IP del proxy: el límite de 5/min de login se comparte entre *todos* los usuarios de la plataforma — a la vez una negación de servicio autoinfligida y un límite sin valor defensivo. *Fix:* `app.set('trust proxy', 1)`, `ThrottlerGuard` global con un default holgado, y storage en Redis.

**M-05 — Endpoint público de pedidos de tienda sin freno ni validación.** `POST /api/store/orders` (`@Public()`, sin `ThrottlerGuard`) acepta `items[]` sin `ArrayMaxSize`, `name` sin `MaxLength` y `price` elegido por el cliente (`store-order.dto.ts:18-35`). Cualquiera en Internet puede inundar la bandeja de pedidos de un tenant con contenido arbitrario, y si el administrador confirma el pedido esos precios entran a la contabilidad y el stock se descuenta. *Fix:* throttle por IP, `@ArrayMaxSize(100)`, `@MaxLength(300)`, y recalcular precios desde el catálogo al confirmar.

**M-06 — Observabilidad de seguridad casi inexistente.** El catálogo de `AuditAction` (`audit.service.ts:7-42`) cubre bien RBAC, caja e inventario, pero **no incluye ningún evento de autenticación**: no se registran logins exitosos ni fallidos, bloqueos de cuenta, cambios de contraseña, altas/bajas de MFA, vinculación de Google ni emisión de tokens de enrolamiento. Y `AllExceptionsFilter` (`http-exception.filter.ts:31-53`) responde 500 **sin escribir ningún log**, sustituyendo al logger por defecto de Nest: los errores de servidor son invisibles. Sin esto, ninguno de los ataques descritos en este informe sería detectable a posteriori. *Fix:* añadir las acciones de auth al audit log y loguear la excepción (con stack) en el filtro antes de responder genéricamente.

**M-07 — La red de seguridad de autorización no se ejecuta, y no hay CI.** `authorization-coverage.spec.ts` es un control excelente —recorre la metadata de Nest y falla si algún handler no declara cómo se autoriza— pero en este workspace **no puede correr**: `Cannot find module '@orbix/types'` (falta el enlace de workspace; `api/node_modules/@orbix` no existe y hay un `api/package-lock.json` que sugiere npm mezclado con pnpm). En total 31 de 79 suites no arrancan. No hay `.github/workflows` ni ninguna otra configuración de CI en el repositorio, así que nadie se enteraría. *Fix:* `moduleNameMapper` en la config de jest o reparar el link de pnpm; añadir CI que ejecute lint + test + `pnpm audit` y bloquee el merge.

**M-08 — `@Roles('SUPER_ADMIN')` no compone con el guard global: cinco endpoints inalcanzables.** `POST/GET/PATCH/DELETE /api/tenants` y `GET /api/tenants/:id` usan `@UseGuards(RolesGuard) @Roles('SUPER_ADMIN')`, pero `PermissionsGuard` es global y corre **antes**; al no encontrar `PERMISSIONS_KEY` cae en la rama fail-closed y devuelve `false` — sin llegar nunca al bypass de `SUPER_ADMIN`. Hoy eso es seguro (fallo cerrado), pero es una trampa: `GET /api/tenants` lista **todos** los tenants, y el arreglo intuitivo (`@NoPermissionsRequired()`) lo abriría a cualquier usuario autenticado. El test de cobertura, además, cuenta `@Roles` como declaración válida. *Fix:* hacer que `PermissionsGuard` reconozca `ROLES_KEY`, o migrar esos endpoints al plano platform (donde ya existen equivalentes) y eliminarlos.

**M-09 — Plano platform sin separación de roles ni segundo factor.** Todos los controladores de `modules/platform/*` llevan `@UseGuards(PlatformJwtAuthGuard)` a nivel de clase (correcto), pero **solo** `resetPassword` distingue `SUPER_ADMIN` de `SUPPORT`. Una cuenta de soporte puede aprovisionar tenants, cambiar planes y límites, emitir/suspender licencias y borrar dominios de cualquier cliente. No hay MFA, ni lockout por cuenta, ni revocación de tokens (sin blacklist ni refresh) en el plano más privilegiado. El patrón `@Public()` a nivel de clase + guard por ruta en `PlatformAuthController` es correcto hoy pero frágil: una ruta nueva sin `@UseGuards` queda totalmente abierta y el test de cobertura no lo detectaría. *Fix:* RBAC por `PlatformUserRole`, MFA obligatorio, lockout, y convertir el guard de platform en global para el prefijo `platform/`.

**M-10 — Dependencias vulnerables.** `pnpm audit`: **110 vulnerabilidades (1 critical, 42 high, 57 moderate, 10 low)**. La mayoría en tooling de build (expo-cli, jest, eslint, vite, astro), pero varias en dependencias de runtime del API:

| Paquete | Instalado | Parcheado | Sev. | Nota |
|---|---|---|---|---|
| `multer` | ^2.0.2 | ≥2.2.0 | high | DoS; en la ruta de subidas |
| `nodemailer` | ^8.0.1 | ≥9.0.1 | high | bypass vía opción `raw` |
| `sharp` | ^0.34.5 | ver aviso | — | decodifica imágenes no confiables |
| `ws` (vía puppeteer) | <8.21.0 | ≥8.21.0 | high | agotamiento de memoria |
| `tar` (expo-cli) | ≤7.5.18 | ≥7.5.19 | **critical** | solo build |

*Fix:* `pnpm update multer nodemailer sharp`, `pnpm audit --fix` para lo transitivo, y `pnpm audit` en CI con umbral `high`.

**M-11 — Autorización rancia en el token.** `JwtStrategy.validate` relee el usuario y valida el estado del tenant en cada request (bien), pero **no revalida la pertenencia**: `tenantId`, `tenantRole` y `branchId` se copian del token tal cual (`jwt.strategy.ts:85-91`). Si se revoca la `TenantMembership` o se pasa a `INACTIVE`, el token existente sigue operando en ese tenant hasta 24 h. Los permisos sí se invalidan bien vía `PermissionCacheService`, pero `tenantRole` (que en `dashboards`/`widgets` decide visibilidad) no. Los tokens de operador llevan los permisos embebidos y son inmunes a cualquier cambio de rol durante 12 h — el propio código lo documenta en `staff.service.ts:243-246`. *Fix:* verificar la membership en `validate` (una query más, ya se hacen dos) y acortar TTLs.

**M-12 — Configuración de release de Android no lista para Play.** Hay **tres** candidatos y ninguno está listo:

- `apps/mobile/orbix-app`: `app.json` no define `android.package` → el manifiesto generado usa `com.anonymous.orbixapp`. Bloqueador de publicación.
- `apps/mobile/orbix-mobile`: `com.orbix.mobile`, correcto.
- `apps/pos` (Flutter): scaffold, `signingConfig = debug` con TODO, sin permiso `INTERNET`.

Común a los dos Expo: `buildTypes.release { signingConfig signingConfigs.debug }` (default de `expo prebuild`; EAS lo sobreescribe, pero no hay `eas.json` en el repo); `android:allowBackup="true"` en el manifiesto de release, lo que permite extraer con `adb backup` los datos de `expo-sqlite` (el caché offline del POS) — SecureStore sí está excluido vía `secure_store_backup_rules`; `enableMinifyInReleaseBuilds` no está en `gradle.properties` → sin R8/ProGuard; y permisos excesivos (`RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE`) que además complican la declaración de Data Safety.

*Positivo:* tokens y `deviceToken` en `expo-secure-store` con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, nunca en AsyncStorage; **cero** `console.log` en `src/`; ningún secreto en el bundle (solo `EXPO_PUBLIC_API_URL` y client IDs de Google, públicos por diseño); `.env.production` apunta a `https://`; sin cleartext en release (targetSdk 36 lo bloquea por defecto).

*Fix:* definir `android.package`, crear `eas.json` con perfil de producción y keystore gestionado por EAS, `allowBackup=false` (o reglas explícitas para SQLite), activar R8, podar permisos, y decidir cuál de los tres apps se publica.

**M-13 — `role` sin validar en alta de miembro.** `POST /api/tenants/current/members/:userId` toma `@Body('role') role?: string` y lo castea `as any` (`tenants.controller.ts:186-190`). Un usuario con `users:create` puede fijarse a sí mismo `role: 'OWNER'` en `TenantMembership`. Impacto acotado: `TenantRole` solo se consulta en `dashboards.service.ts:26` y `widgets.service.ts:24` para visibilidad. El mismo endpoint acepta cualquier `userId` de la plataforma (ver L-07). *Fix:* DTO con `@IsEnum(TenantRole)` y prohibir la autoasignación de `OWNER`.

**M-14 — `NODE_ENV` gobierna dos controles de seguridad.** En `main.ts`, `NODE_ENV !== 'production'` (a) publica Swagger en `/api/docs` con el esquema completo del API y (b) **desactiva la CSP de helmet**. El `.env` local tiene `NODE_ENV=development`. Si el despliegue no fija `production` explícitamente, ambos controles caen. **NO VERIFICADO.** *Fix:* verificarlo antes de lanzar y, mejor, invertir la lógica (habilitar Swagger solo con un flag afirmativo tipo `ENABLE_SWAGGER=true`).

---

## 7. Low / Informational

| ID | Hallazgo | Archivo / nota |
|---|---|---|
| L-01 | `POST /devices/validate` devuelve el `deviceToken` durable a cambio del `deviceId`, sin ámbito de tenant (`findFirst({ deviceId })`) ni lockout por dispositivo. Hoy el `deviceId` es `Crypto.randomUUID()` en SecureStore (entropía suficiente), pero el DTO lo documenta como "fingerprint" no secreto: si una versión futura lo deriva del hardware, se vuelve una vulnerabilidad real. | `devices.service.ts:88-118` |
| L-02 | Bucket R2 con lectura pública (`R2_PUBLIC_URL`, sin URLs firmadas). Correcto para imágenes de tienda; se vuelve una fuga el día que se guarde un PDF fiscal o un documento. | `storage/r2.service.ts:47` |
| L-03 | Access + refresh token en `localStorage` del web (decisión documentada). Un XSS entrega una sesión de 30 días. Mitigado por la ausencia total de `dangerouslySetInnerHTML`. | `web/src/services/core/auth-service.ts` |
| L-04 | `PATCH /tenants/current/settings` es un merge-patch de claves arbitrarias (`Record<string, unknown>`, sin DTO → `forbidNonWhitelisted` no aplica). Permite escribir `logoUrl`/`bannerUrl` arbitrarios que se sirven en el storefront público. | `tenants.service.ts:345-354` |
| L-05 | Plantillas de correo de ticket/confirmación/bienvenida construidas con template literals sin escapar (nombre de cliente, `storeName`). *La plantilla de invitación sí escapa* (`escapeHtml`), que es la de mayor riesgo. | `email.service.ts:212-260` |
| L-06 | `GET /users/:id/effective-permissions` hace `findUnique({ id })` sin comprobar membership → oráculo de existencia de UUID de usuario. | `users.service.ts:462-468` |
| L-07 | `POST /branches/:id/members/:userId` no valida que el usuario pertenezca al tenant; luego `GET /branches/:id` devuelve `memberships.user` con correo y nombre → divulgación de PII cross-tenant (requiere el UUID). | `branches.service.ts:112-123, 57-70` |
| L-08 | CORS acepta cualquier `*.orbixmx.com` con `credentials: true`, más validación dinámica contra la tabla `Domain`. Un subdominio abandonado o tomado por un tercero se convierte en origen confiable. | `main.ts:52-66` |
| L-09 | `StoreDomainGuard` resuelve el tenant desde el header `Origin`/`Referer`, falsificable con curl. Impacto bajo (solo datos ya públicos), pero es un límite de confianza basado en un dato del cliente. | `store-domain.guard.ts:18-24` |
| L-10 | El ticket de desafío MFA se marca usado **antes** de validar el código: un dígito mal tecleado obliga a repetir el login. Endurece contra fuerza bruta, empeora la usabilidad. Los códigos de respaldo son `sha256` sin sal (40 bits de entropía, aceptable). | `mfa.service.ts:158-176` |
| L-11 | bcrypt con `SALT_ROUNDS = 10`. Funcional; el estándar actual es 12. | `common/utils/password.util.ts:4` |
| L-12 | Sin `MFA_ENCRYPTION_KEY`, la clave AES se deriva de `JWT_SECRET` — rotar uno rota el otro. El propio archivo lo documenta. | `config/mfa.config.ts:20` |
| L-13 | `WidgetsService.getData` hace `fetch` a sí mismo reenviando el `Authorization` del llamante. El SSRF está mitigado (ruta relativa `/api/`, sin `..`, sin `?`/`#`), pero es un patrón de proxy que conviene vigilar. | `widgets.service.ts:82-110` |
| L-14 | Sin `networkSecurityConfig` explícito en los apps Android (el default de targetSdk 36 ya bloquea cleartext). | manifiestos generados |
| L-15 | Sin CSP ni headers de seguridad para la SPA web: no hay `vercel.json`/`netlify.toml`/nginx en el repo, y `index.html` no lleva meta CSP. | `web/index.html` |
| L-16 | Folio de pedidos de tienda vía `count() + 1` con reintento sobre `P2002` (5 intentos). Funciona, pero no escala y no es un consecutivo fiscal. | `store-orders.service.ts:48-77` |
| L-17 | `puppeteer` como dependencia de runtime del API (generación de PDF de cotizaciones): Chromium en el servidor es una superficie amplia y arrastra el `ws` vulnerable. | `api/package.json` |
| L-18 | `POST /auth/register` es autoservicio sin verificación de correo: `emailVerified` solo se marca vía Google. Cualquiera crea cuentas con correos que no controla. | `auth.service.ts:63-82` |
| INFO | Sin SQL crudo (`$queryRaw*` no aparece), sin `child_process`, sin deserialización insegura, sin secretos en el árbol actual ni en el historial de git. Subidas limitadas por tamaño y tipo y **re-codificadas con `sharp`**, lo que neutraliza MIME spoofing y payloads embebidos. Todos los IDs son UUID v4. | — |

---

## 8. Multi-Tenant Security Assessment

**El aislamiento es sólido en el 90% de la superficie y está roto en un punto que lo compromete todo.**

Lo que está bien: el tenant nunca viene del cliente. `AuditContextInterceptor` lo empuja desde el JWT a un `AsyncLocalStorage`, y los servicios lo leen con `requireTenantId()` — que **lanza** si falta, en lugar de degradar silenciosamente. Encontré 246 usos. Los modelos llevan uniques compuestos (`@@unique([tenantId, sku])`, `[tenantId, orderNumber]`, `[tenantId, pinHash]`…). El patrón dominante en lecturas y escrituras por id es `findFirst({ where: { id, tenantId } })` y luego `update({ where: { id } })`, que es correcto. `OrdersService.create` valida explícitamente `customerId`, `productId`, `serviceId` y `sourceQuoteId` contra el tenant, con comentarios que explican por qué. `setRoles` rechaza roles de otro tenant comparando conteos.

Escaneé las 971 llamadas a Prisma del API: 480 no mencionan `tenantId` literalmente, pero la gran mayoría son escrituras anidadas bajo un padre ya validado, o modelos globales (`User`, `Permission`, `RefreshToken`). Revisando las de modelos sensibles una por una, los fallos reales se concentran en un patrón único: **ids de referencia que llegan en el body y se usan sin comprobar de quién son.**

Puntos débiles confirmados, en orden de gravedad:

1. **`InventoryConsumptionEngine` + referencias de combo/receta/comanda (C-01).** `product.findUnique({ id })`, `supply.updateMany({ id })` y `VariantInventoryResolver`, que además resuelve la sucursal del tenant *del producto*. Permite escritura cross-tenant. Es la brecha que hay que cerrar antes de exponer la plataforma.
2. **Inventario por sucursal (H-04).** `productId` sin validar; crea `ProductVariant` y `BranchInventory` sobre productos ajenos y devuelve sus datos.
3. **`branches.addMember` / `tenants.addMember` (L-07, M-13).** `userId` arbitrario de la plataforma; expone correo y nombre.
4. **Autorización rancia (M-11).** La membership no se revalida por request.
5. **`GET /api/tenants` (M-08).** Lista todos los tenants; hoy inalcanzable por fallo cerrado, pero es una bomba a un decorador de distancia.
6. **`StoreDomainGuard` (L-09).** El tenant de la tienda pública se decide por el header `Origin`.

No encontré ninguna fuga en reportes (`reports.service.ts` construye `baseWhere` con `requireTenantId()` en las 8 funciones), ni en dashboards, ni en CxC/CxP, ni en caja, ni en clientes, ni jobs en background sin contexto (no hay workers).

**Recomendación estructural:** activar Row-Level Security de PostgreSQL con `SET LOCAL app.tenant_id` por transacción. Las seis brechas de arriba dejarían de ser explotables incluso si el código olvidara el filtro — es la única defensa que no depende de que nadie se equivoque nunca.

---

## 9. Authentication Assessment

| Área | Estado | Detalle |
|---|---|---|
| Contraseñas | ✅ Correcto | bcrypt, cost 10 (subir a 12); `IsStrongPassword` propio; nunca se registran, ni siquiera hasheadas, en el audit log |
| Enumeración de usuarios | ✅ Correcto | `Invalid credentials` uniforme; cuenta OAuth sin password responde igual; `forgot-password` responde idéntico exista o no el correo; `verifyCloseAuth` usa `TIMING_SAFE_DUMMY_HASH` para evitar el oráculo de tiempo |
| Fuerza bruta | ⚠️ Parcial | Login: throttle 5/min + lockout por cuenta con backoff exponencial 5→60 min (bien). Pero el lockout **no** cubre las autorizaciones de caja (H-03) ni el PIN (M-02), y el throttle está anclado a la IP del proxy (M-04) |
| Access token | ⚠️ Débil | JWT HS256, `jti` presente, TTL 1 día (largo); no se invalida al cambiar contraseña (H-06); revocación solo en memoria por instancia |
| Refresh token | ✅ Muy bueno | Opaco, 48 bytes, solo el SHA-256 persiste, rotación en cada uso, y la reutilización de uno revocado quema toda la familia — detección de robo bien implementada |
| Reset de contraseña | ✅ Correcto | Token de un solo uso hasheado, TTL 1 h, invalida el anterior, revoca refresh tokens, limpia el lockout. Solo falta revocar el access token |
| MFA (TOTP) | ✅ Bueno | Opcional, secreto cifrado AES-256-GCM, activación en dos pasos (no bloquea a quien no escanea el QR), 8 códigos de respaldo, desactivar exige código válido, ticket de desafío de un solo uso |
| Google OAuth | ✅ Muy bueno | Auto-vinculación **solo** con `email_verified`; `state` empaquetado con allowlist estricta de redirects (documentado como anti-open-redirect); el JWT nunca viaja en la URL, solo un ticket de un solo uso de 120 s; flujo de vinculación separado del de login mediante `GoogleLinkTicket`, con rechazo explícito si la identidad de Google ya es de otra cuenta; `unlinkGoogle` bloqueado si no hay contraseña local |
| Separación de planos | ✅ Correcto | `PLATFORM_JWT_SECRET` distinto, claim `isPlatform` verificado, estrategia Passport separada. Un token de tenant no vale en platform ni al revés |
| Tokens de enrolamiento | ✅ Correcto | `typ: 'enroll'` rechazado explícitamente por `JwtStrategy`, un solo uso vía blacklist, TTL 10 min, requiere licencia válida |
| Verificación de correo | ❌ Ausente | Registro autoservicio sin confirmar el correo |
| Auditoría | ❌ Ausente | Ningún evento de autenticación se registra (M-06) |

**No encontré:** algoritmos inseguros (`none`, RS/HS confusion), secretos débiles en el `.env` local (46–55 caracteres), tokens en URLs, tokens en respuestas innecesarias, ni tokens en logs de aplicación — con la excepción de H-02, donde los *hashes* de token sí terminan en los logs de Prisma.

**Respuestas directas a las preguntas del brief:**

- *¿Un refresh token robado sirve indefinidamente?* No. Rota en cada uso y el reuso quema la familia.
- *¿Existe rotación y detección de reutilización?* Sí, ambas, bien implementadas.
- *¿Un usuario accede después de cambiar su contraseña?* **Sí**, con el access token, hasta 24 h (H-06).
- *¿Se invalidan las sesiones al cerrar sesión?* Solo en la instancia que atiende el request (H-06).
- *¿Account takeover vía OAuth?* No encontré camino. Los tres escenarios clásicos (email no verificado, open redirect en `state`, confusión login/vinculación) están cerrados explícitamente.

---

## 10. Mobile Security Assessment

Ver M-12 para el detalle. Resumen: **la implementación de la app es buena; el empaquetado no está listo.**

**Bien (MASVS-STORAGE / MASVS-CRYPTO):** tokens de sesión, `deviceToken` y `deviceId` en `expo-secure-store` (Keystore en Android) con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, nunca en AsyncStorage — hay comentarios explícitos al respecto. Cero `console.log` en el código fuente. `deviceId` es un UUID aleatorio, no un identificador de hardware.

**Bien (MASVS-NETWORK):** `.env.production` apunta a `https://api.orbix.app/api`; el `usesCleartextTraffic="true"` que aparece en los manifiestos solo está en las variantes `debug`; targetSdk 36 bloquea cleartext por defecto.

**Bien (MASVS-CODE):** ningún secreto real en el bundle. Solo `EXPO_PUBLIC_API_URL` y los client IDs de Google, que por definición son públicos y **no deben** considerarse secretos. El `client_secret` de Google vive solo en el `.env` del API. `expo.modules.updates.ENABLED=false` → sin canal OTA que comprometer.

**Pendiente:** `android.package` sin definir en `orbix-app` (bloqueador), release firmado con la keystore de debug por defecto y sin `eas.json`, `allowBackup=true` (los datos de `expo-sqlite` del POS offline salen con `adb backup`), sin R8/ProGuard, permisos excesivos, deep links por esquema propio (`orbix`/`orbixapp`) sin App Links verificados — cualquier app puede registrar el mismo esquema.

**¿`APK → decompile → secrets` es posible?** Sí se puede decompilar (Hermes sin minify), pero **no hay secretos que extraer**. La postura de "el secreto vive en el backend" está bien respetada. Lo que sí se extrae de un dispositivo con backup habilitado son los datos de negocio cacheados localmente.

---

## 11. API Security Assessment

50 controladores, ~320 handlers HTTP. El inventario completo es demasiado extenso para esta tabla; incluyo los endpoints más sensibles y los que sustentan hallazgos.

| Método | Endpoint | Auth | Permiso | Tenant | Sucursal | Riesgo |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | público | — | — | — | throttle 5/min + lockout ✅ |
| POST | `/auth/refresh` | público | — | — | — | rotación + detección de reuso ✅ |
| PATCH | `/auth/select-tenant/:slug` | JWT | ninguno | valida membership+licencia | — | ✅ |
| POST | `/platform/auth/login` | público | — | cross-tenant | — | throttle ✅, sin MFA ni lockout ⚠️ M-09 |
| PATCH | `/users/:id` | JWT | `users:edit` | membership | — | 🔴 **C-02** escala a SUPER_ADMIN |
| PUT | `/roles/:id/permissions` | JWT | `roles:edit` | sí | — | 🔴 **H-01** sin `assertActorCanGrant` |
| POST | `/orders` | JWT | `orders:create` | valida todos los ids ✅ | ALS | 🟠 **H-05** precio y paymentStatus del cliente |
| POST | `/restaurant/checkout/direct` | JWT | `orders:create` | ❌ `productId` sin validar | ALS | 🔴 **C-01** |
| POST | `/restaurant/orders/:id/items` | JWT | `comanda:view\|orders:create` | ❌ | ALS | 🔴 **C-01** |
| POST/PUT | `/products` (COMBO/receta) | JWT | `products:create/edit` | padre ✅ / hijos ❌ | — | 🔴 **C-01** |
| PATCH | `/branches/:id/inventory/:productId` | JWT | `branches:inventory` | sucursal ✅ / producto ❌ | sí | 🟠 **H-04** |
| POST | `/branches/:id/members/:userId` | JWT | `branches:manage` | sucursal ✅ / usuario ❌ | sí | 🟡 L-07 |
| POST | `/cash-sessions/:id/close-with-auth` | JWT | `pos.cash:close` | sí | sí | 🟠 **H-03** oráculo sin throttle |
| POST | `/receivables/:id/payments` | JWT | `receivables:*` | sí ✅ | sí | 🟡 **M-01** carrera de saldo |
| POST | `/staff/pin-login` | deviceToken | — | vía dispositivo | sí | 🟡 **M-02** PIN 4 dígitos |
| POST | `/devices/validate` | público | — | ❌ sin ámbito | — | 🟡 L-01 devuelve deviceToken |
| POST | `/devices/activate` | público | — | vía token/licencia ✅ | — | throttle 10/min ✅ |
| GET | `/store/products` | público | — | por `Origin` | principal | expone UUIDs (habilita C-01) |
| POST | `/store/orders` | público | — | por `Origin` | — | 🟡 **M-05** sin throttle ni topes |
| GET | `/metrics` | **público** | — | — | — | 🟡 **M-03** |
| GET/POST/... | `/tenants` (5 endpoints) | JWT | `@Roles` sin efecto | cross-tenant | — | 🟡 **M-08** inalcanzable (fail-closed) |
| ALL | `/platform/tenants/*` | platform JWT | sin distinción de rol | cross-tenant por diseño | — | 🟡 **M-09** |
| GET | `/api/docs` | según `NODE_ENV` | — | — | — | 🟡 **M-14** |

**Fortaleza transversal:** `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global corta el mass assignment de raíz — todos los casos que encontré son campos **declarados** en el DTO (`role`, `price`, `paymentStatus`), no propiedades colándose. La excepción son los dos endpoints que reciben `Record<string, unknown>` o `Partial<T>` sin clase DTO (`PATCH /tenants/current/settings`, `PATCH /tenants/current/info`), donde el whitelist no aplica. También se desactivó el ETag de Express a propósito para evitar 304 con datos de otro tenant — un detalle que casi nadie considera.

**No encontré:** endpoints de debug, de migración ni internos expuestos; métodos HTTP innecesarios; errores con stack trace (ambos filtros globales sanean la respuesta); paginación sin tope (`@Max(500)`).

---

## 12. Dependency Assessment

Ver M-10. `pnpm audit`: **110 vulnerabilidades — 1 critical, 42 high, 57 moderate, 10 low.**

Reparto: la superficie de runtime del API está relativamente limpia (`multer`, `nodemailer`, `sharp`, `ws` vía puppeteer, `uuid` vía exceljs). El grueso está en tooling que no se despliega: `@expo/cli` (tar critical, undici), `jest`, `@eslint/eslintrc`, `vite` (pos-web), `astro` (e-commerce, XSS low), `shell-quote`, `brace-expansion`, `js-yaml`.

No encontré señales de typosquatting ni scripts `postinstall` sospechosos. `pnpm.onlyBuiltDependencies` está definido explícitamente en la raíz, lo que es una buena práctica de supply chain: solo 10 paquetes tienen permitido ejecutar scripts de build.

---

## 13. Infrastructure Assessment

### ⚠️ NO VERIFICABLE con este repositorio

El repositorio **no contiene** Dockerfile, `docker-compose.yml`, manifiestos de Kubernetes, configuración de nginx/Traefik, IaC (Terraform/Pulumi), workflows de CI/CD (`.github/` no existe), ni configuración de hosting para el frontend. Cualquier afirmación sobre exposición de puertos, TLS, WAF, backups o segmentación de red sería inventada.

Lo que **sí** puedo afirmar desde el código:

| Componente | Estado |
|---|---|
| Base de datos | PostgreSQL (Neon) externa, vía `@prisma/adapter-pg` + `pg.Pool` sin TLS explícito en código → depende de `sslmode` en `DATABASE_URL` (el `.env.example` lo documenta con `sslmode=require`). Sin límite de pool configurado. 102 migraciones. |
| Redis / colas / RabbitMQ | **No existen.** Toda la caché es en memoria del proceso (blacklist de tokens, permisos, licencias). Esto implica que el sistema **hoy no es horizontalmente escalable de forma segura** (H-06, M-04). |
| Almacenamiento | Cloudflare R2, bucket de lectura pública, sin URLs firmadas. Claves de acceso en `.env`. Los ACL del bucket no son verificables desde aquí. |
| Panel de admin | Plano `platform/*` en el mismo proceso y puerto que el API de tenants. Sin restricción de red ni MFA. |
| Swagger | Gobernado por `NODE_ENV` (M-14). |
| `/metrics` | Público (M-03). |
| Secretos | En `.env` local, correctamente ignorados por git, ausentes del historial. La gestión en producción no es verificable — no hay integración con ningún gestor de secretos en el código. |
| CI/CD | **Inexistente en el repositorio** (M-07). |
| Backups | No verificable. |
| Contenedores | No aplica — no hay Dockerfile. |

**Verificación manual obligatoria antes de lanzar:** que la BD no acepte conexiones desde `0.0.0.0`, que `sslmode=require` esté en la cadena de producción, que el bucket R2 no permita `LIST`, que exista TLS con HSTS y redirección HTTP→HTTPS en el borde, que `NODE_ENV=production` esté fijado, que los logs no se envíen a un destino compartido (crítico dado H-02), y que exista una política de backups probada.

---

## 14. Missing Security Controls

1. **CI que ejecute los tests** — incluido `authorization-coverage.spec.ts`, que hoy no arranca (M-07).
2. **Row-Level Security en PostgreSQL** — la única defensa que hace irrelevante olvidar un `where tenantId`.
3. **Invalidación global de sesión por usuario** (`tokensValidFrom` / `tokenVersion`).
4. **Store de revocación y de rate limit compartido** (Redis) — sin él no se puede escalar a más de una instancia sin perder logout y throttling.
5. **Auditoría de eventos de autenticación** y logging de excepciones no controladas.
6. **MFA obligatorio y RBAC en el plano platform.**
7. **`assertActorCanGrant` en las rutas de rol** — el control existe, no está conectado ahí.
8. **Autoridad de precios en el servidor** y conciliación pago↔total.
9. **Claves de idempotencia** en checkout y registro de pagos.
10. **Validación de propiedad de referencias** (`childProductId`, `supplyId`, `productId`, `userId`) como regla sistemática, idealmente un helper compartido tipo `assertBelongsToTenant(model, ids)`.
11. **Rate limiting global** con `trust proxy` configurado.
12. **Verificación de correo** en el registro autoservicio.
13. **CSP y headers de seguridad** para la SPA web.
14. **Alertas** sobre eventos críticos (cambios de RBAC, descuadres autorizados, picos de 401/403).
15. **Retención y control de acceso de logs**, con redacción de datos sensibles.

---

## 15. Recommended Roadmap

### Antes del lanzamiento (bloqueadores)

1. **C-01** — Filtrar por tenant en `InventoryConsumptionEngine.loadProduct`, `supply.updateMany/findUnique` y `VariantInventoryResolver`; validar propiedad de `childProductId`, `supplyId` y el `productId` de comandas. Dejar los 5 tests en verde.
2. **C-02** — Eliminar `role` de `UpdateUserDto` y `CreateUserDto`.
3. **C-03** — Verificar en la BD de producción si existen `admin@ecommerce.com`, `owner@tienda-norte.com`, `owner@fashion-plus.com`; borrarlos. Blindar el seed contra `NODE_ENV=production`. Rotar `PLATFORM_ADMIN_PASSWORD` a ≥24 caracteres.
4. **H-01** — Añadir `assertActorCanGrant` en `RolesService.create/update/setPermissions`.
5. **H-02** — Condicionar `log` de Prisma por entorno; auditar y purgar logs; rotar secretos si ya se ejecutó en prod.
6. **H-03** — Throttle + lockout + chequeo de `status` en las autorizaciones de caja.
7. **H-04** — Validar `productId` contra el tenant en los tres endpoints de inventario por sucursal.
8. **H-05 (parcial)** — Rechazar órdenes donde `sum(payments) != total`; derivar `paymentStatus`/`status` en el servidor.
9. **M-12** — Definir `android.package`, crear `eas.json` con keystore de producción, `allowBackup=false`, activar R8, podar permisos. Decidir qué app se publica.
10. **M-14** — Confirmar `NODE_ENV=production`; verificar que `/api/docs` no responde en producción.
11. **M-07** — Reparar la resolución de `@orbix/types` en jest y montar CI mínimo (lint + test + audit).

### Primera semana

- **H-06** — `tokensValidFrom` por usuario; bajar `JWT_EXPIRES_IN` a 15–60 min; aplicar la blacklist también a tokens de operador.
- **M-01** — Escrituras relativas condicionadas en CxC/CxP y pagos de orden; idempotencia en checkout.
- **M-04** — `trust proxy`, `ThrottlerGuard` global, storage compartido.
- **M-03** — Cerrar `/metrics`.
- **M-05** — Throttle y topes de tamaño en `POST /store/orders`.
- **M-06** — Auditar eventos de auth; loguear excepciones en `AllExceptionsFilter`.
- **M-10** — Actualizar `multer`, `nodemailer`, `sharp`.
- **H-05 (resto)** — Permiso y auditoría para override de precio y descuento.
- **M-08** — Resolver `@Roles` vs `PermissionsGuard`.
- **L-07 / M-13** — Validar `userId` y `role` en los endpoints de alta de miembro.

### Primer mes

- **M-09** — RBAC y MFA en el plano platform; revocación de tokens de platform.
- **M-11** — Revalidar membership por request.
- **M-02** — Endurecer el PIN (6 dígitos, lockout por dispositivo, hash lento).
- Redis para caché de permisos, blacklist, licencias y rate limit — habilita escalado horizontal seguro.
- Verificación de correo en el registro.
- CSP y headers de seguridad para la web; revisar el comodín de CORS en `*.orbixmx.com`.
- bcrypt a cost 12; `MFA_ENCRYPTION_KEY` independiente.
- Escapar HTML en las plantillas de correo restantes.
- DTOs tipados para `settings` e `info` del tenant.

### Futuro

- **Row-Level Security en PostgreSQL** por `tenantId`.
- Helper `assertBelongsToTenant` + regla de lint que exija tenant en las queries de modelos tenant-owned.
- URLs firmadas en R2 para cualquier documento no público.
- Gestor de secretos (Vault / Doppler / SSM) y rotación programada.
- SIEM con alertas sobre cambios de RBAC, descuadres autorizados y picos de 403.
- Pentest externo, y bug bounty cuando el volumen lo justifique.
- Sacar puppeteer del proceso del API (servicio aislado de rendering).
- Extender el test de cobertura de autorización para exigir además validación de propiedad en los ids de referencia.

---

## 16. Matriz de riesgos

| ID | Sev. | Área | Vulnerabilidad | Impacto | Explotabilidad | Launch Blocker | Estado |
|---|---|---|---|---|---|---|---|
| C-01 | CRITICAL | Multi-tenancy | Inventario cross-tenant (motor + referencias) | Muy alto | **Alta** (UUIDs públicos) | YES | Confirmado (tests fallando) |
| C-02 | CRITICAL | Autorización | Escalamiento a `SUPER_ADMIN` vía `PATCH /users/:id` | Muy alto | **Muy alta** (1 request) | YES | Confirmado |
| C-03 | CRITICAL | Autenticación | Seed `admin123` / `SUPER_ADMIN`; admin platform 8 chars | Total | Alta si aplica | YES | **NO VERIFICADO en prod** |
| H-01 | HIGH | Autorización | Escalamiento vía permisos de rol | Alto | **Muy alta** | YES | Confirmado |
| H-02 | HIGH | Datos | Prisma loguea queries + params en prod | Alto | Requiere acceso a logs | YES | Confirmado |
| H-03 | HIGH | Autenticación | Oráculo de contraseñas sin throttle en caja | Alto | Alta (interno) | YES | Confirmado |
| H-04 | HIGH | Multi-tenancy | `productId` ajeno en inventario de sucursal | Medio-alto | Media | YES | Confirmado |
| H-05 | HIGH | Business logic | Sin autoridad de precios ni conciliación de pagos | Alto (fraude) | **Muy alta** (interno) | YES | Confirmado |
| H-06 | HIGH | Sesiones | Access token sobrevive cambio de contraseña; revoke local | Medio-alto | Media | NO | Confirmado |
| M-01 | MEDIUM | Concurrencia | Carrera de saldos en CxC/CxP y pagos | Medio | Media | NO | Confirmado |
| M-02 | MEDIUM | Autenticación | PIN 4 dígitos, sin lockout, hash rápido | Medio | Media | NO | Confirmado |
| M-03 | MEDIUM | Exposición | `/metrics` público | Bajo-medio | **Muy alta** | NO | Confirmado |
| M-04 | MEDIUM | Abuso | Rate limiting parcial, sin `trust proxy` | Medio | Alta | NO | Confirmado |
| M-05 | MEDIUM | Abuso | `POST /store/orders` público sin límites | Medio | **Muy alta** | NO | Confirmado |
| M-06 | MEDIUM | Monitoreo | Sin auditoría de auth; 500 sin log | Medio (detección) | — | NO | Confirmado |
| M-07 | MEDIUM | Proceso | Test de cobertura de authz no corre; sin CI | Medio | — | YES | Confirmado |
| M-08 | MEDIUM | Autorización | `@Roles` sin efecto; 5 endpoints muertos | Bajo hoy, alto si se "arregla" mal | — | NO | Confirmado |
| M-09 | MEDIUM | Autorización | Platform sin RBAC ni MFA | Alto | Baja | NO | Confirmado |
| M-10 | MEDIUM | Dependencias | 110 vulns (1 crit, 42 high) | Variable | Variable | NO | Confirmado |
| M-11 | MEDIUM | Autorización | Membership no revalidada por request | Medio | Baja | NO | Confirmado |
| M-12 | MEDIUM | Mobile | Release Android sin configurar | Medio | — | YES | Confirmado |
| M-13 | MEDIUM | Autorización | `role` sin validar en alta de miembro | Bajo | Alta | NO | Confirmado |
| M-14 | MEDIUM | Config | `NODE_ENV` gobierna Swagger y CSP | Medio | — | YES | **NO VERIFICADO** |
| L-01…L-18 | LOW | varias | ver §7 | Bajo | Variable | NO | Confirmado |

---

## 17. Los 30 escenarios de ataque

| # | Escenario | Protección | Dónde | ¿Backend? | ¿Bypass? | Riesgo |
|---|---|---|---|---|---|---|
| 1 | Leer recurso de Tenant B | `findFirst({id, tenantId})` sistemático | servicios (246 usos) | Sí | **Sí** — combo/receta expone la fila hija completa | 🔴 C-01 |
| 2 | Modificar recurso de Tenant B | ALS + `requireTenantId()` | interceptor + servicios | Sí | **Sí** — motor de inventario | 🔴 C-01 |
| 3 | Endpoint admin con permisos bajos | `PermissionsGuard` fail-closed | guard global | Sí | No | 🟢 |
| 4 | Modificar su propio rol | Ninguna en `PATCH /users/:id` | — | — | **Sí** | 🔴 C-02 |
| 5 | Modificar su `tenantId` | Nunca se lee del body; sale del JWT vía ALS | `AuditContextInterceptor` | Sí | No | 🟢 |
| 6 | Modificar su `branchId` | `selectBranch` valida `{id, tenantId, ACTIVE}` | `auth.service.ts:714` | Sí | No | 🟢 |
| 7 | Cambiar un precio desde el frontend | Ninguna — `price` es del cliente | — | — | **Sí, por diseño** | 🟠 H-05 |
| 8 | Alterar el total de una venta | El servidor recalcula… con los números del cliente | `orders.service.ts:118-196` | Parcial | **Sí** | 🟠 H-05 |
| 9 | Venta con datos inconsistentes | Sin validación pagos↔total | — | No | **Sí** | 🟠 H-05 |
| 10 | Doble checkout simultáneo | Sin idempotencia; stock sí es atómico | `inventory.engine.ts:189` | Parcial | **Sí** (2 órdenes) | 🟡 M-01 |
| 11 | Reutilizar un refresh token | Reuso → revoca toda la familia | `refresh-token.service.ts:66` | Sí | No | 🟢 |
| 12 | Usar un token expirado | `ignoreExpiration: false` | `jwt.strategy.ts:37` | Sí | No | 🟢 |
| 13 | Acceder tras cerrar sesión | Blacklist `jti`… en memoria por instancia | `token-blacklist.service.ts` | Parcial | **Sí** multi-instancia | 🟠 H-06 |
| 14 | Recuperar la cuenta de otro | Token de un solo uso hasheado, TTL 1 h | `password-reset.service.ts` | Sí | No | 🟢 |
| 15 | Abusar del reset de contraseña | Throttle 5/min, respuesta indistinguible, invalida el anterior | `auth.controller.ts:139` | Sí | No | 🟢 |
| 16 | Archivos de otro tenant | Claves `tenant-<id>/…` con UUID; bucket público | `r2.service.ts:64` | Parcial | Requiere la URL exacta | 🟡 L-02 |
| 17 | Subir un archivo malicioso | Tamaño + MIME + **re-codificación con sharp** | controladores de upload | Sí | No | 🟢 |
| 18 | SSRF a una URL interna | `endpoint` debe ser `/api/…`, sin `..`, sin `?`/`#` | `widgets.service.ts:82` | Sí | No | 🟢 |
| 19 | Endpoint sin rate limit | Solo auth/devices/staff lo tienen | `app.module.ts:60` | Parcial | **Sí** | 🟡 M-04 |
| 20 | Swagger/debug en producción | `NODE_ENV !== 'production'` | `main.ts:113` | Sí | Depende del despliegue | 🟡 M-14 |
| 21 | Extraer el APK buscando secretos | Nada sensible en el bundle | `.env` con `EXPO_PUBLIC_*` | N/A | No hay qué extraer | 🟢 |
| 22 | Decompilar buscando credenciales | Hermes sin minify, pero sin secretos | — | N/A | Solo la URL del API | 🟡 M-12 |
| 23 | Manipular deep links | Esquema propio, sin App Links verificados | manifiesto | — | Otra app puede registrar el esquema | 🟡 M-12 |
| 24 | Modificar requests con Burp | Validación completa en backend + `forbidNonWhitelisted` | `ValidationPipe` global | Sí | Solo campos declarados (#4, #7) | 🟠 |
| 25 | Saltarse restricciones del plan | `RequireModuleGuard`/`RequirePlanGuard` leen el plan del JWT firmado | guards | Sí | No (el plan solo cambia desde platform) | 🟢 |
| 26 | Usar funciones de otro plan | Igual que #25 | `require-module.guard.ts` | Sí | No | 🟢 |
| 27 | Exceder límites de usuarios/sucursales | `assertCanAddActiveUser` / `assertCanAddBranch` | `plan-limits.service.ts` | Sí | Carrera teórica en altas concurrentes | 🟡 |
| 28 | Manipular inventario | Guard atómico `stock >= -delta`; sin filtro de tenant | `inventory.engine.ts:189` | Parcial | **Sí, cross-tenant** | 🔴 C-01 |
| 29 | Manipular caja | Índice único parcial, claim condicional, `assertSessionOpen` en tx, autorización por permiso separado | `cash-sessions.service.ts` | Sí | El oráculo de contraseña del autorizador | 🟠 H-03 |
| 30 | Modificar saldos de CxC/CxP | Validación de monto vs saldo, tenant correcto | `receivables.service.ts:88` | Sí | Carrera de lectura-escritura | 🟡 M-01 |

**Resultado: 14 escenarios bien defendidos, 9 parcialmente, 7 explotables.** Los siete se concentran en tres causas raíz: referencias sin validar de propiedad, `role` mutable desde el tenant, y ausencia de autoridad de precios en el servidor.

---

## 18. La pregunta que importa

> *"Si publicamos Orbix mañana, ¿qué podría convertirse en un incidente de seguridad real?"*

Por orden de probabilidad:

1. **Un competidor con una cuenta gratuita lee los costos y márgenes de otro tenant, y le vacía el inventario** (C-01). No requiere habilidad especial: los UUIDs los publica el propio storefront. Es el incidente que destruye la confianza en un SaaS multi-tenant, y sería difícil de detectar porque no hay auditoría que lo delate.
2. **Un empleado con `users:edit` o `roles:edit` se hace administrador total** (C-02, H-01) y firma sus propios descuadres de caja. Esto pasará por accidente antes de que pase por malicia: cualquier dueño reparte `users:edit` sin pensarlo.
3. **Fuga de datos por logs** (H-02). Hashes de contraseñas, tokens y PIN, más datos personales y financieros, escribiéndose continuamente en el destino de logs que el proveedor de hosting tenga configurado. Es el hallazgo con mayor volumen de datos comprometidos y el más fácil de corregir: una línea.
4. **Merma inexplicable en el POS** (H-05). Un cajero cierra ventas marcadas como pagadas con $0 cobrado y la caja cuadra. Se descubre en el inventario físico, meses después, y sin trazabilidad de quién lo hizo.
5. **`admin@ecommerce.com` / `admin123`** (C-03), si el seed llegó a producción. Comprobación de cinco minutos, consecuencia total.
6. **Rate limiting que no funciona** (M-04). Sin `trust proxy`, el límite de 5/min de login se comparte entre todos los usuarios: el primer incidente probablemente no sea un ataque sino que **nadie pueda entrar** porque un usuario agotó la cuota global.

---

## 19. Fase 2 — Propuesta de remediación (no implementada)

Nada del proyecto fue modificado durante esta auditoría. Orden propuesto:

**Lote 1 — Aislamiento multi-tenant (C-01, H-04).** Añadir `tenantId` a `PRODUCT_LOAD_SELECT`, propagar el tenant por `loadProduct`/`resolveEffects`/`VariantInventoryResolver`, validar propiedad de `childProductId`/`supplyId`/`productId` en `ProductsService`, `RestaurantService`, `DiningOrdersService` y `BranchesService`. Criterio de aceptación: los 5 tests de aislamiento en verde y ninguna regresión en las 48 suites que hoy pasan. Es el lote con más riesgo de romper cosas, así que va primero y solo.

**Lote 2 — Escalamiento de privilegios (C-02, H-01, M-13).** Quitar `role` de los DTOs de usuario, conectar `assertActorCanGrant` en `RolesService`, DTO con enum para el `role` de membership. Añadir tests que prueben cada vía de escalamiento cerrada.

**Lote 3 — Datos y credenciales (H-02, H-03, C-03).** Condicionar el log de Prisma, throttle y lockout compartido en las autorizaciones de caja, blindar el seed. Incluye la verificación en la BD de producción, que requiere intervención manual.

**Lote 4 — Lógica de negocio (H-05).** Conciliación pagos↔total, `paymentStatus`/`status` derivados en servidor, permiso y auditoría para override de precio. Este lote cambia comportamiento visible del POS: conviene acordar antes las reglas exactas (¿se permite override de precio? ¿con qué tope de descuento?).

**Lote 5 — Sesiones y plataforma (H-06, M-04, M-03, M-06, M-07).** `tokensValidFrom`, `trust proxy`, throttler global, cerrar `/metrics`, auditoría de auth, reparar jest y montar CI.

**Lote 6 — Android (M-12).** Requiere decidir cuál de los tres apps se publica.
