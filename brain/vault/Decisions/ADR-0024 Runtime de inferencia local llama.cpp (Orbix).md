---
title: ADR-0024 Runtime de inferencia local llama.cpp (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-15
tags: [adr, orbix-erp, ia]
---

# ADR-0024 — `llama-server` en producción, Ollama en desarrollo (Orbix ERP)

**Estado:** Propuesta
**Ámbito:** Orbix ERP · plataforma de IA (`src/ai/providers/openai-compatible/`) · **Fecha:** 2026-08-15
**Decisión D-05** del documento de arquitectura *Orbix AI Platform* (revisión 2).

## Contexto

La primera feature de IA de Orbix (Product Assistant) requiere inferencia en infraestructura
propia y salida estructurada validable contra un schema. La infraestructura inicial es un VPS
sin GPU. Los runtimes candidatos exponen protocolos distintos y garantías distintas sobre la
validez del JSON generado.

## Decisión

`llama-server` (llama.cpp) es el runtime de inferencia en producción; Ollama es el runtime en
las máquinas de desarrollo. Ambos se consumen a través del **mismo adaptador**
`OpenAICompatibleProvider`, parametrizado por `baseUrl`: el runtime es configuración, no
código.

El modelo se sirve en formato GGUF con cuantización `Q4_K_M`. La salida estructurada se
restringe con **gramáticas GBNF** derivadas del JSON Schema del feature, generadas en
`gbnf.builder.ts`.

## Consecuencias

**Positivas**
- Garantía sintáctica del decodificador: el modelo no puede emitir un token que rompa el
  schema. Es más fuerte que la garantía de cualquier proveedor cloud y es auditable.
- Corre en CPU, sin GPU, con métricas Prometheus nativas y control explícito de contexto,
  slots y KV cache.
- Un solo adaptador cubre producción y desarrollo; cambiar de runtime es cambiar una URL.

**Negativas**
- Hay que operar un binario propio (flags, systemd, actualizaciones) en lugar de un servicio
  gestionado.
- Ollama y llama.cpp pueden divergir de versión y producir comportamientos distintos entre
  desarrollo y producción; el conjunto de evaluación es la única red de seguridad frente a eso.
- El rendimiento en CPU limita la concurrencia útil a 2–3 invocaciones simultáneas.

## Alternativas descartadas

- **Ollama en producción** — es un envoltorio sobre llama.cpp: hereda sus límites y añade su
  propio retraso de versión, gestión opaca de carga y descarga (`keep_alive`) y menos control
  del batching. Se conserva en desarrollo por su ergonomía.
- **vLLM** — mejor throughput agregado, pero diseñado para GPU; sin VRAM es inviable.
  Descartado para la v1, no en absoluto: se reevalúa si existe una GPU.
- **TGI / TensorRT-LLM** — más peso operativo y más acoplamiento a hardware del que la v1
  justifica.

Relacionado: [[ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)]],
[[ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)]].
