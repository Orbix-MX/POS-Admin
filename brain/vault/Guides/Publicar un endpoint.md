---
title: Publicar un endpoint
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, api]
---

# Publicar un endpoint

## Cuándo usar esta guía

Vas a agregar un endpoint HTTP nuevo en Orbix ERP API.

## Requisitos

- El módulo de destino ya existe — si no, ver [[Crear un modulo]] primero.
- Conocer el contrato de API del sistema correspondiente.

## Pasos

### Orbix ERP API

1. El controller vive en el módulo Nest correspondiente (`core/`, `retail/`, `restaurant/`
   o `platform/`).
2. Protege el endpoint con `@RequirePermissions('modulo:accion')` — agrega el permiso a
   `permissions.constants.ts` si es nuevo. Usa `@Public()` solo si el endpoint debe ser
   anónimo (poco común).
3. Lee el tenant/sucursal activos siempre de `TenantContextService`
   (`tenantContext.requireTenantId()`), nunca de un parámetro del body.
4. Paginación estandarizada vía `ListResponse<T>` de `packages/types`.
5. Documenta el endpoint nuevo en [[Modulos de Orbix ERP API]].

## Verificación

- Swagger (`/api/docs` en Orbix ERP) refleja el endpoint nuevo.
- Un test e2e cubre al menos el camino feliz y un caso de error de autorización.

## Trampas conocidas

- Orbix ERP: olvidar `@RequirePermissions` dejaría el endpoint accesible a cualquier usuario
  autenticado del tenant, sin importar su rol.

## Si no funciona

Compara contra un endpoint existente del mismo módulo antes de improvisar el contrato.
