---
title: Separacion de datos por vertical (Orbix)
type: architecture
owner: Requiere validación
updated: 2026-08-17
tags: [arquitectura, orbix-erp, datos, multi-tenant, analisis]
---

# Separación de datos por vertical — análisis (Orbix ERP)

Análisis de la propuesta de partir la base de datos única de Orbix ERP en varias bases
—una por vertical de negocio (retail, POS, gym, restaurante)— con o sin microservicios.
Basado en medición del schema y del código de `orbix-admin/api` al 2026-08-17.

Decisión derivada: [[ADR-0029 Schemas de Postgres por dominio en lugar de bases separadas (Orbix)]].

## Resumen ejecutivo

La intuición de fondo es correcta: **hoy no hay fronteras internas y eso se está volviendo
difícil de sostener**. La solución propuesta —separar bases por vertical— resuelve el
síntoma equivocado y cuesta caro, porque *las verticales no son un eje de partición de los
datos*.

- **80 modelos** en un solo `schema.prisma` de **2 481 líneas**, un solo `PrismaClient`, un
  solo `DATABASE_URL`.
- **171 relaciones** entre modelos. De ellas **76 cruzan** las fronteras de dominio, y
  **62 de esas 76 (82 %) apuntan al núcleo transversal** (`Tenant`, `Branch`, `User`,
  `Customer`).
- Las aristas genuinamente *vertical → vertical* son **14**. Es decir: no existen verticales
  independientes; existe **un núcleo grande con verticales delgadas encima**.
- **91 usos de `$transaction`** atraviesan sistemáticamente esas fronteras (una venta toca
  venta + pago + caja + inventario + cuenta por cobrar en una sola transacción atómica).

Recomendación: **mantener una base y un monolito**, y comprar el orden con
**schemas de PostgreSQL por dominio** (`core`, `catalog`, `sales`, `cash`, `purchasing`,
`restaurant`, `services`, `platform`) + fronteras de código verificadas por test. Coste
bajo, sin perder atomicidad ni joins. Ver [[#Plan recomendado]].

## Lo que el código dice hoy

### Distribución real de los modelos

`api/src/modules/` está organizado por vertical (`core/`, `retail/`, `restaurant/`,
`platform/`), pero los **datos** no siguen ese corte. Agrupando los 80 modelos por dominio
de datos real:

| Dominio | Modelos | Ejemplos |
|---|---:|---|
| `core` (transversal) | 32 | `Tenant`, `User`, `Branch`, `Customer`, `Employee`, `Role`, `Permission`, `Dashboard`, `License`, `Device`, `AiUsageEvent` |
| `catalog` | 16 | `Product`, `Category`, `Supply`, `Recipe`, `ComboItem`, `Service`, `Coupon`, `BranchInventory`, `InventoryMovement` |
| `sales` | 9 | `Order`, `OrderItem`, `Payment`, `OrderRefund`, `ServiceQuote`, `StoreWhatsappOrder` |
| `cash` / finanzas | 8 | `CashSession`, `CashMovement`, `CashCount`, `AccountReceivable`, `AccountPayable` |
| `purchasing` | 5 | `Supplier`, `PurchaseOrder`, `PurchaseReceipt` |
| `restaurant` | 5 | `DiningArea`, `RestaurantTable`, `DiningOrder`, `DiningOrderItem`, `KitchenRound` |
| `services` (órdenes de trabajo) | 3 | `WorkOrder`, `WorkOrderAssignment`, `WorkOrderQuote` |
| `platform` (super-admin) | 2 | `PlatformUser`, `PlatformAuditLog` |

**Solo 5 de 80 modelos son exclusivos de una vertical de negocio** (los de restaurante).
Todo lo demás —incluidos `Product`, `Order`, `Employee`, `CashSession`— es compartido.

### Dónde cruzan las relaciones

Aristas de clave foránea que cruzan dominios (76 en total):

| Origen → destino | FKs | Naturaleza |
|---|---:|---|
| `catalog` → `core` | 18 | `tenantId`, `branchId`, auditoría (`createdById`) |
| `cash` → `core` | 13 | `tenantId`, `branchId`, `userId`, `customerId` |
| `sales` → `core` | 12 | `tenantId`, `customerId`, `branchId`, `userId` |
| `restaurant` → `core` | 9 | `tenantId`, `branchId`, `employeeId` |
| `purchasing` → `core` | 6 | `tenantId`, `branchId`, `userId` |
| `sales` → `catalog` | 6 | `OrderItem.productId`, `OrderItem.serviceId`, `Order.couponId` |
| `services` → `core` | 4 | `tenantId`, `customerId`, `userId` |
| `purchasing` → `catalog` | 2 | `PurchaseOrderItem.productId` |
| `cash` → `purchasing` | 2 | `AccountPayable.purchaseOrderId`, `.supplierId` |
| `restaurant` → `sales` | 1 | **`DiningOrder.orderId`** — el cierre de la comanda |
| `cash` → `sales` | 1 | **`AccountReceivable.orderId`** — la venta a crédito |
| `services` → `catalog` / `sales` | 2 | `WorkOrder.serviceId`, `WorkOrderQuote.serviceQuoteId` |

El único dominio con **cero FK hacia el resto** es `platform` (`PlatformUser`,
`PlatformAuditLog`). Es el único candidato real y actual a base separada.

### Transacciones que cruzarían la frontera propuesta

Con bases separadas, cada transacción que hoy es atómica se convertiría en una saga con
compensación. Las medidas en el código:

```
venta de mostrador (retail/orders + checkout, $transaction)
  order · orderItem · payment · cashMovement · accountReceivable · customer
  + inventoryMovement · branchInventory · product · supply · supplyMovement

cierre de comanda (restaurant/dining-orders, $transaction)
  diningOrder · diningOrderItem · kitchenRound · restaurantTable
  → order · orderItem                    (cruza restaurant → sales)

corte de caja (core/cash-sessions, $transaction)
  cashSession · cashCount · cashMovement · supply · supplyMovement · tenant
```

Bajo la partición propuesta (POS ≠ Restaurant ≠ Retail), **las tres se rompen**. La venta
—el camino crítico del producto, y el que no puede quedar a medias— es la más afectada.

### Reportes y dashboards

`core/reports` y `core/dashboards` consultan en la misma query `order`, `orderItem`,
`product`, `purchaseOrder`, `customer`, `serviceQuote`. Con bases separadas eso deja de ser
un join y pasa a ser composición en memoria o una réplica de lectura consolidada: más
código, más latencia, más consistencia eventual visible al usuario.

### La vertical "gym" todavía no existe

No hay módulo `gym/` ni modelos de membresía, check-in o acceso. Solo existen
`BusinessVertical.GYM` y las features `MEMBERSHIPS` / `ACCESS_CONTROL` en el enum
`TenantFeature`, sin comportamiento derivado. (`MembershipStatus` en el schema es el estado
del usuario dentro de un tenant, **no** una membresía de gimnasio.)

Separar la base "de gym" hoy sería diseñar la frontera antes que el dominio, que es
justo cuando las fronteras salen mal.

### El desorden real está en otro sitio

Medido en el código, el problema no es "todo en una base", sino la ausencia de barandales:

1. **Aislamiento de tenant manual.** `PrismaService` (`api/src/database/prisma.service.ts`)
   es un `PrismaClient` plano; el middleware de auditoría está comentado porque `$use`
   desapareció en Prisma 7 y no se migró a `$extends`. Hay **856 llamadas a Prisma** en
   servicios y **236 usos de `requireTenantId()`**: el filtro por `tenantId` depende de que
   cada autor lo recuerde en cada query. Un olvido es una fuga de datos entre clientes.
   *Esto es más urgente que cualquier separación de bases.*
2. **Sin frontera de código entre módulos.** Nada impide que un servicio de `restaurant/`
   escriba directamente en tablas de `retail/`; de hecho `dining-orders.service.ts` escribe
   `order` y `orderItem` en su propia transacción.
3. **Un solo archivo de 2 481 líneas** para 80 modelos.
4. **Logging `['query', 'info', 'warn', 'error']` activo sin condicionar por entorno** en
   `PrismaService` — ruido en producción y riesgo de filtrar parámetros en los logs.

Separar bases no arregla ninguno de los cuatro. Arreglarlos sí quita la mayor parte de la
sensación de "mezclado y sucio".

## Evaluación de las opciones

### A. Microservicios por vertical

**Descartada para el estado actual.** Un servicio por vertical exige que cada uno posea sus
datos; aquí las tres verticales comparten `Order`, `Product`, `Customer`, `Branch`,
`CashSession` e inventario. El resultado sería un *monolito distribuido*: los mismos
acoplamientos, ahora sobre la red, con latencia, sagas y fallos parciales.

Los criterios que justifican microservicios no se cumplen hoy: equipos independientes
(hay uno), ciclos de release distintos (uno), perfiles de escalado dispares, aislamiento de
fallo obligatorio. ~29 000 líneas de backend no lo justifican.

### B. Monolito con una base por vertical

**Descartada.** Conserva el despliegue simple pero paga casi todo el coste de los
microservicios en la capa de datos: sin FK cruzadas, sin joins, sin transacciones atómicas,
sin migraciones coordinadas. Además, la partición propuesta pone `orders` en dos bases (POS
y Restaurant), lo que **reabre [[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)]]**
y obligaría a duplicar cobro, pagos divididos, devoluciones, afectación de inventario y
movimiento de caja una vez por vertical — exactamente el problema que ese ADR resolvió.

Correcciones puntuales sobre el mapa propuesto, contrastadas con el schema:

| En la propuesta | En el código | Corrección |
|---|---|---|
| `users`, `roles`, `permissions` en **Retail** | usados por todas las verticales y por `platform` | son **core**, no de una vertical |
| `products` en Retail, `product_variants` en POS | `Product` + `ProductAttribute`/`ProductFeature` son un solo agregado; el restaurante vende los mismos productos vía `Recipe`/`ComboItem` | un solo **catálogo** transversal |
| `orders` en POS **y** en Restaurant | un `Order` único, distinguido por `OrderOrigin` | un solo dominio **sales** |
| `employees` en Gym | `Employee` lo usan `dining-orders` (mesero) y `work-orders` (técnico) | **core** |
| `supplies` en Restaurant | `Supply`/`SupplyMovement` los usa el motor de inventario de retail y el corte de caja | **catalog/inventario** |
| `quotes` en POS | `ServiceQuote` pertenece al flujo de servicios y se convierte en `Order` | **sales** |

### C. Monolito modular + schemas de Postgres por dominio

**Recomendada.** PostgreSQL permite agrupar tablas en schemas lógicos; Prisma lo soporta de
forma **GA desde 6.13** (el proyecto está en **Prisma 7.8**) con `schemas = [...]` en el
datasource y `@@schema("...")` por modelo. Se obtiene:

- separación visible y navegable del modelo de datos, por dominio;
- posibilidad de **permisos de base distintos por schema** (`GRANT` por rol);
- **sin perder** FK cruzadas, joins ni `$transaction` atómica;
- una migración mecánica y reversible (`ALTER TABLE ... SET SCHEMA`);
- y una frontera dibujada donde *después* se podría cortar de verdad, si algún día hace falta.

## Plan recomendado

Por orden de retorno sobre esfuerzo. Los pasos 1–2 son los que atacan el riesgo real.

**1. Aislamiento de tenant a prueba de olvidos.** Migrar `PrismaService` a
`$extends` (Prisma 7) con un extension `query` que inyecte `tenantId` desde
`TenantContextService` en todo modelo tenant-owned, y que **falle ruidosamente** si no hay
tenant en contexto. Alternativa o complemento: RLS en Postgres con `SET LOCAL app.tenant_id`.
Condicionar además el `log` de Prisma por `NODE_ENV`. *Esto se hace aunque no se separe nada.*

**2. Fronteras de código entre módulos.** Regla explícita: un módulo solo escribe en las
tablas de su dominio; lo demás pasa por el servicio dueño (`restaurant/` cierra comandas
llamando a un `SalesService`, no escribiendo `order`). Verificarlo con un test de
arquitectura (dependency-cruiser o un test que analice imports/uso de `prisma.<modelo>` por
carpeta) para que no se degrade en silencio.

**3. Partir `schema.prisma`.** Prisma 7 admite una carpeta `prisma/schema/` con varios
`.prisma`: `core.prisma`, `catalog.prisma`, `sales.prisma`, `cash.prisma`,
`purchasing.prisma`, `restaurant.prisma`, `services.prisma`, `platform.prisma`. Cero riesgo,
efecto inmediato sobre la legibilidad. 2 481 líneas → ~8 archivos.

**4. Schemas de Postgres por dominio.** Activar `schemas` en el datasource y anotar cada
modelo con `@@schema`, respetando el mapa de la tabla de dominios. Una migración de
`SET SCHEMA` por tabla. Después, `GRANT` diferenciado si se quiere endurecer.

**5. Extraer a base propia solo lo genuinamente desacoplado.** Candidatos reales, en orden:
`platform` (0 FK hacia el resto), `AiUsageEvent`/`AiUsageCounter` (telemetría, alto volumen,
tolerante a consistencia eventual), `AuditLog`. Nada de esto es una vertical de negocio.

**6. Diseñar `gym/` cuando exista.** Al implementar membresías/accesos, hacerlo como módulo
con su propio dominio de datos y **sin FK salientes salvo a `core`** — así, si algún día
justifica base propia, el corte ya está hecho. La misma disciplina aplica a cualquier
vertical nueva.

**Reevaluar la separación real cuando** se cumpla alguno: más de un equipo con releases
independientes, un tenant o vertical que exija aislamiento físico por contrato, o un perfil
de carga que no se resuelva con réplicas de lectura e índices.

## Evidencia

- `orbix-admin/api/prisma/schema.prisma` (80 modelos, 2 481 líneas, datasource sin `schemas`).
- `orbix-admin/api/src/database/prisma.service.ts` (cliente único, middleware de auditoría
  comentado, `log` sin condicionar).
- `src/modules/retail/orders/orders.service.ts`, `retail/checkout/order-checkout.engine.ts`,
  `retail/inventory/inventory.engine.ts`, `restaurant/dining-orders/dining-orders.service.ts`,
  `core/cash-sessions/cash-sessions.service.ts` — alcance de las `$transaction`.
- `src/modules/core/reports/reports.service.ts` — joins cross-dominio.
- Conteos (grep sobre `src/`, excluyendo `*.spec.ts`): 856 llamadas a Prisma, 236
  `requireTenantId`/`getTenantId`, 91 usos de `$transaction`, 0 `queryRaw`.
- Prisma 7.8 (`api/package.json`); multi-schema GA desde Prisma ORM 6.13.

## Relacionados

- [[Arquitectura general]] · [[Modulos de Orbix ERP API]] · [[Administracion Multi-tenant (Orbix)]]
- [[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)]]
- [[ADR-0029 Schemas de Postgres por dominio en lugar de bases separadas (Orbix)]]
