---
title: ADR-0020 Multi-tenancy por columna tenantId y ALS (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-06
tags: [adr, orbix-erp]
---

# ADR-0020 — Multi-tenancy por columna `tenantId` + AsyncLocalStorage (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · toda la API · **Fecha:** Requiere validación (el motivo original
requiere validación — no se encontró un documento de diseño explícito, solo la
implementación consistente en el código)

## Contexto

Un ERP multi-tenant necesita aislar los datos de cada cliente sin duplicar infraestructura
por tenant (esquema o base de datos separada), manteniendo un único despliegue.

## Decisión

Cada modelo Prisma tenant-owned lleva una columna `tenantId`, reforzada con
`@@unique([tenantId, ...])`. El `tenantId` de la request activa se propaga sin pasarlo
explícito por cada capa vía `AsyncLocalStorage` (`TenantContextService`).

## Evidencia

`api/prisma/schema.prisma` (patrón `@@unique([tenantId, ...])` repetido en decenas de
modelos), `api/src/common/context/`, `api/CLAUDE.md` (lo documenta explícitamente como
patrón obligatorio).

## Consecuencias

**Positivas**
- Un único despliegue y esquema sirve a todos los tenants; escalar a un tenant nuevo no
  requiere provisionar infraestructura nueva.
- El aislamiento se refuerza a nivel de esquema (constraint único), no solo por disciplina
  de código.

**Negativas**
- Cualquier query que olvide filtrar por `tenantId` es una fuga de datos entre tenants —
  el patrón exige disciplina: los servicios deben usar
  `tenantContext.requireTenantId()`, nunca confiar en un `tenantId` recibido del cliente.
- Una migración de un tenant específico (por ejemplo, un backfill) siempre corre sobre la
  tabla completa, afectando potencialmente a todos los tenants si no se filtra con cuidado.

## Notas

Alternativas no documentadas explícitamente pero evidentemente descartadas por el diseño:
esquema por tenant, base de datos por tenant. El motivo exacto de por qué se prefirió el
modelo de columna compartida **requiere validación** — no hay un ADR o documento de diseño
original en el repositorio, solo la implementación consistente.
