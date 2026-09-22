---
title: Cómo usar este vault
type: ai-context
owner: Requiere validación
updated: 2026-08-06
tags: [ai, contexto, convenciones]
---

# Cómo usar este vault (para agentes)

Contexto operativo para cualquier IA que trabaje sobre **Orbix ERP** (repo
`orbix-admin`). Léelo **antes** de responder o de modificar código.

## Qué es este vault

Conocimiento **destilado** sobre Orbix ERP: procesos de negocio, sistemas,
arquitectura, decisiones y guías. No es documentación de API ni referencia de código.

## Jerarquía de verdad

Cuando el vault y el repositorio se contradigan, gana el repositorio. En orden:

1. **El código fuente** — la verdad de lo que el sistema hace hoy.
2. **La configuración** (`.env`, `prisma/schema.prisma`, `docker-compose.yml`) — reglas
   reales viven ahí.
3. **Este vault** — el porqué, los límites y las relaciones.
4. **Los `CLAUDE.md` / `AGENTS.md` del repo** — convenciones de trabajo.

Esta jerarquía existe porque un documento de diseño puede quedarse atrás del código que
describe. El vault refleja el código, no el documento desactualizado. Si detectas una
contradicción, **corrige el vault** y dilo explícitamente en tu respuesta.

## Reglas de lectura

- **"Requiere validación"** significa: *nadie ha confirmado esto*. No lo presentes como
  hecho ni construyas sobre ello sin advertirlo.
- Un enlace wiki hacia un documento que aún no existe es **conocimiento pendiente a
  propósito**, no un error.
- El área `Domain/` describe **procesos de negocio**; `Systems/` describe **implementación**.
  Una pregunta de negocio se responde con `Domain/`, no leyendo controladores.
- Los `Decisions/ADR-*` explican **por qué** algo es como es. Antes de proponer cambiar una
  decisión estructural, lee su ADR: puede que la alternativa ya se haya descartado.
- La numeración de ADR arranca en 0020: los anteriores pertenecen a otro producto y
  viven en su propio vault. El campo "Ámbito" de cada ADR lo deja explícito.

## Reglas de escritura

- Un documento = un concepto. Frontmatter obligatorio: `title`, `type`, `owner`, `updated`, `tags`.
- No documentes clases ni propiedades. Documenta responsabilidad, flujo y consecuencias.
- No copies comentarios del código: destílalos.
- Español para dominio y prosa.
- Si tomas una decisión estructural durante el trabajo, escribe un ADR con la plantilla.

## Cómo consultarlo

Este vault es indexable: si tienes las herramientas `search_documents`, `read_document`
y `related_documents` disponibles, **úsalas antes de leer archivos a mano**. Devuelven
resultados ordenados por relevancia, ignoran acentos y exponen el grafo de relaciones.

Dos límites que debes conocer: sirven lo que hay en el **índice**, así que si alguien
editó el vault y nadie ejecutó `brain index`, verás la versión anterior; y son de solo
lectura. Puesta en marcha en [[Usar Project Brain]].

## Puntos de entrada rápidos

| Pregunta                        | Empieza en                               |
| -------------------------------- | ----------------------------------------- |
| ¿Qué hace el negocio?           | [[Inicio]] → `Domain/`                   |
| ¿Dónde vive esta funcionalidad? | `Systems/<Sistema>` → `Modulos de <Sistema>` |
| ¿Por qué está hecho así?        | [[ADR]]                                  |
| ¿Cómo hago X?                   | `Guides/`                                |
| ¿Qué significa este término?    | [[Glosario]]                             |
