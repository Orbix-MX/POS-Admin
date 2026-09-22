---
title: Actualizar documentación tras un cambio
type: ai-command
owner: Requiere validación
updated: 2026-08-06
tags: [ai, comando, mantenimiento]
---

# Comando — Actualizar documentación tras un cambio

**Cuándo:** acabas de modificar código en Orbix ERP.
**Objetivo:** que el vault siga siendo cierto sin convertirse en un diario de commits.

## Procedimiento

1. **Clasifica el cambio.**

| Tipo de cambio                                 | Qué se toca en el vault                                    |
| ---------------------------------------------- | ---------------------------------------------------------- |
| Corrección de bug sin cambio de comportamiento | **Nada.**                                                  |
| Regla de negocio nueva o modificada            | El documento del proceso en `Domain/`                      |
| Módulo nuevo                                   | Índice `Modulos de <Sistema>` correspondiente              |
| Endpoint o contrato nuevo                      | "Puntos de entrada" del módulo afectado                    |
| Integración o dependencia nueva                | `Architecture/Integraciones` + el sistema correspondiente  |
| Decisión estructural                           | Un ADR nuevo en `Decisions/`, numerado tras el último de ese producto |
| Nada de lo anterior                            | **Nada.** No documentes por documentar.                    |

2. **Actualiza `updated:`** en el frontmatter de cada documento que toques.

3. **Enlaza**: todo documento nuevo debe ser alcanzable desde [[Inicio]] o desde el índice de
   su sistema. Un documento sin enlaces entrantes es invisible.

4. **Marca lo que no verificaste** con "Requiere validación" en lugar de suponer.

5. **Reporta** en tu respuesta qué documentos tocaste y por qué.

## Restricciones

- No copies fragmentos de código al vault.
- No dupliques lo que el repositorio ya documenta bien (por ejemplo,
  `orbix-admin/api/CLAUDE.md`): enlázalo o resúmelo, no lo transcribas entero.
- No borres un "Requiere validación" sin haber validado de verdad.
- Antes de dar por hecho el estado de un módulo, compara el documento de diseño contra el
  código real (`api/src/modules/<módulo>`). El código suele adelantarse a su
  documentación de diseño — ante duda, el código gana.

> Formato de los comandos de esta carpeta: **requiere validación**.
