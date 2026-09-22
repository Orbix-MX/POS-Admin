---
description: Crea un spec nuevo a partir de una idea, siguiendo la metodología SDD del repo
argument-hint: <idea del módulo o funcionalidad>
---

Crear el spec de: **$ARGUMENTS**

Este comando solo corre porque el usuario lo pidió. SDD no se activa por tamaño, riesgo ni
incertidumbre — esos ya los cubre la vía. El camino por defecto es `/odd`.

## Carga

Solo lo que falte en contexto, y en este orden:

1. `.specify/templates/spec.md` — la plantilla y sus comentarios
2. El vault, con `search_documents` — ¿existe ya un ADR o un documento de dominio que
   defina estas reglas? Si lo hay, el spec lo **cita** en `parent:` y en las BRs; no lo
   reescribe. Usa `read_document` solo sobre lo que de verdad vas a citar.
3. `.specify/constitution.md` — **por sección**, la que la idea toque. Se citan las reglas
   por id; no hace falta el archivo entero para escribir un spec.

**No releas lo que ya está en este contexto.**

Después delega en el agente `spec-writer` — pásale las **rutas**, no un resumen de la
plantilla ni de la constitución.

## Antes de escribir nada, decide si hay spec

No hay spec si no hay comportamiento nuevo observable, regla de negocio nueva ni cambio de
contrato. Un lote de correcciones es un `tasks.md` colgando de su ADR padre, o un trabajo
ODD. Dilo y para.

## Si el alcance tiene fases desplegables por separado

Son specs distintos, enlazados por `depends_on`. No un spec de 400 líneas con un `status`
que no puede ser verdad. Propón el reparto antes de escribir el primero.

## Salida

`specs/<vertical>/<ID>-<slug>/spec.md`, con:

- `status: draft` — nunca `approved` en la primera pasada
- §0 Alternativas descartadas si `depends_on` no está vacío
- Cada AC con su `Covers:`
- Un AC de aislamiento multi-tenant si toca datos
- §11 con las preguntas abiertas reales, no "Ninguna" por inercia

## Al terminar

Reporta: el id asignado, cuántos FR/BR/AC tiene, qué preguntas abiertas quedan y qué
reglas de la constitución le aplican con más fuerza. No lo marques `approved` — eso lo
hace el usuario.
