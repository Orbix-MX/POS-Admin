---
title: ADR-0022 Zustand en lugar de Redux (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-06
tags: [adr, orbix-erp]
---

# ADR-0022 — Zustand como estado global del Web, no Redux (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · `web/` · **Fecha:** Requiere validación (el motivo original
requiere validación)

## Contexto

El frontend web necesita estado global compartido (sesión, tenant/sucursal activos, estado
de UI de operador) más allá del estado local de cada página.

## Decisión

Zustand, no Redux ni Redux Toolkit, para todo el estado global: `auth-store.ts`,
`platform-auth-store.ts`, `erp-store.ts`, `operator-store.ts`.

## Evidencia

`web/src/store/`, `web/package.json` (dependencia de `zustand`, ausencia de `redux`/
`@reduxjs/toolkit` en el código de aplicación — nota: `redux`/`react-redux` sí aparecen como
dependencias transitivas de otras librerías en `node_modules`, pero no se usan directamente
en `web/src`).

## Consecuencias

**Positivas**
- Menos boilerplate que Redux para el volumen de estado global que maneja el proyecto.
- Curva de aprendizaje más corta para el equipo.

**Negativas**
- Menor tooling de DevTools/ecosistema maduro comparado con Redux en proyectos que crecen
  mucho en complejidad de estado.
- `erp-store.ts` contiene hoy placeholders sin terminar — **requiere validación** si es
  deuda de la migración o simplemente trabajo en progreso.

## Notas

El motivo explícito de esta elección no está documentado en el repositorio — se infiere de
la implementación consistente. Si se encuentra el razonamiento original, actualizar este ADR.
