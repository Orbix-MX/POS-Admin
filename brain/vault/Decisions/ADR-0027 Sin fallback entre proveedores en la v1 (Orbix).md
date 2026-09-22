---
title: ADR-0027 Sin fallback entre proveedores en la v1 (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-15
tags: [adr, orbix-erp, ia]
---

# ADR-0027 — Sin fallback entre proveedores: error tipado y observable (Orbix ERP)

**Estado:** Propuesta · **temporal — vigente mientras exista un único proveedor**
**Ámbito:** Orbix ERP · `src/ai/gateway/ai-execution.service.ts` · `src/ai/schemas/` · **Fecha:** 2026-08-15
**Decisión D-18** del documento de arquitectura *Orbix AI Platform* (revisión 2).

## Contexto

Con un único proveedor no hay destino al que derivar una invocación fallida. Construir ahora
la maquinaria de fallback sería trabajo sin destino. La caída ya está cubierta por el
principio de que ninguna operación de negocio depende de la IA: el alta manual de productos
funciona idéntica sin el asistente.

## Decisión

Cuando el proveedor local falla, la invocación termina en un **error tipado, observable y
explicado**. No se intenta ningún otro proveedor.

Dentro del mismo proveedor: `AiExecutionService` reintenta como máximo **dos** veces ante
errores transitorios (timeout, 5xx, red), y `StructuredOutputService` repara como máximo
**una** vez una salida que no valide contra el schema.

Agotado eso, se devuelve uno de los errores tipados —`AI_FEATURE_DISABLED` (403),
`AI_QUOTA_EXCEEDED` (429), `AI_RATE_LIMITED` (429), `AI_PROVIDER_UNAVAILABLE` (503),
`AI_TIMEOUT` (504), `AI_OUTPUT_INVALID` (422)—, se incrementa la métrica correspondiente y
**se registra el evento de consumo con el estado del fallo**. `health()` alimenta la métrica
`ai_provider_up`, consultada cada 15 s. No hay circuit breaker en la v1.

## Consecuencias

**Positivas**
- No se construye lógica de fallback sin destino ni presupuesto de fallback sin gasto que
  contener.
- El cliente Flutter puede distinguir la causa y mostrar el mensaje correcto: sin conexión,
  límite alcanzado o asistente no disponible.
- La tasa de error es visible porque los fallos también escriben evento de consumo.

**Negativas**
- El servidor de inferencia es un **punto único de fallo** para la feature. Se acepta a
  conciencia: lo que se pierde es una aceleración, no una capacidad.
- Una caída del servidor deja la feature inutilizable hasta que se restablezca, sin
  degradación intermedia.

## Alternativas descartadas

- **Fallback automático a un proveedor cloud** — exigiría implementar un segundo proveedor,
  gestión de secretos y un tope de gasto, todo fuera del alcance de la v1.
- **Circuit breaker** — sin un destino alternativo, abrir el circuito solo cambia qué error se
  devuelve al usuario.

Relacionado: [[ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)]],
[[ADR-0024 Runtime de inferencia local llama.cpp (Orbix)]].
