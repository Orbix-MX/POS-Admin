---
title: ADR-0028 Kill switch de gasto y segundo/tercer proveedor (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-16
tags: [adr, orbix-erp, ia]
---

> [!note] Addendum — 16 ago 2026, mismo día
> Dos hallazgos operativos posteriores a la implementación inicial, sin cambio de decisión:
> 1. **`gemini-2.5-flash` retirado del catálogo de Google para cuentas nuevas** (404 confirmado
>    en vivo con `verify-cloud-providers.ts`). El catálogo de modelos (`ai-model.catalog.ts`) se
>    corrigió a `gemini-3.7-flash` (tarifa vigente: $0.75/$3.75 por MTok, promocional hasta
>    31-dic-2026 — revisar antes de esa fecha). D-19 no cambia: sigue siendo el mismo
>    `OpenAICompatibleProvider`, solo cambió el id de modelo.
> 2. **Se probó re-enrutar `products.draft` a Gemini** (`evaluate-fase3.ts`, generalizado con
>    `AI_EVAL_BASE_URL`/`AI_EVAL_API_KEY` para apuntar a cualquier runtime OpenAI-compatible) para
>    comparar contra el baseline de Llama-3.2-3B. La corrida chocó con el **rate limit del tier
>    gratis** de la cuenta de Google (429 en 24/30 casos) y no dio evidencia de calidad
>    utilizable. **D-06 no se reabrió** — el binding se revirtió a `local` de inmediato. Repetir
>    la comparación requiere una cuenta de Google con billing/tier pagado.

# ADR-0028 — Kill switch de gasto y segundo/tercer proveedor: núcleo de Fase 4 (Orbix ERP)

**Estado:** Aceptada — implementada, con evidencia en el código
**Ámbito:** Orbix ERP · `src/ai/providers/anthropic/` · `src/ai/limits/ai-budget.service.ts` ·
`src/ai/gateway/ai-gateway.service.ts` · `src/ai/contracts/ai-error.ts` · **Fecha:** 2026-08-16
**Decisiones D-19, D-20, D-21** del documento de arquitectura *Orbix AI Platform* (revisión 2).

## Contexto

Fase 0–3 cerraron la plataforma sobre un único proveedor local, gratuito (D-06/D-07): sin
gasto real que contener, `AiBudgetService` quedaba deliberadamente sin construir (ver la
tabla "Eliminado" del documento de arquitectura). El documento fija una regla explícita para
cuando esto cambiara: **el kill switch de gasto entra en la misma entrega que el primer
proveedor de pago, no después**.

Se decidió habilitar **dos** proveedores de pago a la vez —Anthropic y Gemini-flash—, con
alcance **núcleo**: quedan disponibles y con tope de gasto activo desde el primer día, pero
sin routing multi-proveedor, fallback, circuit breaker ni BYOK (esos siguen diferidos, sin
disparador propio). Ninguna feature existente se re-enruta a cloud: `products.draft` sigue en
`local` — D-06 no se reabre.

## Decisión

**D-19 — Gemini reutiliza `OpenAICompatibleProvider`, sin adaptador propio.** La API de Gemini
expone una capa de compatibilidad OpenAI real
(`https://generativelanguage.googleapis.com/v1beta/openai/`, `Authorization: Bearer`, forma de
respuesta estándar — confirmado contra la documentación oficial de Google el 16 ago 2026). Se
registra como una instancia más en `AiProviderRegistry` (`ai.module.ts`), condicionada a
`GEMINI_API_KEY`, igual que `local` lo está a `AI_LOCAL_BASE_URL`. Solo Anthropic necesita
`AnthropicProvider` propio: su Messages API no es OpenAI-compatible — salida estructurada vía
*tool forcing* (`tools: [{name, input_schema}]` + `tool_choice: {type:'tool', name}`), mensajes
`system` en un campo aparte, no como turno.

**D-20 — Código de error nuevo, no reutilizar `AI_QUOTA_EXCEEDED`.** `AI_BUDGET_EXCEEDED` (429)
extiende `AiErrorCode` de seis a siete códigos. Cuota y presupuesto son conceptos distintos:
cuota limita a *un tenant*; presupuesto es el kill switch de *toda la plataforma*. El cliente
necesita poder distinguir "tu negocio alcanzó su límite" de "el servicio de IA está pausado".

**D-21 — El presupuesto se rehidrata al arrancar, no vive solo en memoria.** Un contador
puramente en memoria perdería el gasto acumulado del día si el proceso se reinicia — el kill
switch fallaría abierto justo cuando más importa. `AiBudgetService.onModuleInit()` consulta
`SUM(estimatedCostMicros)` de `ai_usage_events` del día y del mes en curso una sola vez al
arrancar, y desde ahí incrementa en memoria (mismo espíritu que D-09: sin Redis todavía, una
sola instancia de API).

El kill switch se basa en el **catálogo de modelos**, no en una lista de ids de proveedor:
`AiBudgetService.assertWithinBudget(modelKey)` solo actúa si
`getModelCatalogEntry(modelKey).costPerMTokMicrosIn/Out !== null`. Así `local`/`mock` quedan
exentos automáticamente, sin mantener una segunda lista de "qué proveedores cuestan dinero"
sincronizada a mano con el catálogo.

Se corrige además un hueco de contabilidad preexistente: `AiUsageRecorder.recordFailure`
fijaba `estimatedCostMicros: 0n` incondicionalmente, incluso en la rama `OUTPUT_INVALID`
—donde sí hubo dos intentos reales contra el proveedor, dos respuestas facturables—. Con un
proveedor gratuito esto no importaba; con uno de pago, un kill switch que no cuenta el gasto
de los intentos fallidos no es un kill switch real. Se corrige solo esa ruta; los fallos de
red/timeout siguen en `0n` porque ahí normalmente no hay tokens facturados.

## Consecuencias

**Positivas**
- Añadir Gemini costó una entrada de configuración, no una clase — D-16 (puerto `AIProvider`)
  demuestra su valor por segunda vez.
- El kill switch protege desde el primer minuto en que existe gasto real, sin ventana en la
  que un proveedor de pago corra sin tope.
- El código de error distinto (D-20) evita que el cliente confunda un problema de negocio del
  tenant con una pausa de toda la plataforma.

**Negativas**
- `AnthropicProvider` es un segundo protocolo de proveedor que mantener (el primero fue
  `OpenAICompatibleProvider`) — se acepta porque la Messages API no da alternativa.
- El tope de gasto es global, no por tenant: un tenant con uso legítimo alto puede verse
  bloqueado por el consumo agregado de otros. Aceptable para el alcance núcleo; una variante
  por tenant/plan queda para cuando el routing multiproveedor la necesite de todas formas.

## Alternativas descartadas

- **Un solo proveedor de pago en esta entrega** — el usuario pidió ambos a la vez; el costo
  marginal de Gemini fue casi cero gracias a D-19, así que no había razón para diferirlo.
- **Kill switch solo en memoria, sin rehidratación** — más simple, pero falla abierto tras
  cualquier reinicio del proceso; inaceptable para un control de gasto real.
- **Reutilizar `AI_QUOTA_EXCEEDED` para el presupuesto** — colapsaría dos señales que el
  cliente necesita distinguir (ver D-20).

Relacionado: [[ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)]],
[[ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)]],
[[ADR-0027 Sin fallback entre proveedores en la v1 (Orbix)]].
