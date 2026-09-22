---
odd: <slug>
updated: <YYYY-MM-DD>
status: doing                # doing | blocked | done
via_max: simple              # la vía más alta del lote; la fija force-completo
entrega: preguntar           # preguntar | trocear | uno-solo — ver vias.md § Presupuesto
lineas_previstas: 0          # estimación al abrir; el conteo real vive en Progreso
---

# <Título del trabajo>

**Objetivo.** <Qué queda distinto cuando esto termine, en una o dos líneas. Resultado
observable, no actividad.>

**Por qué.** <El problema real. Si no se sabe, se pregunta antes de abrir tareas.>

**Alcance.** <Qué entra. Y explícitamente qué no, cuando hay ambigüedad.>

**Restricciones.** <Reglas de la constitución que aplican con más fuerza, por id: C-001,
C-005… Contratos publicados que no se pueden romper. Órdenes de despliegue.>

---

## Tareas

<!--
Vía asignada contra `.specify/force-completo.md`, no a ojo. Entre directo y simple, simple.
`touches` se llena antes de implementar y se corrige si el diff real difiere.
-->

### T-001 · <Título>

```
via:     simple              # directo | simple | completo
touches: retail/inventory
status:  todo                # todo | doing | blocked | done | escalated
ruta:                        # inline | delegado:<agente> — se llena al ejecutar
```

<Qué hay que hacer, en dos o tres líneas. Archivo y línea si ya se conocen.>

**Done cuando:** <criterio verificable, no "funciona">

**Evidencia.** Las tres, o la tarea no está cerrada:

- **Test:** `<comando exacto>` → `<resultado observado>`
- **Runtime:** `<curl o escenario con la app arrancada>` → `<resultado>`, o `N/A: <por qué no
  hay frontera de runtime>` — en vía `completo` el `N/A` casi nunca es correcto (C-021)
- **Rollback:** <qué archivos y qué comportamiento se pueden quitar sin arrastrar trabajo
  ajeno. Se escribe aunque todavía no haya commit.>
- **Commit:** `<SHA>` <mensaje>

---

### T-002 · <Título>

```
via:     completo
touches: core/permissions
status:  todo
ruta:
```

<...>

**Done cuando:**

**Evidencia.**

- **Test:**
- **Runtime:**
- **Rollback:**
- **Commit:**

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | simple | todo | | | |

**Entrega:** `<previstas>` previstas · `<reales>` acumuladas · umbral ~400 →
`<dentro | decidir>`

**Siguiente paso:** <una línea. Lo primero que hay que hacer al retomar esto.>

---

## Escaladas

<!-- Toda tarea reclasificada por force_completo, con el trigger exacto que coincidió. -->

| Tarea | De | A | Trigger |
|---|---|---|---|

---

## Hallazgos fuera de alcance

<!--
Lo que apareció y no se tocó. Encontrarlo no lo mete en el alcance: se anota y se sigue.
Si algo de aquí hay que arreglar, es otro trabajo.
-->

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|

---

## Revisión

<!-- Se llena en /odd-close. Profundidad según via_max: ver `.specify/rdd.md`. -->

**Candidato congelado:** `<SHA>` · `<fecha>` · normalizadores corridos **antes** del congelado

| Comprobación | Resultado |
|---|---|
| `pnpm run lint` | |
| `pnpm run build` | |
| suite del paquete tocado | |
| escalada: el diff no toca `force_completo` sin declararlo | |
| spot check: `<comando re-corrido del sub-agente>` | |

### Ledger

<!--
Esquema y reglas en `.specify/rdd.md` §3. Si el barrido no encontró nada, la tabla se deja
vacía con una línea que lo diga: "sin hallazgos" y "sin revisar" no son lo mismo.
Solo BLOCKER/CRITICAL entran al bucle de corrección; dos rondas como máximo.
-->

| id | Lente | Ubicación | Severidad | Estado | Evidencia |
|---|---|---|---|---|---|

**Rondas de corrección:** 0 / 2

<!-- Solo en vía `completo`: -->

Entorno: API en `:____`, tenant `____`, sucursal `____`.

| Comprobación con la app arrancada | Esperado | Resultado |
|---|---|---|
| <endpoint> con <caso válido> | 200 | |
| <endpoint> con recurso de otro tenant | 403 / 404 | |
| <endpoint> sin el permiso requerido | 403 | |

- [ ] `/security-review` — obligatorio si toca auth, permisos o tenant (C-007)
- [ ] Absorción al vault decidida — el resultado más frecuente y correcto es "nada"
