<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Categorías: `Added` · `Changed` · `Fixed` · `Removed`

---

### [Unreleased]

---

### [2026-05-31] — Unificación módulo de ventas (Retail + Restaurante)

**Added**
- `OrderOrigin` enum en schema: `RETAIL_POS`, `RESTAURANT_COMANDA`, `DELIVERY`, `KIOSK`, `ONLINE`
- Campo `orderOrigin` (nullable) en modelo `Order` — migración `20260531000000_add_order_origin`
- Helper centralizado `src/common/helpers/order-helpers.ts`: `isRestaurantOrder()`, `isRetailOrder()`, `getOrderOrigin()` con fallback a `tableNumber` para registros legacy
- `orderOrigin` en `QueryOrdersDto` para filtrar ventas por canal (`GET /orders?orderOrigin=RESTAURANT_COMANDA`)
- Split payments en `checkoutComanda`: acepta `payments[]` con `paymentMethod`, `currency`, `amount`, `amountReceived`, `changeGiven` — soporta pagos mixtos MXN/USD

**Changed**
- `POST /orders` (retail) ahora setea `orderOrigin: RETAIL_POS` automáticamente
- `POST /restaurant/comandas` ahora setea `orderOrigin: RESTAURANT_COMANDA` automáticamente
- `POST /restaurant/orders/:id/checkout` reemplaza `paymentMethod: string` por `payments: CheckoutPaymentDto[]`
- `GET /orders` acepta `orderOrigin` como query param de filtrado

---

### [2026-05] — Módulo de insumos y conversión de unidades

**Added**
- `Supply` model con `purchaseUnit` / `inventoryUnit` y factor de conversión
- Helper `safeConvertUnits()` para conversión automática en recetas y ajustes de inventario
- Soporte de combos y recetas en `Product` (tipo `RECIPE` y `COMBO`)

---

### [2026-05] — Módulo de imágenes de productos (Cloudflare R2)

**Added**
- `POST /products/:id/image` — upload con `sharp` → WebP, aislamiento por tenant en R2
- Limpieza automática de imagen anterior al subir nueva

---

### [2026-05] — Módulo Platform (Super Admin)

**Added**
- `PlatformUser` separado del flujo tenant, JWT `platform-jwt` independiente
- Endpoints `/platform/*` con `PlatformJwtGuard`
- Flujo de provisionamiento de nuevos tenants desde plataforma

---

### [2026-05] — RBAC y permisos

**Fixed**
- Bugs de `tenantId` en roles — consultas sin scope de tenant
- Endpoints sin guard expuestos públicamente
- Sidebar filtrado por permisos reales del usuario

---

### [2026-05] — Módulo de caja (Cash Sessions)

**Added**
- `CashSession` con apertura/cierre, `CashMovement` unificado para todos los orígenes (ventas retail, comandas, CxP, CxC, ingresos/egresos manuales)
- Corte de caja con diferencia y conteo físico

---

### [2026-04] — Módulo de compras y CxP

**Added**
- `PurchaseOrder` con líneas, recepciones parciales y estado
- `AccountPayable` con pagos a proveedores y vencimientos

---

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
