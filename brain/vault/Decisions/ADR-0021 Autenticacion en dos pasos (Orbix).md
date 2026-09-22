---
title: ADR-0021 Autenticacion en dos pasos (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-06
tags: [adr, orbix-erp]
---

# ADR-0021 — Autenticación en dos pasos: login → tenant → sucursal (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · módulo `core/auth` · **Fecha:** Requiere validación

## Contexto

Un mismo usuario puede pertenecer a más de un tenant y a más de una sucursal dentro de un
tenant. Un login de un solo paso no tiene forma de expresar "todavía no sé en qué
tenant/sucursal está operando este usuario".

## Decisión

El login se resuelve en tres llamadas: `POST /auth/login` devuelve un JWT preliminar (sin
`tenantId`) más la lista de `availableTenants`; `PATCH /auth/select-tenant/:slug` emite un
JWT con `tenantId`+`tenantRole`+`posOnly`; `PATCH /auth/select-branch/:branchId` añade
`branchId`.

## Evidencia

`api/CLAUDE.md`, `web/CLAUDE.md` (documentan el flujo de tres pasos explícitamente),
controllers de `core/auth`.

## Consecuencias

**Positivas**
- Un usuario con acceso a varios tenants puede elegir con cuál operar sin necesitar cuentas
  separadas por tenant.
- El JWT final siempre lleva el contexto completo (tenant + sucursal), evitando que cada
  request tenga que resolverlo de nuevo.

**Negativas**
- Tres llamadas en vez de una para completar el login — más estados intermedios que manejar
  en el cliente (JWT preliminar vs JWT completo).
- Cualquier cliente nuevo (la app POS, por ejemplo) debe implementar correctamente los tres
  pasos, no solo el primero.

## Notas

El campo `posOnly` en el JWT de selección de tenant sugiere una distinción de acceso
restringido para operadores de punto de venta — **requiere validación** el alcance exacto de
esta restricción.
