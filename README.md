# POS Admin — Orbix ERP

Monorepo NestJS 11 + Prisma 7 + React 19 + Vite. Multi-tenant, multi-sucursal, multi-vertical.

## Stack

| Capa | Tecnología |
|---|---|
| API | NestJS 11, Prisma 7, PostgreSQL (Neon) |
| Frontend | React 19, Vite, Tailwind CSS 4, Zustand |
| Storage | Cloudflare R2 (imágenes productos) |
| Auth | JWT (2-step: login → select-tenant → select-branch) |
| Package manager | pnpm (workspaces) |

## Inicio rápido

```powershell
pnpm install

# API (puerto 3001)
cd api && pnpm run start:dev

# Web (puerto 5173)
cd web && npm run dev
```

Variables de entorno requeridas en `api/.env`:
```
DATABASE_URL=
JWT_SECRET=
```

Variables de entorno requeridas en `web/.env`:
```
VITE_API_URL=http://localhost:3001/api
```

---

## Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Categorías: `Added` · `Changed` · `Fixed` · `Removed`

---

### [Unreleased]

---

### [2026-05-31] — Unificación módulo de ventas (Retail + Restaurante)

**Added**
- `OrderOrigin` enum: `RETAIL_POS`, `RESTAURANT_COMANDA`, `DELIVERY`, `KIOSK`, `ONLINE`
- Campo `orderOrigin` (nullable) en modelo `Order` — migración `20260531000000_add_order_origin`
- Helper centralizado `api/src/common/helpers/order-helpers.ts`: `isRestaurantOrder()`, `isRetailOrder()`, `getOrderOrigin()` con fallback legacy a `tableNumber`
- Filtro `orderOrigin` en `GET /orders` para filtrar ventas por canal
- Split payments en `POST /restaurant/orders/:id/checkout`: acepta `payments[]` con soporte MXN/USD y cambio
- Frontend: columna Origen y filtros por vertical en página Ventas, auto-detectados por `businessVertical` del tenant via `useTenantFeatures()`

**Changed**
- `POST /orders` (retail) setea `orderOrigin: RETAIL_POS` automáticamente
- `POST /restaurant/comandas` setea `orderOrigin: RESTAURANT_COMANDA` automáticamente
- Checkout de comanda migrado de `{ paymentMethod: string }` a `{ payments: CheckoutPaymentDto[] }`

---

### [2026-05] — Módulo de servicios y cotizaciones

**Added**
- Catálogo de servicios con precios y duración
- `ServiceQuote` con líneas mixtas (productos + servicios), PDF, estados y conversión a `Order`
- POS acepta items de tipo `SERVICE` además de `PRODUCT`

---

### [2026-05] — Módulo de insumos y conversión de unidades

**Added**
- `Supply` con `purchaseUnit` / `inventoryUnit` y factor de conversión automático
- Helper `safeConvertUnits()` centralizado para recetas y ajustes
- `ProductType` enum: `STANDARD`, `RECIPE`, `COMBO`, `SUPPLY`
- Descuento automático de insumos al vender productos tipo receta

---

### [2026-05] — Imágenes de productos (Cloudflare R2)

**Added**
- `POST /products/:id/image` — upload con `sharp` → WebP optimizado
- Aislamiento por tenant en bucket R2, limpieza de imagen anterior automática

---

### [2026-05] — Módulo Platform (Super Admin)

**Added**
- `PlatformUser` separado del flujo tenant con JWT `platform-jwt` independiente
- Endpoints `/platform/*` protegidos con `PlatformJwtGuard`
- Flujo de provisionamiento y gestión de tenants desde panel de plataforma

---

### [2026-05] — RBAC y permisos

**Fixed**
- Bugs de `tenantId` en consultas de roles (scope incorrecto)
- Endpoints expuestos sin guard
- Sidebar filtrado por permisos reales del usuario autenticado

**Added**
- `PermissionsGuard` global con caché 60 s por `userId:tenantId`
- Permisos granulares por módulo (`module:action`)

---

### [2026-05] — Módulo de caja (Cash Sessions)

**Added**
- `CashSession` con apertura, cierre, conteo físico y diferencia
- `CashMovement` unificado para todos los orígenes: ventas retail, comandas, CxP, CxC, ingresos/egresos manuales
- UI corte de caja con resumen por método de pago y moneda

---

### [2026-04] — Módulo de compras y Cuentas por Pagar (CxP)

**Added**
- `PurchaseOrder` con líneas, recepciones parciales y estados (`PENDING → PARTIAL → RECEIVED`)
- `AccountPayable` con pagos a proveedores, vencimientos y saldo pendiente

---

### [2026-04] — Módulo de cocina (Kitchen Display System)

**Added**
- Vista KDS para cocina: órdenes agrupadas por estado (`PENDING → IN_PROGRESS → READY → DELIVERED`)
- `PATCH /restaurant/kitchen/orders/:id/status` para avanzar estado de preparación
- Timestamps de inicio, listo y rechazo con comentario

---

### [2026-03] — Core multi-tenant

**Added**
- Arquitectura multi-tenant con `AsyncLocalStorage` (`TenantContextService`, `AuditContextService`)
- Flujo JWT en 2 pasos: `login → select-tenant → select-branch`
- `BusinessVertical` enum: `RETAIL`, `RESTAURANT`, `GYM`, `SERVICES`
- `TenantFeature` flags: `TABLES`, `KITCHEN`, `DELIVERY`, `MEMBERSHIPS`, `SERVICES`, `APPOINTMENTS`
- Límites de usuarios por plan (`FREE < STARTER < PRO < PLUS < ENTERPRISE`)
