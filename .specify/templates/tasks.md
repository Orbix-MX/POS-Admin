---
spec: XXX-000
updated: <YYYY-MM-DD>
entrega: preguntar           # preguntar | trocear | uno-solo — ver vias.md § Presupuesto
---

# Tareas — <Nombre del spec>

Vías definidas en `.specify/vias.md`. Triggers de escalada en
`.specify/force-completo.md`.

`/sdd-tasks` propone la vía; se aprueba al aprobar este archivo. `/sdd-implement` la
ejecuta y solo puede subirla.

## Pronóstico de entrega

<!--
Lo emite `/sdd-tasks` al descomponer, con estas tres líneas exactas. Es una heurística de
planificación, no un criterio de aceptación: ver `.specify/vias.md` § Presupuesto de entrega.
-->

```
Líneas autoradas previstas:    <n>   (additions + deletions, sin generados)
Decisión antes de implementar: Sí | No
Trocear recomendado:           Sí | No
Riesgo de presupuesto (400):   Bajo | Medio | Alto
```

---

## T-001 · <Título>

```
via:     simple              # directo | simple | completo
covers:  FR-001, AC-001      # vacío solo si la tarea no implementa nada del spec
touches: retail/inventory
status:  todo                # todo | doing | blocked | done | escalated
ruta:                        # inline | delegado:<agente> — se llena al ejecutar
```

<Qué hay que hacer, en dos o tres líneas. Archivo y línea si ya se conocen.>

**Done cuando:** <criterio verificable, no "funciona">

---

## T-002 · <Título>

```
via:     completo
covers:  FR-002, BR-001, AC-002
touches: retail/products, core/branches
status:  todo
```

<...>

**Done cuando:**

---

## Escaladas

<!--
Toda tarea reclasificada se registra aquí con su motivo. Es el historial que dice si
las vías se están asignando bien o si /sdd-tasks es sistemáticamente optimista.
-->

| Tarea | De | A | Motivo |
|---|---|---|---|
