---
title: Arquitectura (resumen)
type: home
owner: Requiere validación
updated: 2026-08-06
tags: [orbix, arquitectura, panorama]
---

# Arquitectura — panorama

Vista de 10.000 metros. El detalle vive en [[Arquitectura general]].

## Idea central

El centro de gravedad es la **API** (`api/`, NestJS + Prisma), dueña de un modelo de datos
multi-tenant de ~90 entidades que cubre retail, restaurante, servicios y administración de
tenants; el frontend web y las apps son clientes de ese contrato.

## Piezas

### Orbix ERP

| Pieza | Rol en una frase |
|---|---|
| **Orbix ERP API** | Backend NestJS + Prisma, dueño del modelo multi-tenant y de las reglas de negocio. |
| **Orbix ERP Web** | SPA React/Vite para la operación diaria (ventas, inventario, caja, CxC/CxP…). |
| **Orbix POS App** | App Flutter tablet-first para el punto de venta físico. En rediseño arquitectónico, sin red/auth/persistencia todavía. |
| **Orbix Mobile App** | App Expo/React Native, scaffold inicial con soporte offline planeado (SQLite, NetInfo). |
| **Orbix Desktop** | Solo hay un build compilado en el repo; sin código fuente visible. **Requiere validación**. |
| **packages/orbix_design_system** | Design system Flutter compartido, consumido hoy por el POS App. |
| **packages/types** | Tipos TS compartidos entre la API, el Web y la app móvil Expo. |

## Cómo se hablan

El Web y las apps llaman a la API por REST/JSON con JWT Bearer, obtenido en un flujo de
**dos pasos** (login → seleccionar tenant → seleccionar sucursal). No hay mensajería entre
servicios ni gateway: es un único backend.

Detalle: [[Integraciones]] · [[Autenticacion]]

## Constantes

- PostgreSQL (hosteado en Neon) vía Prisma 7, con `@prisma/adapter-pg`.
- Aislamiento multi-tenant por columna `tenantId` + `AsyncLocalStorage` (`TenantContextService`),
  reforzado con `@@unique([tenantId, ...])` en cada modelo tenant-owned.
- Autorización en capas: `JwtAuthGuard` → `PermissionsGuard` (permisos `modulo:accion`,
  cacheados 60s), con `SUPER_ADMIN` como bypass total.
- Panel "Platform" (super-admin SaaS) usa un JWT y un guard completamente separados del flujo
  de tenant normal.

Ver [[Autenticacion]] y [[Autorizacion]].
