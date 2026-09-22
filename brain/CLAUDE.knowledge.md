# Base de conocimiento (`brain/`)

<!--
  Este archivo se importa desde el CLAUDE.md de la raíz del repo con:
      @brain/CLAUDE.knowledge.md
  Está versionado: al editarlo aquí, todo el equipo recibe la regla con un `git pull`.
  No dupliques su contenido en el CLAUDE.md de nadie.
-->

El vault de `brain/vault/` documenta procesos de negocio, sistemas, arquitectura y
decisiones de Orbix ERP. Se consulta con las herramientas MCP `search_documents`,
`read_document` y `related_documents` (servidor `orbix-brain`).

## Consultar antes que leer código

**Antes de leer código** para responder preguntas de negocio, arquitectura o "cómo
funciona X", consulta el vault. Recurre al código solo si el vault no lo cubre —y
entonces dilo explícitamente y ofrece documentarlo.

Al buscar: la búsqueda usa AND implícito, así que 2-3 términos funcionan mejor que una
frase larga; el texto entre comillas invertidas no está indexado.

## Tras un cambio significativo

Aplica `brain/vault/AI/Commands/Actualizar documentacion tras un cambio.md`. En resumen:
clasifica el cambio primero —**la mayoría no debe documentarse**— y solo toca el vault si
cambió una regla de negocio, apareció un módulo o contrato nuevo, cambió una integración,
o se tomó una decisión estructural (entonces, un ADR). Un bug corregido sin cambio de
comportamiento no toca el vault.

Marca con "Requiere validación" lo que no hayas verificado, actualiza `updated:` en el
frontmatter, y enlaza el documento nuevo desde `Inicio` o desde el índice de su sistema:
un documento sin enlaces entrantes es invisible.

## Índice

Se reconstruye solo al terminar cada turno (hook `Stop`). Para forzarlo: `/refresh-knowledge`,
o `uv run --project engine brain index` desde `brain/`.

El índice (`.brain/index.db`) no se versiona: es una proyección desechable del vault y cada
quien construye el suyo. Borrarlo siempre es seguro.
