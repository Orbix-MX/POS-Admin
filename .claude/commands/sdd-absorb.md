---
description: Decide qué del spec cerrado pasa al vault de conocimiento
argument-hint: <id del spec>
---

Absorber **$ARGUMENTS** al vault.

Delega en `vault-curator`.

## Gate

El spec debe estar en `status: implemented` con `verify.md` en `result: pass`.

## Procedimiento

Aplica `brain/vault/AI/Commands/Actualizar documentacion tras un cambio.md` tal cual.
Clasifica el cambio primero: **la mayoría de specs no tocan el vault**, y ese es el
resultado correcto, no un fallo.

Toca el vault solo si:

| Qué pasó | Dónde |
|---|---|
| Regla de negocio nueva o modificada | `Domain/` |
| Módulo nuevo | índice `Modulos de <Sistema>` |
| Endpoint o contrato nuevo | "Puntos de entrada" del módulo |
| Integración o dependencia nueva | `Architecture/Integraciones` |
| Decisión estructural | ADR nuevo en `Decisions/` |
| El spec entregó una fase de un ADR existente | la sección "Estado de implementación" de ese ADR |

## Lo que NO va al vault

- El spec en sí. Vive en el repo, versionado con su código.
- Fragmentos de código.
- Lo que el repo ya documenta bien — se enlaza, no se transcribe.

## Reglas

- `updated:` en el frontmatter de cada documento tocado.
- Todo documento nuevo alcanzable desde `Inicio` o desde el índice de su sistema. Sin
  enlaces entrantes es invisible.
- "Requiere validación" en lo que no verificaste contra el código real.

## Salida

Llena la sección "Absorción al vault" de `verify.md`: qué documentos tocaste y por qué. Si
no tocaste ninguno, escríbelo con su motivo.
