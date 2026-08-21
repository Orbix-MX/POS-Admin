# Orbix POS (`@orbix/pos-web`)

Punto de venta de Orbix como aplicación web independiente: **React + Vite +
TypeScript**. Se conecta al mismo backend que el Admin Web y reutiliza su
infraestructura en lugar de duplicarla.

Referencia visual: `Orbix POS.dc.html` del proyecto de diseño de Claude Design.
Tokens: proyecto `Orbix Design System` (`74bb2898-3850-43e9-be10-5ee3ebe51ceb`).

---

## Arrancar

```bash
pnpm install
cp .env.example .env          # VITE_API_URL debe apuntar al mismo API que el Admin Web

# desde la raíz del repo
pnpm dev:pos                  # API (@orbix/api) + POS

# o solo el POS
pnpm --filter=@orbix/pos-web dev
```

Web en `http://localhost:5174`. El API se espera en `http://localhost:3001/api`.

```bash
pnpm --filter=@orbix/pos-web build   # tsc -b && vite build
pnpm --filter=@orbix/pos-web lint
```

---

## Cómo reutiliza el Admin Web

El POS **no tiene servicios propios**. `vite.config.ts` y `tsconfig.app.json`
definen tres alias:

| Alias   | Apunta a        | Para qué                                                    |
|---------|-----------------|-------------------------------------------------------------|
| `~/*`   | `./src/*`       | Código propio del POS                                        |
| `@web/*`| `../../web/src/*` | Servicios, tipos y stores del Admin Web                    |
| `@/*`   | `../../web/src/*` | Obligatorio: los archivos de `web/src` se importan entre sí con este alias |

Todo lo que el POS consume del backend pasa por `src/services/orbix.ts`, un
barrel de reexports. **Si falta algo, se añade el reexport — nunca se escribe una
llamada `api.*` nueva dentro de este paquete.**

Reutilizado tal cual, sin copiar:

- `lib/api-client.ts` — axios con interceptores de token, 401 y `TENANT_SUSPENDED`.
- `store/auth-store.ts` — login, selección de tenant y sucursal, capabilities,
  permisos, logout. No hay store de autenticación paralelo.
- `services/core/auth-service.ts`, `caja-service.ts`, `clientes-service.ts`,
  `configuracion-service.ts`, `tenant-service.ts`, `print-service.ts`.
- `services/retail/product-service.ts`, `categories-service.ts`, `ventas-service.ts`.

Estado propio del POS (client state, no existe en el servidor):

- `stores/cart-store.ts` — carrito, cliente de la venta, descuento, suspendidas.
- `stores/cash-store.ts` — sesión de caja del turno, alimentada por el backend.

---

## Estructura

```
src/
├── app/
│   ├── providers/     AppProviders (arranque), NetworkStatusProvider
│   └── router/        AppRouter + guards (auth, sucursal, caja abierta)
├── components/
│   ├── ui/            Button, Input, Dialog, NumericKeypad, Toast (ports del DS)
│   └── shared/        Brand, Icon, StateBlock (loading / error / empty)
├── hooks/             use-catalog, use-customers, use-checkout, use-debounced
├── modules/
│   ├── auth/          Login, TenantSuspended
│   ├── session/       Selección de sucursal y estado de caja
│   ├── cash/          Apertura de caja
│   ├── pos/           Pantalla principal + Topbar, Nav, Catálogo, Carrito, diálogos
│   ├── checkout/      Cobro
│   ├── ticket/        Comprobante de la venta
│   └── shell/         Placeholder de secciones sin diseñar
├── services/          orbix.ts (barrel del backend), order-totals.ts (vista previa)
├── stores/            session-store, cash-store, cart-store
├── styles/            global.css + ds/ (tokens copiados del Design System)
└── utils/             money, api-error
```

---

## Flujo implementado

```
/login  →  /seleccionar  →  /caja/apertura  →  /pos  →  cobro  →  /ticket/:orderId
```

| Pantalla        | Endpoints                                                              |
|-----------------|------------------------------------------------------------------------|
| Login           | `POST /auth/login`, `PATCH /auth/select-tenant/:slug`, `GET /auth/me`, `GET /auth/me/capabilities` |
| Selección       | `GET /branches`, `PATCH /auth/select-branch/:id`, `GET /cash-sessions/active` |
| Apertura        | `POST /cash-sessions`                                                   |
| POS             | `GET /products`, `GET /categories`, `GET /customers`, `POST /customers`, `GET /tenants/current/settings` |
| Cobro           | `POST /orders`                                                          |
| Ticket          | `GET /orders/:id`, `POST /printer-configs/receipt-data`, `GET /tenants/current/info` |

Atajos: **F2** enfoca la búsqueda, **F4** abre el cobro, **Enter** en el buscador
agrega la coincidencia única (comportamiento de escáner de código de barras),
**Enter** en el cobro confirma, **Esc** cancela.

---

## Design System

Los tokens de `src/styles/ds/` son copia literal del proyecto de diseño
(`tokens/colors.css`, `typography.css`, `spacing.css`, `shadows.css`). Los
componentes de `components/ui/` son ports TypeScript de los `.jsx` del design
system, con las mismas variantes y medidas.

No se introducen colores, escalas de espaciado ni tipografías fuera de esos
tokens. El POS no usa Tailwind: el diseño está trazado con estilos sobre las
variables CSS del design system, y montar una segunda capa de utilidades sobre
ellas duplicaría el sistema en vez de reutilizarlo.

Adaptación por ancho (`global.css`): 1440 es el trazo original; a partir de 1439px
y 1279px el panel de venta cede ancho, y por debajo de 1023px la navegación pasa a
horizontal y el carrito se coloca bajo el catálogo. Los controles conservan su
altura táctil en todos los cortes.

---

## Alcance de esta entrega

Implementado: el flujo de venta completo, conectado al backend real, sin datos
mock.

Pendiente (sin pantalla en el diseño de referencia): Inicio, Caja (movimientos,
arqueo, corte), Tickets (historial, detalle, devoluciones), Productos, Clientes y
Reportes. Esas rutas muestran un placeholder explícito que remite al Admin Web.

**Diferencias entre el diseño y las capacidades actuales del backend: ver
[`BACKEND-GAPS.md`](./BACKEND-GAPS.md).** Ninguna se resolvió inventando endpoints
ni modificando el backend.
