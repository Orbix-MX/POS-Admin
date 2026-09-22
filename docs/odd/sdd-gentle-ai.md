---
odd: sdd-gentle-ai
updated: 2026-09-21
status: doing                # doing | blocked | done
via_max: simple              # metodología y prompts; no toca código de producto
entrega: uno-solo            # documentación y prompts; sin frontera de despliegue
lineas_previstas: 850
---

# Absorber de gentle-ai lo que le falta al SDD/ODD de Orbix

**Objetivo.** Que el ciclo de Orbix deje de depender de la disciplina del agente en los cuatro
puntos donde hoy no hay nada que la sostenga: validación de lo que devuelve un sub-agente,
contabilidad de hallazgos de revisión, lentes de revisión que existan de verdad, y evidencia
obligatoria al cerrar una tarea.

**Por qué.** `rdd.md` nombraba las 4R y no había agentes que las implementaran; `agents.md`
decía a quién llamar pero no qué debe devolver; un sub-agente que cita un archivo inexistente
pasaba sin fricción; y nada exigía registrar el comando que se corrió ni la frontera de
rollback. gentle-ai resuelve los cuatro con mecanismos baratos, probados sobre sí mismo.

**Alcance.** `.specify/`, `.claude/agents/`, `.claude/commands/`, plantillas y el puntero de
`CLAUDE.md`. **No entra:** Engram ni store de artefactos múltiple, grafo de 8 fases,
renderizado multi-runtime, PRs encadenados, ni el enforcement en CI (T-008, T-009 quedaron
fuera por decisión del usuario). Justificación en
`docs/plans/ANALISIS-SDD-GENTLE-AI-2026-09-21.md` §4.

**Restricciones.** C-024 (nada se commitea sin permiso), C-025 (sin trailers de sesión),
C-027 (entregables en `.md` dentro de `docs/`). El presupuesto de contexto de `CLAUDE.md` manda
sobre el estilo de gentle-ai: se adoptaron mecanismos, no su prosa —de ahí que cada lente cite
`rdd.md` §3 en vez de repetir el contrato del ledger, como hace gentle-ai en sus cinco agentes.

---

## Tareas

### T-001 · Contrato de retorno del sub-agente (A1)

```
via:     simple
touches: .specify/agents.md, .claude/agents/{spec-writer,plan-architect,spec-verifier,vault-curator}.md
status:  done
ruta:    inline
```

Envelope de seis campos + cierre con Aprendizajes, definido **una vez** en `agents.md` §El
envelope de retorno. Los cuatro agentes SDD lo citan; no lo duplican.

**Done cuando:** los 4 prompts declaran el envelope y `agents.md` lo define una sola vez. ✔

**Evidencia.**

- **Test:** `grep -c 'envelope' .claude/agents/{spec-writer,plan-architect,spec-verifier,vault-curator}.md`
  → 1 en cada uno; `grep -n '^## ' .specify/agents.md` → `El envelope de retorno — obligatorio` en :53.
- **Runtime:** `N/A` — son prompts; su frontera de runtime es la sesión del agente, que se
  ejercita la próxima vez que se delegue.
- **Rollback:** quitar §El envelope de `agents.md` y el párrafo final de los 4 agentes. Nada
  más depende de ello.
- **Commit:** pendiente (C-024).

---

### T-002 · Gatekeeper del orquestador entre fases (A2)

```
via:     simple
touches: .specify/agents.md, .claude/commands/sdd-implement.md, .claude/commands/odd-close.md
status:  done
ruta:    inline
```

Cinco chequeos (contrato, artefacto, sin invención, sin drift, coherencia), un reintento con el
defecto concreto en el prompt, STOP al segundo fallo. Más el **spot check del padre**:
re-correr uno de los comandos que el sub-agente reportó.

**Done cuando:** `/sdd-implement` y `/odd-close` corren el gate antes de encadenar. ✔

**Evidencia.**

- **Test:** `grep -n 'Gatekeeper\|gatekeeper' .claude/commands/*.md .specify/agents.md` →
  `sdd-implement.md` §Gatekeeper, `odd-close.md` §3, `rdd-review.md` §3, `agents.md` :80.
- **Runtime:** `N/A` — se ejercita al primer `/sdd-implement` con delegación.
- **Rollback:** quitar §El gatekeeper de `agents.md` y las tres referencias en comandos.
- **Commit:** pendiente.

---

### T-003 · Las 4R como agentes reales + refutador (A4)

```
via:     simple
touches: .claude/agents/review-{riesgo,legibilidad,fiabilidad,resiliencia,refutador}.md
status:  done
ruta:    inline
```

Cinco prompts nuevos, de solo lectura. Riesgo carga C-001…C-009; Fiabilidad, C-016/C-021/C-022/
C-023; Resiliencia, C-010…C-015 y C-018/C-019. Cada uno declara **qué no reporta**, que es
donde se gana la precisión. Refutador con techo estructural: una tarea por revisión, nunca una
por hallazgo.

**Done cuando:** `/rdd-review` en vía `completo` puede despachar las 4 lentes y el refutador. ✔

**Evidencia.**

- **Test:** `ls .claude/agents/review-*.md` → 5 archivos; `grep -h '^name:'` → los 5 nombres
  coinciden con los que despacha `rdd-review.md:51` y con la tabla de `agents.md`.
- **Runtime:** `N/A` — se ejercita en el primer cierre de vía `completo`.
- **Rollback:** borrar los 5 archivos y revertir las 5 filas de la tabla de `agents.md` y el
  paso 3 de `rdd-review.md`.
- **Commit:** pendiente.

---

### T-004 · Ledger de hallazgos y presupuestos de revisión (A3)

```
via:     simple
touches: .specify/rdd.md, .specify/templates/verify.md, .specify/templates/odd.md, .claude/commands/rdd-review.md
status:  done
ruta:    inline
```

Esquema del ledger, puerta de precisión, piso de severidad (WARNING/SUGGESTION nunca bloquean
ni se re-revisan), presupuesto de convergencia de 2 rondas, presupuesto de barrido de 1 por
lente, y protocolo de refutación.

**Done cuando:** `rdd.md` §3 define identidad y estado de un hallazgo, y las dos plantillas
tienen la tabla. ✔

**Evidencia.**

- **Test:** `grep -n '^## ' .specify/rdd.md` → §3 pasó de `Admitir hallazgos` a
  `Registrar hallazgos`, §4 a `Corrección y convergencia`;
  `grep -n 'Ledger' .specify/templates/{odd,verify}.md` → presente en ambas.
- **Runtime:** `N/A`.
- **Rollback:** revertir `rdd.md` §3–§4 a la tabla "bloquea sí/no" y quitar la sección Ledger
  de las dos plantillas y el paso 3 de `rdd-review.md`.
- **Commit:** pendiente.

---

### T-005 · Orden de normalización antes del congelado (A5)

```
via:     directo
touches: .specify/rdd.md, .claude/commands/rdd-review.md, CLAUDE.md
status:  done
ruta:    inline
```

Los normalizadores que mutan la fuente corren **antes** del `git stash create`. Después, solo
comprobaciones de solo lectura. Sin tolerancia de "es solo el formateador".

**Done cuando:** `rdd.md` §1 lo dice, y `/rdd-review` lo ejecuta en su paso 1. ✔

**Evidencia.**

- **Test:** `grep -n 'lint --fix' .specify/rdd.md .claude/commands/rdd-review.md` → presente en
  ambos, antes del `git stash create`.
- **Runtime:** `N/A`.
- **Rollback:** quitar el párrafo de normalización de `rdd.md` §1 y de `rdd-review.md` §1.
- **Commit:** pendiente.

---

### T-006 · Evidencia obligatoria del work-unit commit (A7, A8, A9, A10)

```
via:     simple
touches: .specify/templates/odd.md, .specify/odd.md, .specify/agents.md, .claude/commands/odd-close.md
status:  done
ruta:    inline
```

Campos nuevos por tarea: test + resultado exacto, runtime o `N/A` justificado, frontera de
rollback, y `ruta:` declarada. Más el contrato de idioma reenviado al ejecutor, el log de
deduplicación de lanzamientos, y el cierre con Aprendizajes como entrada de `vault-curator`.

**Done cuando:** la plantilla ODD pide los campos y `agents.md` obliga a reenviar idioma y
aprendizajes. ✔

**Evidencia.**

- **Test:** `grep -n 'Rollback:\|ruta:\|Reenvía el idioma\|Log de lanzamientos'` → los cuatro
  presentes en `templates/odd.md`, `odd.md` §6 y `agents.md` §Delegación.
- **Runtime:** este mismo documento usa la plantilla nueva — los campos Test/Runtime/Rollback
  están llenos en las siete tareas.
- **Rollback:** revertir la plantilla y los dos párrafos nuevos de `odd.md` §6.
- **Commit:** pendiente.

---

### T-007 · Presupuesto de carga cognitiva de la entrega (A6)

```
via:     simple
touches: .specify/vias.md, .specify/templates/tasks.md, .specify/templates/odd.md
status:  done
ruta:    inline
```

~400 líneas autoradas como referencia, las tres líneas de guardia en texto exacto, y tres
estrategias (`preguntar` / `trocear` / `uno-solo`). **Advisory, no criterio de aceptación** —
igual que en el propio gentle-ai, cuyo gate está `"enforcement": "dormant"`.

**Done cuando:** la plantilla de tareas emite el pronóstico y `vias.md` dice qué hacer con él. ✔

**Evidencia.**

- **Test:** `grep -n 'Presupuesto de entrega' .specify/vias.md` → §nueva al final;
  `grep -n 'Pronóstico de entrega' .specify/templates/tasks.md` → presente.
- **Runtime:** el frontmatter de este documento declara `entrega: uno-solo` y
  `lineas_previstas: 850`.
- **Rollback:** quitar §Presupuesto de `vias.md` y los dos bloques de frontmatter/pronóstico
  de las plantillas.
- **Commit:** pendiente.

---

## Progreso

| Tarea | Vía | Estado | Ruta | Commit |
|---|---|---|---|---|
| T-001 | simple | done | inline | pendiente |
| T-002 | simple | done | inline | pendiente |
| T-003 | simple | done | inline | pendiente |
| T-004 | simple | done | inline | pendiente |
| T-005 | directo | done | inline | pendiente |
| T-006 | simple | done | inline | pendiente |
| T-007 | simple | done | inline | pendiente |
| T-008 | completo | fuera de alcance | — | — |
| T-009 | directo | fuera de alcance | — | — |

**Entrega:** ~850 líneas, todas de `.md` de metodología. El umbral de 400 es una heurística de
revisión de código; aquí se declara `uno-solo` y se explica: no hay frontera de despliegue que
trocear, y partir la adopción dejaría `rdd.md` citando agentes que no existen todavía.

**Ruta.** Las siete tareas fueron `inline`. Justificación: el material fuente de gentle-ai
—cinco prompts de revisión, el contrato de fase compartido, el gatekeeper— estaba en el
contexto del orquestador tras la exploración. Delegar la escritura habría exigido resumirlo,
y `agents.md` § Delegación lo prohíbe: *pasa rutas, no resúmenes*. La regla multi-archivo se
cumple por el otro lado: **un solo escritor**.

**Siguiente paso:** enseñar archivos y mensaje de commit, esperar el visto bueno (C-024).

---

## Escaladas

| Tarea | De | A | Trigger |
|---|---|---|---|

Ninguna. El diff no toca ninguna ruta ni símbolo de `force-completo.md`: son `.md` de
metodología, `.claude/` y `docs/`.

---

## Hallazgos fuera de alcance

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|
| `.codex/agents/*.toml` duplica a mano 3 prompts y arrastra `\r` incrustados; los agentes de SDD no existen ahí, y ahora tampoco las 5 lentes nuevas | `.specify/agents.md` § Duplicación con Codex | media — la decisión sigue pendiente; este trabajo la agranda pero no la abre |
| C-022 congela 5 fallos de `retail` tenant-isolation en prosa: nadie mide si mañana son seis | `.specify/constitution.md` | media — es T-008, quedó fuera de alcance |
| gentle-ai exige un issue aprobado antes de cualquier PR; Orbix no tiene ese gate | — | baja — es T-009, quedó fuera de alcance |

---

## Revisión

<!-- Pendiente: /odd-close. via_max = simple → una lente sobre el candidato congelado. -->

**Candidato congelado:** `<SHA>` · pendiente

| Comprobación | Resultado |
|---|---|
| referencias cruzadas resuelven (agentes citados existen) | ✔ `ls` + `grep -h '^name:'` → 5/5 coinciden |
| secciones citadas existen (`rdd.md` §3, `agents.md` §envelope) | ✔ `grep -n '^## '` en ambos |
| el diff no toca `force_completo` | ✔ solo `.md`, `.claude/` y `docs/` |
| el diff no toca código de producto (`api/`, `web/`, `apps/`) | ✔ |
| `/code-review` sobre el candidato congelado | pendiente |
