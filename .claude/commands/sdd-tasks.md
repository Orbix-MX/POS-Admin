---
description: Descompone un spec aprobado en tareas con vía asignada
argument-hint: <id del spec, p.ej. INV-002>
---

Descomponer el spec **$ARGUMENTS** en tareas.

## Carga

Solo lo que falte en contexto:

1. `specs/**/$ARGUMENTS-*/spec.md`
2. `.specify/force-completo.md` — los triggers de escalada
3. `.specify/vias.md` — las tres vías y sus pasos
4. `.specify/templates/tasks.md`

`constitution.md` no entra aquí: lo que `/sdd-tasks` necesita de ella es `force_completo`,
y eso ya es su propio archivo. **No releas lo que ya está en este contexto.**

Delega en `plan-architect` — pásale las **rutas** del spec y de `force-completo.md`, no su
contenido resumido.

## Gate de entrada

El spec debe estar en `status: approved` y §11 debe decir "Ninguna". Si hay preguntas
abiertas, **para** y enséñalas: descomponer sobre un spec con huecos produce tareas que
hay que rehacer.

Si `depends_on` no está vacío, comprueba que esos specs estén en `status: implemented`. Si
no, dilo — las tareas se pueden escribir, pero no se pueden ejecutar todavía.

## Asignación de vía

Para cada tarea, **antes** de proponer la vía, mira qué archivos va a tocar y contrástalos
contra `force_completo`. Una coincidencia de ruta, símbolo o dominio la hace `completo`
sin discusión.

Entre `directo` y `simple`, elige `simple`.

## Contratos

Si el spec declara un endpoint nuevo o un cambio de schema, genera también
`contracts/` — DTO, fragmento de OpenAPI o delta de `schema.prisma`. Propuesta, no
aplicada.

## Salida

`tasks.md` junto al spec. Cada tarea con `via`, `covers`, `touches`, `status` y un
criterio de done verificable — no "funciona".

Reporta el reparto: cuántas de cada vía, y cuáles cayeron en `completo` por qué trigger.
