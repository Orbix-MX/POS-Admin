---
title: Orbix ERP Web
type: system
owner: Requiere validación
updated: 2026-08-21
tags: [sistema, orbix-erp, frontend]
---

# Orbix ERP Web

## Responsabilidad

Interfaz web para la operación diaria de un tenant de Orbix ERP: ventas, inventario, caja,
compras, CxC/CxP, clientes, empleados, roles, reportes, y el panel de super-administración
("Platform"). No define reglas de negocio: las consume de [[Orbix ERP API]].

Desde 2026-08-19 el cobro en mostrador vive en un paquete aparte, [[Orbix POS Web]], que
**importa los servicios y stores de este proyecto** (`web/src`) en vez de duplicarlos: es
un consumidor de su código fuente, no solo de la API. Un refactor aquí puede romper el POS
sin aviso.

## Tecnologías

| Área | Elección |
|---|---|
| Plataforma | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS 4 |
| Estado | Zustand (no Redux) |
| HTTP | Axios, con interceptores en `api-client.ts` |

## Repositorio

`orbix-admin/web`, puerto 5173, alias `@/` → `src/`.

## Estructura

```
web/src/
  services/    <dominio>-service.ts — solo llamadas HTTP (core, platform, restaurant, retail)
  hooks/       use-<recurso>.ts — estado, CRUD, filtros, paginación
  pages/       <ruta>.tsx — solo renderizado
  store/       auth-store.ts, platform-auth-store.ts, erp-store.ts, operator-store.ts (Zustand)
  components/  shared/ (DataTable, Pagination, FormModal/FormField), por dominio
```

Patrón fijo por módulo: **service → hook → page**, documentado en `web/CLAUDE.md`.

## Módulos

No hay un índice separado: las páginas cubren 1:1 los módulos del backend — `dashboard`,
`ventas`, `pos`, `caja`/`caja-restaurante`, `inventario`, `insumos`, `compras`,
`proveedores`, `cxp`/`cxc`, `contabilidad`, `clientes`, `cotizaciones`, `servicios`,
`ordenes-trabajo`, `empleados`, `usuarios`, `roles`, `reportes`, `configuracion`,
`comanda`/`comanda-login`, `kitchen`, `dining-areas`, `restaurant-tables`, más `platform/`
para el panel super-admin.

## Dependencias

- [[Orbix ERP API]] — única fuente de datos.
- `@orbix/types` (`packages/types`) — tipos TS compartidos con la API.

## Integraciones

REST/JSON contra Orbix ERP API. Sin comunicación con otros sistemas.

## Riesgos y deuda

- Dependencia circular entre `api-client.ts` y `auth-service.ts` — funciona pero es frágil
  (documentado explícitamente en `web/CLAUDE.md`).
- `erp-store.ts` contiene placeholders sin terminar.
- `FormModal`/`FormField` no distinguen value/label en selects — limitación conocida,
  requiere un patrón manual por ahora.
