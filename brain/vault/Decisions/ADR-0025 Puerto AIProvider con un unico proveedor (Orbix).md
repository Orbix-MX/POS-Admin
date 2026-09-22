---
title: ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-15
tags: [adr, orbix-erp, ia]
---

# ADR-0025 — Puerto `AIProvider` aunque la v1 tenga un solo proveedor (Orbix ERP)

**Estado:** Propuesta · **permanente** (no evolucionable: el resto de la plataforma de IA depende de ella)
**Ámbito:** Orbix ERP · `src/ai/providers/` · `src/modules/**` · **Fecha:** 2026-08-15
**Decisión D-16** del documento de arquitectura *Orbix AI Platform* (revisión 2).

## Contexto

La v1 tendrá un único proveedor de inferencia (local). El objetivo declarado de la plataforma
de IA es poder añadir proveedores después sin modificar los módulos de negocio. Introducir una
interfaz para un solo implementador es un costo que hay que justificar.

## Decisión

Los módulos de negocio dependen únicamente de `AiGatewayService`. La plataforma define el
puerto `AIProvider` (`chat`, `health`, `capabilities`, `supports`) y un `AiProviderRegistry`
que resuelve `id → instancia`.

La v1 entrega **dos** implementadores del puerto: `OpenAICompatibleProvider` (llama.cpp /
Ollama) y `MockProvider` (tests). Una abstracción con dos implementadores reales está
validada; con uno solo, es una suposición.

`src/modules/**` no puede importar `src/ai/providers/**`, `src/ai/config/**` ni
`src/ai/prompts/templates/**`. La restricción se aplica con `no-restricted-imports` de ESLint,
en CI.

## Consecuencias

**Positivas**
- La abstracción queda comprobada desde la Fase 1 por dos implementadores que pasan la misma
  suite de contrato.
- Añadir un proveedor futuro ocurre íntegramente dentro de `src/ai/`.
- Los tests del gateway y del Product Assistant corren sin un modelo real.
- La violación de la regla de dependencia rompe el build; no depende de revisión humana.

**Negativas**
- ~60 líneas de interfaz y registro que no aportan función visible al usuario en la v1.
- El enum de capacidades declara valores que ningún proveedor de la v1 usa (`STREAMING`,
  `TOOL_CALLING`, `VISION`, `EMBEDDINGS`); hasta que llegue un segundo proveedor pueden
  parecer código muerto.
- `chatStream` y `embed` quedan reservados en el contrato como métodos opcionales, sin
  implementación; un contrato con métodos opcionales es más fácil de malinterpretar.

## Alternativas descartadas

- **Sin puerto**, con `ProductAIService` llamando a un cliente HTTP de llama.cpp. Menos código
  hoy, pero al llegar el segundo proveedor obligaría a refactorizar todos los consumidores —
  exactamente lo que esta plataforma existe para evitar.
- **Gateway externo** (LiteLLM, OpenRouter). Normalizan proveedores, que es la parte fácil, y
  no resuelven nada de lo específico de Orbix: tenant, límites, prompts versionados,
  reconciliación de dominio ni registro de consumo. Añaden un salto de red y un proceso más
  que operar.

Relacionado: [[ADR-0024 Runtime de inferencia local llama.cpp (Orbix)]],
[[ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)]],
[[ADR-0027 Sin fallback entre proveedores en la v1 (Orbix)]].
