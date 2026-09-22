---
title: ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-15
tags: [adr, orbix-erp, ia]
---

# ADR-0026 — Binding `feature → modelo` en configuración, sin tabla de routing (Orbix ERP)

**Estado:** Propuesta · **temporal — vigente para la v1**; se reemplaza cuando exista un segundo proveedor
**Ámbito:** Orbix ERP · `src/ai/config/` · **Fecha:** 2026-08-15
**Decisión D-17** (y reformulación de **D-07**) del documento de arquitectura *Orbix AI Platform* (revisión 2).

## Contexto

Con un solo proveedor y una sola feature, no hay ninguna elección que hacer en tiempo de
ejecución. El requisito real es poder cambiar el modelo sin modificar los módulos de negocio.

## Decisión

Cada feature declara su proveedor, modelo, versión de prompt y parámetros en una constante:
`src/ai/config/ai-feature.binding.ts`, con override por variable de entorno. El catálogo de
modelos (`src/ai/config/ai-model.catalog.ts`) es igualmente una constante.

**No** existen en la v1 las tablas `ai_routing_policy` ni `ai_model_catalog`, ni resolución
por precedencia, ni candidatos ordenados, ni selección por plan o por clase de tarea.

**El proveedor de IA no es un atributo del plan comercial.** Los cinco planes (FREE, STARTER,
PRO, PLUS, ENTERPRISE) usan el proveedor local. El plan define límites de uso y qué features
están habilitadas, nada más.

## Consecuencias

**Positivas**
- Cero migraciones de routing en la Fase 1: solo se crean `ai_usage_events` y
  `ai_usage_counters`.
- Cambiar de modelo es una variable de entorno y un reinicio del proceso, sin tocar
  `ProductAIService` ni el gateway.
- La configuración vive en git, con revisión, `git blame` y rollback junto al deploy.

**Negativas**
- Cambiar de modelo exige reiniciar el proceso; no es un cambio en caliente.
- No hay override por tenant ni experimentación A/B.
- Cuando llegue el segundo proveedor habrá que introducir la tabla de routing y migrar el
  binding: trabajo que se acepta a cambio de no hacerlo hoy.

## Alternativas descartadas

- **Tabla de routing con precedencia `TENANT > PLAN > GLOBAL`** — la respuesta correcta para
  varios proveedores, pero en la v1 sería infraestructura (dos migraciones, un repositorio, un
  resolutor de precedencia y una caché) para grados de libertad que nadie usaría.
- **Proveedor como atributo del plan comercial** (`STARTER → local`, `PLUS → cloud`) — acopla
  la promesa comercial a la implementación técnica: si el modelo local resulta mejor, la
  escalera se invierte de sentido y el plan caro pasa a ofrecer lo peor.

Relacionado: [[ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)]],
[[ADR-0024 Runtime de inferencia local llama.cpp (Orbix)]].
