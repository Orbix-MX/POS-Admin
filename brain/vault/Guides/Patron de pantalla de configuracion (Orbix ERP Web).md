---
title: Patron de pantalla de configuracion (Orbix ERP Web)
type: guide
owner: Requiere validación
updated: 2026-08-22
tags: [guia, orbix-erp, web, configuracion]
---

# Patrón de pantalla de configuración (`orbix-admin/web`)

## Cuándo usar esta guía

Al construir cualquier categoría nueva dentro de `src/pages/configuracion.tsx` — el back-office
del tenant. Hoy la pantalla ya tiene secciones reales (Empresa, POS/Caja, Sucursales,
Restaurante, Impresoras, Panel de Permisos, Licencia y dispositivos) y dos placeholders sin
implementar (Facturación, Notificaciones). **Todavía no existe una sección de "Usuario"**
(perfil/preferencias del usuario logueado, distinta de "Empresa" que es config del tenant) —
si se agrega, sigue este mismo patrón.

Ver [[Orbix ERP Web]] para dónde encaja esto en el sistema completo. Existe una guía hermana
para la app móvil: [[Patron de pantalla de configuracion (Orbix Mobile)]] — mismo problema,
stack distinto (React Native + ODS vs React web), no comparten código.

## Estructura actual

Todo vive en un solo archivo, `src/pages/configuracion.tsx` (~1700 líneas): no hay una carpeta
`configuracion/` con un componente por sección como en otros módulos (comparar con
`src/pages/inventario.tsx` + `src/components/inventario/`). Cada sección es una función
`XSection()` declarada en el mismo archivo, o un bloque inline dentro del `switch` visual de
`Configuracion()` cuando es simple (Empresa, POS, Panel de Permisos).

- **Nav lateral fijo**, `sections: {id, label}[]`, filtrado por `enabledModules` del tenant
  (`showBranches`, `showRestaurant`) — una sección solo aparece si el módulo correspondiente
  está habilitado. `activeSection` es state local, no hay ruteo por URL (no se puede
  deep-linkear a una sección específica).
- **Un componente de sección por dominio con fetch propio**, ej. `SucursalesSection`,
  `PrintersSection`, `LicenciaSection`, `RestauranteSection` — cada uno hace su propio
  `useEffect`/`fetchX()` cuando `activeSection` coincide, no hay prefetch de todas las
  secciones al montar la pantalla.
- **Placeholder explícito para lo no implementado**: `facturacion`/`notificaciones` renderizan
  un bloque "Módulo en configuración" en vez de un componente vacío o roto — mismo principio
  que "Trampa conocida" en Mobile (nunca simular que una sección funciona).

## Decide dónde vive el dato antes de escribir UI

Tres orígenes ya establecidos, igual que en Mobile pero con nombres de servicio distintos:

1. **Endpoint tipado propio** → `src/services/core/tenant-service.ts` (`TenantInfo` vía
   `GET/PATCH /tenants/current/info`), `branches-service.ts`, `printers-service.ts`,
   `license-service.ts`, `users-service.ts`. Úsalo cuando el dato ya tiene su propia tabla/DTO
   en la API (sucursales, impresoras, licencia).
2. **`Tenant.settings` genérico** → `src/services/core/configuracion-service.ts`
   (`TenantSettings`, `GET/PATCH /tenants/current/settings`). Es un índice abierto
   (`[key: string]: unknown`) — tipa solo la clave nueva que agregas, y en el `PATCH` manda
   siempre un *patch* parcial (`Partial<TenantSettings>`), nunca el objeto completo que
   leíste, para no pisar claves que otra sección ya guardó ahí. Así están hechos
   `cashChangeCurrency`, `layawayRefundWindowHours` (sección POS) y
   `requireCounterReference` (sección Panel de Permisos) — mismo servicio, dos secciones de
   UI distintas.
3. **Preferencia local del navegador** (nunca vista todavía en esta pantalla — todo lo actual
   es por tenant). Si aparece una preferencia realmente por-usuario/por-dispositivo, no hay
   convención propia aquí; revisar primero cómo lo resuelve Mobile con `kvStorage` antes de
   improvisar una.

**Panel de Permisos vs Roles y Permisos**: la sección `permisos` de esta pantalla son
interruptores de *comportamiento de negocio* (ej. "pedir referencia al abrir una orden de
mostrador"), no control de acceso — eso es un módulo aparte (roles/RBAC). El texto de la
sección ya aclara esta distinción en la UI; no confundir al agregar una fila nueva.

## Pasos para agregar una sección

1. Decide el origen del dato (arriba). Si no hay ninguno de los tres, la entrada en `sections`
   se agrega igual pero apunta al placeholder "Módulo en configuración" hasta que exista el
   backend — nunca conectar a un endpoint que no existe.
2. Escribe la sección como función propia `XSection()` si tiene su propio CRUD/estado
   (patrón `SucursalesSection`, `PrintersSection`); si es un formulario simple con un solo
   `fetch`/`save`, puede ir inline en el `switch` de `Configuracion()` (patrón Empresa/POS).
3. Guarda con **guardado optimista + rollback** para toggles individuales (ver
   `handleSavePermiso`: aplica el cambio en state antes de la respuesta, revierte a
   `previous` si falla) — para formularios largos (Empresa, POS) el patrón es más simple:
   botón "Guardar cambios" explícito, sin optimismo.
4. Agrega la entrada a `sections` en `Configuracion()`, con el `id`/`label` y, si aplica, la
   condición de `enabledModules`.
5. Reutiliza los componentes de campo ya existentes en el archivo: `Field`, `ColorField`,
   `ToggleRow`, `BF` (form de sucursal) — no dupliques un input estilizado a mano.

## Verificación

- `npm run dev` en `orbix-admin/web`, entra a Configuración con un usuario con y sin
  `tenant:edit`/`tenant:branding` — varias secciones condicionan botones de guardar a estos
  permisos (`canEdit`, `canBranding`), y eso no lo cubre TypeScript.
- Prueba con un tenant sin el módulo `branches`/`restaurant` habilitado — la sección
  correspondiente debe desaparecer del nav, no solo del contenido.
- `npm run build` (`tsc -b && vite build`) y `npm run lint` limpios.

## Si no funciona

No hay implementación de referencia separada — el propio archivo `configuracion.tsx` es la
referencia; compara la sección nueva contra `SucursalesSection` (CRUD con modal + expand) o
contra el bloque `pos` inline (formulario simple con `Tenant.settings`) según cuál se parezca
más a lo que estás construyendo.
