---
description: Abre o continúa un trabajo por la vía orgánica (el camino por defecto)
argument-hint: <objetivo, o el slug de un trabajo abierto>
---

Trabajo: **$ARGUMENTS**

## Carga

Solo esto, y solo lo que falte en contexto:

1. `.specify/odd.md` — el protocolo
2. `.specify/force-completo.md` — para asignar vía
3. `docs/odd/<slug>.md` si ya existe — entonces es continuación, no apertura

`vias.md` solo si alguna tarea sale `completo`. `constitution.md` no se carga entera: se
citan las reglas por id, y se lee la sección cuando una aplica de verdad.

No releas nada que ya esté en este contexto.

## Si es continuación

Lee el documento completo y reconcilia contra el código real antes de tocar nada. Lo que
el documento dice y lo que el árbol tiene pueden diferir: gana el código, y la diferencia
se anota. Reporta en qué tarea estabas y cuál es el siguiente paso.

## Si es apertura

### Clasifica primero

| Señal | Resultado |
|---|---|
| ≥2 pasos de implementación con sentido propio | documento ODD |
| un cambio entendido, reversible en un commit | **sin documento** — impleméntalo y ya |

Abrir documento para un cambio de una línea es el desperdicio que ODD evita. Dilo y sigue.

### SDD no se activa solo

Ni por tamaño, ni por riesgo, ni por incertidumbre. Si ves señales de que merecería spec
—fases desplegables por separado, contrato que fijar antes de codificar, varias sesiones
con más de un implementador— dilo **en una línea** y sigue en ODD. Solo el usuario cambia
el workflow.

### Escribe el documento antes de tocar código

`docs/odd/<slug>.md` desde `.specify/templates/odd.md`. Slug en kebab-case, corto.

Para cada tarea, antes de proponer la vía, mira qué archivos va a tocar y contrástalos
contra `force-completo.md`. Una coincidencia de ruta, símbolo o dominio la hace `completo`
sin discusión. Entre `directo` y `simple`, `simple`.

Un documento escrito después de implementar es una reconstrucción, no un registro.

## Salida

Una línea: documento creado, cuántas tareas, el reparto de vías, y cuáles cayeron en
`completo` por qué trigger. Si no hubo documento, di por qué.
