# Análisis: Engram + Gentle-AI — SDD, ahorro de tokens y memoria agente-agnóstica

**Fecha:** 2026-09-21
**Fuentes:** [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram) · [Gentleman-Programming/gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)
**Objetivo:** extraer estructura y principios reutilizables para Orbix (orbix-admin, Noura, orbix-brain).

---

## 1. Qué es cada uno

| | Engram | Gentle-AI |
|---|---|---|
| Rol | Motor de **memoria persistente** | **Configurador** del ecosistema de agentes |
| Forma | Binario Go único + SQLite/FTS5 + servidor MCP | Binario Go que inyecta skills/workflows/config en 16 agentes |
| Agente-agnóstico por | Protocolo MCP (Claude Code, OpenCode, Gemini, Codex, Cursor…) | Adaptadores por agente (`internal/agents/{claude,opencode,gemini,cursor,vscode,codex,windsurf,antigravity}`) |
| Determinismo | Fuente de verdad = SQLite local | Fuente de verdad = archivos en disco; el binario los lee, no el modelo |

Regla que comparten: **el estado vive en disco, no en el contexto del modelo**. Cualquier agente, modelo o sesión que lea los mismos archivos da la misma respuesta.

---

## 2. Memoria persistente agente-agnóstica (Engram)

### 2.1 Modelo de datos

Tablas núcleo (`internal/store`, SQLite WAL + FTS5):

| Tabla | Rol |
|---|---|
| `sessions` | agrupa el trabajo de una sesión de agente |
| `observations` | memorias curadas: decisión, bugfix, patrón, descubrimiento, resumen |
| `observations_fts` | índice FTS5 (triggers de sincronización) |
| `user_prompts` / `prompts_fts` | el prompt del usuario como contexto recuperable |
| `memory_relations` | relaciones/juicios entre memorias → detecta conflictos semánticos |
| `sync_mutations` | cola de cambios para sync/replicación |

Campos clave de `observations`: `type`, `title`, `content`, `project`, `scope`, `topic_key`, `normalized_hash`, `revision_count`, `pinned`, `review_after`, `deleted_at`.

### 2.2 Los 5 principios que valen oro

1. **`topic_key` = upsert, no append.**
   `project + scope + topic_key` coincidentes → `mem_save` **actualiza en sitio**. Formato kebab-case con `/`, máximo 2 niveles (`architecture/auth-model`). Sin esto la memoria crece sin techo y el recall se contamina.
   Contrapartida explícita: el contenido anterior se pierde (`revision_count` incrementa, no se guarda histórico). Engram es **memoria de trabajo, no audit trail**.

2. **Divulgación progresiva en 3 capas (el ahorro de tokens principal).**

   ```
   mem_search            → resultados compactos (~100 tokens c/u) + IDs
   mem_timeline id=X     → contexto cronológico de esa sesión
   mem_get_observation   → contenido completo, solo cuando hace falta
   ```

   La preview de búsqueda **siempre** está truncada; el contenido completo requiere un segundo salto deliberado.

3. **Presupuesto de bytes duro en el contexto.**
   `mem_context`: **16 KiB por defecto, tope 64 KiB** para el resultado *completo* (incluido el sufijo de stats). Truncado UTF-8-safe con marcador `[truncated]`. `compact=true` elimina el preview inline y deja solo `- [type] **title**`. Máximo 20 `pinned`.
   El presupuesto pertenece al *contrato público*: los tests lo fijan con literales para que no derive con los refactors.

4. **Formato de contenido obligatorio: What / Why / Where / Learned.**
   La capa de persistencia **no lo valida**: la disciplina vive en las instrucciones del agente y en la revisión. Está documentado como "memory invariant".

5. **Ciclo de vida de la memoria (`state`: `active` / `needs_review`).**
   - `active` → se usa normal.
   - `needs_review` → **contexto obsoleto, no hecho confiable**; hay que verificarlo contra evidencia actual antes de apoyarse en él.
   - `mark_reviewed` **nunca** automático: solo con confirmación explícita del usuario.
   - Soft delete (`deleted_at`) oculta sin borrar; excluido de search/context, retenido para auditoría.

### 2.3 El protocolo (un SKILL.md de ~60 líneas)

`skills/memory-protocol/SKILL.md` — todo el protocolo de memoria cabe en una página:

- **Guardar** inmediatamente tras: decisión · bugfix · patrón/descubrimiento · cambio de config o preferencia.
- **Buscar**: en pedido de recall → `mem_context` primero, luego `mem_search`. Antes de trabajo similar → `mem_search` proactivo. **En el primer mensaje**, si el usuario menciona el proyecto, feature o problema → `mem_search` con *sus* palabras clave antes de responder.
- **Cerrar**: antes de decir "listo" → `mem_session_summary` (objetivo, descubrimientos, logrado, siguientes pasos, archivos). Tras compactación: guardar resumen → recuperar contexto → continuar.
- **Garantía de entrega**: *"las operaciones de memoria son contabilidad interna, nunca la respuesta al usuario"*. Toda la memoria se completa **antes** de componer la respuesta final; ninguna llamada a herramienta después. Si la memoria falla, **igual se entrega la respuesta**.

### 2.4 Portabilidad

`.engram/` en el repo: `config.json` + `manifest.json` + `chunks/*.jsonl.gz` (comprimidos, chunked). `engram sync` exporta, `engram sync --import` importa tras clonar. El SQLite local es autoritativo; la nube y git son réplica.

---

## 3. SDD y sus alternativas (Gentle-AI)

Lo más valioso: Gentle-AI **no vende SDD como default**. Define tres modos y una regla de selección explícita.

### 3.1 ODD — Organic Driven Development (el camino diario)

Un solo documento por feature: `odd/tasks/<feature-name>.md` con objetivo/problema/por qué, alcance/restricciones, checklist accionable con **IDs estables y criterios de aceptación**, evidencia de verificación, progreso y siguiente paso. Espejo en memoria: topic `odd/<feature-name>/tasks`.

Protocolo de 7 pasos: Autorizar → Explorar → Resolver incertidumbre → **Clasificar** → Trackear *antes* de la primera escritura → Implementar tarea por tarea → Cerrar.

- **Clasificar** = "substancial" si la exploración revela ≥2 pasos de implementación con sentido; si no, trabajo pequeño **sin artefactos durables**.
- Cada tarea cierra con **al menos un work-unit commit** (tests y docs junto al comportamiento, Conventional Commits). El documento registra la identidad del commit como evidencia.
- Heurística de tamaño: ~400 líneas autoradas por tarea, **guía de planeación, nunca tope duro**. Prohibido explícitamente: borrar espacios o comentarios para "ahorrar", omitir tests, minificar, abstraer gratis o partir artificialmente.
- Los hallazgos **no autorizan** expansión de alcance por sí solos.

### 3.2 SDD — Spec Driven Development (opt-in explícito)

Fases: `explore → [research] → propose → (aprobación) → spec → design → tasks → apply → [verify] → archive`.

Artefactos (`openspec/`):

```
openspec/
├── config.yaml
├── specs/{domain}/spec.md          <- fuente de verdad
└── changes/
    ├── archive/YYYY-MM-DD-{change}/
    └── {change-name}/
        ├── state.yaml              <- pista de recuperación OPCIONAL, no segunda autoridad
        ├── exploration.md · research.md · proposal.md
        ├── specs/{domain}/spec.md  <- delta spec
        ├── design.md · tasks.md · verify-report.md
```

Delta specs con `## ADDED / MODIFIED / REMOVED / RENAMED Requirements`. `MODIFIED` debe traer el **bloque completo** del requisito, incluidos los escenarios sin cambio. Cada requisito exige ≥1 escenario Given/When/Then testeable. RFC 2119 (MUST/SHALL/SHOULD/MAY). Las specs definen **QUÉ, no CÓMO**.

**Regla de selección (la clave):** *"tamaño, incertidumbre y riesgo por sí solos NUNCA seleccionan SDD"*. SDD se elige explícitamente cuando quieres los artefactos separados. Todo lo demás es ODD.

### 3.3 RDD — Receipt Driven Development (revisión)

- **La revisión sigue al trabajo**: existe un candidato *congelado* antes de revisar; los revisores ven contexto inmutable, no el workspace vivo.
- **Profundidad por riesgo, no por juicio del modelo**: `low` → readback estructural, 0 lentes, silencioso · `medium` → 1 lente de foco + consentimiento · `high` → 4R canónicas (Risk · Resilience · Readability · Reliability).
- Solo hallazgos severos *causados por el candidato* bloquean. Una corrección acotada, con presupuesto congelado.
- **La aprobación nunca entrega**: commit, push, PR y release siguen gobernados por la política ordinaria del repo y su autorización explícita.

---

## 4. Los mecanismos de ahorro de tokens (lo que hay que robar)

| # | Mecanismo | Dónde | Efecto |
|---|---|---|---|
| 1 | **Divulgación progresiva** search → timeline → get | Engram | evita cargar contenido completo por defecto |
| 2 | **Presupuesto de bytes con tope** (16/64 KiB) + `compact` | Engram `mem_context` | techo duro al contexto inyectado |
| 3 | **Upsert por `topic_key`** | Engram | la memoria no crece sin límite; sin duplicados |
| 4 | **Índice de skills, no bundle de reglas** | gentle-ai `AGENTS.md` | tabla `skill \| trigger \| path`; se carga solo la que dispara |
| 5 | **Pasar rutas, no resúmenes** | `_shared/skill-resolver.md` | el sub-agente lee el `SKILL.md` exacto; no se degrada por resumen generado |
| 6 | **Registry cacheado por fingerprint** | `.atl/.skill-registry.cache.json` (schema + path + mtime + size) | arranque de sesión = cache hit barato |
| 7 | **Máximo 5 skills por delegación**, prioridad a contexto de código | `_shared/skill-resolver.md` | acota el prompt del hijo |
| 8 | **Quién lee y quién escribe** | `_shared/persistence-contract.md` | ver 4.1 — el punto más fino |
| 9 | **`detail_level`** `concise\|standard\|deep` | orquestador → sub-agente | controla verbosidad de salida **sin** afectar lo persistido |
| 10 | **`capture_prompt: false`** en artefactos automáticos | convención Engram | no guarda el prompt del usuario en salidas de pipeline |
| 11 | **`_shared/*.md`** (11 archivos) | gentle-ai skills | secciones comunes escritas una vez, referenciadas por 12 skills |

### 4.1 El split de lectura/escritura (mecanismo #8, el más transferible)

```
No-SDD (tarea general):   el ORQUESTADOR busca en memoria y pasa el resumen en el prompt;
                          el sub-agente guarda descubrimientos con mem_save.
SDD (fase con deps):      el SUB-AGENTE lee los artefactos directo del backend y guarda el suyo.
SDD (fase sin deps):      nadie lee; el sub-agente guarda su artefacto.
Colector de research:     no lee nada, no guarda nada; devuelve evidencia al orquestador.
```

Razones textuales del repo:

- El orquestador lee en no-SDD **porque sabe qué contexto es relevante**; que los sub-agentes busquen solos desperdicia tokens en resultados irrelevantes.
- Los sub-agentes leen en SDD **porque los artefactos son grandes**; inlinearlos en el prompt del orquestador consumiría toda la ventana.
- Los sub-agentes que producen artefactos escriben **porque tienen el detalle completo**; el matiz se pierde al volver al padre.

### 4.2 Reglas de parada de delegación (control de coste por presupuesto, no por intuición)

- **Regla de 4 archivos**: leer 4+ archivos para entender un flujo → delegar exploración.
- **Regla multi-archivo**: tocar 2+ archivos no triviales → un solo escritor, o revisión fresca antes de completar.
- **Regla de sesión larga**: ~20 tool calls, 5 lecturas exploratorias o 2 ediciones no mecánicas con complejidad creciente → pausar y delegar, re-planear, o justificar por qué no.
- **Regla de incidente**: tras cwd equivocado, accidente de git/worktree, recuperación de merge o workaround de entorno → auditoría fresca antes de continuar.
- **Regla de revisión fresca**: contexto limpio para revisión adversarial de diffs, conflictos y PRs.

### 4.3 Ordenamiento de respuesta del sub-agente

> La llamada de persistencia DEBE ocurrir **antes** de la respuesta final de texto. La última salida del sub-agente debe ser texto, nunca un tool call.

Motivo: el padre recibe solo el resultado de la herramienta (`"Observation saved"`) y **pierde el análisis del hijo**. Siempre: trabajo → guardar → responder con envelope de texto.

### 4.4 Contrato de salida uniforme

Todas las fases devuelven el mismo envelope: `status`, `executive_summary`, `artifacts`, `next_recommended`, `risks`. El padre parsea siempre la misma forma.

---

## 5. Anatomía de un SKILL.md (formato a copiar)

```yaml
---
name: sdd-init
description: "Trigger: sdd init, iniciar sdd, openspec init. Initialize SDD context..."
disable-model-invocation: true
user-invocable: false
metadata:
  delegate_only: true
---
```

Secciones, en orden:

1. **Execution Role** — "confirma tu rol antes de actuar". Si eres el sub-agente dedicado → ejecuta, no delegues. Si cargaste la skill vía `skill()` → eres el orquestador, **para y delega**. Evita el bucle de auto-delegación.
2. **Language Domain Contract** — los artefactos técnicos van en inglés por defecto; no heredan el idioma conversacional del usuario.
3. **Activation Contract** — cuándo corre esta fase.
4. **Hard Rules** — imperativos cortos, uno por línea.
5. **Decision Gates** — **tabla** `Input | Action`, no prosa.
6. **Execution Steps** — numerados.
7. **Output Contract** — campos exactos del envelope.
8. **References** — rutas a `references/*.md` y `../_shared/*.md` con el detalle largo.

El detalle voluminoso vive en `references/` y `_shared/`: la `SKILL.md` queda barata de cargar.

---

## 6. Qué robar para Orbix — propuesta concreta

### Prioridad 1 — barato y de impacto inmediato

| Acción | Dónde en Orbix | Robado de |
|---|---|---|
| **Presupuesto duro de bytes en `search_documents` del MCP `orbix-brain`** + modo `compact` (solo `- [tipo] **título**`) | `brain/mcp` | Engram `mem_context` 16/64 KiB |
| **Divulgación progresiva explícita**: `search_documents` devuelve preview truncado + ID; `read_document` es el único camino al contenido completo | `brain/mcp` | Engram, 3 capas |
| **Tabla `skill \| trigger \| path` en cada `CLAUDE.md`** en vez de reglas inline | `orbix-admin/api/CLAUDE.md`, `web/CLAUDE.md`, `apps/pos-web/CLAUDE.md` | gentle-ai `AGENTS.md` |
| **Reglas de parada de delegación** (4 archivos / 2 escrituras / ~20 tool calls / incidente) | `C:\Repos\Orbix\CLAUDE.md` | gentle-ai |
| **Pasar rutas, no resúmenes** a sub-agentes | convención de trabajo | `_shared/skill-resolver.md` |

### Prioridad 2 — estructura

| Acción | Dónde | Robado de |
|---|---|---|
| **ODD como camino diario**: `docs/odd/tasks/<feature>.md` con checklist de IDs estables + criterios de aceptación + evidencia + siguiente paso | `orbix-admin/`, `Noura/` | gentle-ai ODD |
| **Regla de selección explícita**: tamaño y riesgo **no** seleccionan SDD; SDD es opt-in por palabra del usuario | `CLAUDE.md` raíz | gentle-ai |
| **`topic_key` con upsert en el vault**: `sdd/{cambio}/{artefacto}`, kebab-case, ≤2 niveles | `brain/vault` | Engram |
| **Ciclo de vida `active` / `needs_review`** en el frontmatter del vault — ya existe "Requiere validación"; formalizarlo como estado consultable, y que `mark_reviewed` exija confirmación humana | `brain/vault` + `engine` | Engram |
| **What / Why / Where / Learned** como formato obligatorio de las notas de decisión y bugfix | `vault/Decisions/` | Engram |
| **Envelope de salida uniforme** `status · executive_summary · artifacts · next_recommended · risks` para agentes y entregables | convención | gentle-ai |

### Prioridad 3 — si se quiere llegar lejos

- **RDD por riesgo**: `low` = readback silencioso · `medium` = 1 lente · `high` = 4R. El `/code-review` de Orbix ya tiene niveles de esfuerzo; falta el **congelado del candidato** (revisar un commit o diff inmutable, no el working tree vivo) y que la aprobación **nunca** implique push — esto último ya lo cubre la regla de "no commitear sin permiso".
- **Sincronización portable del conocimiento**: hoy `.brain/index.db` no se versiona, que es correcto por ser una proyección. El equivalente a `.engram/chunks/*.jsonl.gz` sería exportar el vault comprimido y versionado — probablemente innecesario: el vault **ya es** markdown en git. Orbix gana aquí por defecto.
- **Cache por fingerprint del índice** (`schema + path + mtime + size`) para que el hook `Stop` de reindexado sea cache-hit barato en vez de reconstrucción completa.

### Lo que NO hay que copiar

- **La complejidad de RDD de gentle-ai** (contracts v1/v2, decenas de schemas JSON, lineages, burn de autoridad). Es infraestructura de producto, no de proyecto. Orbix necesita el *principio* — congelar el candidato, profundidad por riesgo — no la maquinaria.
- **Modo `hybrid`** de persistencia: doble escritura no atómica con reconciliación manual. Orbix ya tiene una sola fuente, el vault en git.
- **La pérdida de histórico por upsert**: en Engram es aceptable porque es memoria de trabajo. En el vault de Orbix, git ya da el histórico, así que el upsert por `topic_key` es puro beneficio.

---

## 7. Las cinco frases que resumen todo

1. *"El estado vive en disco; el binario lee archivos, no el modelo"* — determinismo entre agentes, modelos y sesiones.
2. *"La preview siempre está truncada; el contenido completo requiere un segundo salto deliberado"* — divulgación progresiva.
3. *"Pasa rutas, no resúmenes"* — el `SKILL.md` es el contrato de runtime; un resumen generado lo degrada.
4. *"Las operaciones de memoria son contabilidad interna, nunca la respuesta al usuario"* — y si la memoria falla, la respuesta se entrega igual.
5. *"Tamaño, incertidumbre y riesgo por sí solos nunca seleccionan SDD"* — la ceremonia es opt-in, no una consecuencia del tamaño.
