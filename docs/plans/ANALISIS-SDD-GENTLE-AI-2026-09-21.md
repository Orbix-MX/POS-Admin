# Análisis: metodología de gentle-ai frente al SDD/ODD de Orbix

**Fecha:** 2026-09-21 · **Fuente:** `Gentleman-Programming/gentle-ai` @ `main` (clon superficial, leído en scratchpad)

Este documento compara **metodologías de desarrollo**, no productos. De gentle-ai interesan
dos capas, que son la misma doctrina aplicada dos veces:

| Capa | Dónde vive | Qué es |
|---|---|---|
| **Cómo se desarrollan a sí mismos** | `AGENTS.md`, `CONTRIBUTING.md`, `skills/`, `odd/tasks/`, `openspec/changes/`, `.github/`, `scripts/*-ratchet.sh` | flujo issue-first, work-unit commits, presupuesto de revisión, ratchets en CI |
| **Lo que el CLI instala en el agente** | `internal/assets/*/sdd-orchestrator.md`, `internal/assets/skills/_shared/*`, agentes de fase y de revisión | ODD por defecto, SDD como rama, gatekeeper, ledger de revisión, 4R + refutador |

Coherencia notable: sus propios `odd/tasks/*.md` siguen el protocolo que su CLI instala. La
metodología se autoaplica. Ese es el estándar contra el que vale la pena medirse.

---

## 1. El mapa en una tabla

| Eje | Orbix (`.specify/`) | gentle-ai | Veredicto |
|---|---|---|---|
| Workflow por defecto | ODD; SDD solo si el usuario lo pide | ODD; SDD es rama dentro de ODD, solo por petición explícita o propuesta aceptada | **empate** — misma doctrina, redactada casi igual |
| Eje de riesgo | `vía` (`directo`/`simple`/`completo`) asignada por coincidencia de patrón | `risk tier` (`passive`/`medium`/`high`) devuelto por un binario propio | **Orbix mejor** — declarativo y verificable con git puro |
| Escalada | `force-completo.md`: rutas, símbolos, dominios; se comprueba con `git diff` | sin equivalente declarativo; depende de `gentle-ai review assess` | **Orbix mejor** |
| Reglas de producto | constitución C-001…C-027 con respaldo citado | reglas duras repartidas por skills, sin disciplina de procedencia | **Orbix mejor** |
| Contrato de retorno de sub-agente | inexistente (solo "el último output es texto") | envelope obligatorio de 6 campos | **brecha** |
| Validación entre fases | inexistente | *Automatic Mode Gatekeeper*: 5 chequeos, un reintento, luego STOP | **brecha** |
| Revisión: lentes | 4R nombradas en `rdd.md`, sin prompts | 4 agentes reales con reglas concretas + refutador adversarial | **brecha grande** |
| Revisión: contabilidad | tabla "bloquea sí/no" en prosa | ledger con `id`/`lens`/`location`/`severity`/`status`/`evidence` | **brecha** |
| Presupuesto de corrección | "una corrección acotada, luego escala" | *convergence budget*: máx. 2 rondas, techo estructural de refutadores | empate, gentle-ai más preciso |
| Tamaño de entrega | sin límite | 400 líneas autoradas + `delivery_strategy` + PRs encadenados | **brecha** |
| Congelado del candidato | `git stash create`, SHA citado en todo | congelado nativo + **regla de orden de normalización** | **brecha parcial** |
| Enforcement fuera del prompt | ninguno: todo depende de la disciplina del agente | ratchets congelados + gates de CI + PR template | **brecha grande** |
| Presupuesto de contexto | regla explícita de 4 archivos, no releer, pasar rutas | lo predica y lo incumple: ~35 KB de prosa normativa siempre encendida | **Orbix mejor** |

---

## 2. Lo que Orbix ya hace mejor — no tocar

1. **Dos ejes separados** (workflow lo decide el usuario, vía la decide el patrón). gentle-ai
   mezcla riesgo con topología de delegación y termina necesitando un binario para desempatar.
2. **`force-completo.md`.** Una lista de rutas y símbolos comprobable con `git diff --name-only`
   es más honesta que un veredicto de modelo: *"no se confía al criterio del agente: el que
   lleva veinte minutos dentro de una tarea tiene todo el incentivo de declararla acotada"*.
   gentle-ai llega a la misma conclusión pero la resuelve con un servicio, no con una lista.
3. **Procedencia de las reglas.** *"Una regla sin respaldo no es constitución, es opinión — y se
   retira."* No hay equivalente en gentle-ai.
4. **Presupuesto de contexto.** gentle-ai predica lazy-load y luego escribe párrafos de 400
   palabras sin puntos y aparte en el prompt siempre encendido. **No copiar el estilo de
   redacción**, solo los mecanismos.
5. **Congelado con git puro.** Reproducible sin instalar nada.

---

## 3. Brechas — adopciones rankeadas

### Tier 1 · alto valor, bajo coste

#### A1 · Contrato de retorno del sub-agente

gentle-ai obliga a **todo** agente delegado a cerrar con un envelope fijo:

```
status              success | partial | blocked
executive_summary   1-3 frases
artifacts           rutas/claves escritas
next_recommended    siguiente paso, o "none"
risks               riesgos hallados, o "None"
skill_resolution    paths-injected | fallback-registry | fallback-path | none
```

Sin esto, el orquestador no puede validar nada de forma mecánica: tiene que leer prosa. Orbix
ya tiene la mitad buena de la regla (*"el último output del sub-agente es texto, nunca una
llamada a herramienta"*) pero no el formato.

**Aterriza en:** `.specify/agents.md` (sección nueva) y los 4 prompts de `.claude/agents/`.

#### A2 · Gatekeeper del orquestador entre fases

Tras cada resultado delegado y **antes** de lanzar el siguiente, el orquestador valida:

- **Conformidad de contrato** — los 6 campos están, `status` no es `partial`/`failed`/`blocked`.
- **Existencia de artefacto** — lo declarado es legible.
- **Sin alucinación** — los archivos, símbolos, comandos y artefactos citados existen.
- **Sin drift** — la salida es consistente con sus entradas.
- **Coherencia de ruta** — `next_recommended` respeta el grafo y no queda riesgo CRÍTICO abierto.

Validación híbrida: inline para fases baratas, **validador en contexto fresco** para diseño e
implementación. Ante fallo: **se reejecuta la misma fase una vez** con feedback correctivo
concreto; al segundo fallo se **detiene la cadena** y se reporta.

Orbix tiene la idea de "una corrección acotada" pero solo para hallazgos de revisión, no para
salidas de agentes. Hoy un sub-agente que inventa un archivo pasa sin fricción.

**Aterriza en:** `.specify/agents.md` § Gatekeeper, y `/sdd-implement`, `/odd-close`.

#### A3 · Ledger de hallazgos, precision gate, severity floor, convergence budget

Cuatro reglas que van juntas:

| Regla | Contenido |
|---|---|
| **Ledger** | toda entrada: `id` (`R1-001`), `lens`, `location` (`archivo:línea`), `severity` (BLOCKER/CRITICAL/WARNING/SUGGESTION), `status` (open/fixed/verified/refuted/wont-fix/info), `evidence`. Si el primer barrido no encuentra nada, **se persiste un ledger vacío**, no se omite. |
| **Precision gate** | *"un nitpick perdido no cuesta nada; un falso positivo cuesta un ciclo de arreglo completo"*. Hallazgos de estilo prohibidos salvo que oculten un defecto. |
| **Severity floor** | solo BLOCKER/CRITICAL entran al bucle arreglar → re-revisar. WARNING/SUGGESTION se reportan una vez con `status: info`, nunca se re-revisan, nunca bloquean. |
| **Convergence budget** | máximo **2 rondas de arreglo** por revisión. Lo que siga abierto tras la ronda 2 se reporta como abierto; el bucle no se extiende. |
| **Sweep budget** | 1 barrido exhaustivo por lente (2 en 4R). No hay "loop hasta que salga limpio". |

La tabla de "bloquea sí/no" de `rdd.md` es la mitad de esto: dice qué bloquea, pero no le da
identidad ni estado a un hallazgo, así que no se puede auditar el cierre.

**Aterriza en:** `.specify/rdd.md` §3, plantilla de `verify.md` y la sección Revisión de la
plantilla ODD.

#### A4 · Prompts reales de las 4R + refutador adversarial

`rdd.md` nombra *Riesgo · Resiliencia · Legibilidad · Fiabilidad* pero **no existen los agentes**.
gentle-ai tiene los cuatro, con reglas concretas y accionables, y una salida exacta cuando no
hay nada: `No findings.`

Muestra de las reglas por lente:

- **Riesgo** — secretos en código, autorización solo en frontend, input sin escapar llegando a
  sinks del DOM, concatenación en vez de parametrización, cookies sin `httpOnly`/`secure`/`sameSite`.
- **Legibilidad** — números mágicos, listas largas de parámetros, lógica duplicada, código
  muerto, nombres que ocultan intención. *Exige evidencia para "esto es complejo": función,
  rama o patrón exacto.*
- **Fiabilidad** — bloquea cambio de comportamiento sin test del contrato externo, tests
  centrados en implementación, bloquea si CI puede pasar con `test.only`, selectores débiles.
- **Resiliencia** — fallos sin fallback ni degradación, umbrales (`test success < 95%`,
  `prod error rate > 1%` investigar, `> 2%` emergencia), rollback concreto, presupuestos de
  rendimiento medidos.

El **refutador** es lo más valioso y lo más barato: un agente desacoplado que recibe la lista
**completa** de candidatos BLOCKER/CRITICAL y devuelve `corroborated` / `refuted` /
`inconclusive` por cada uno. El techo es **estructural, no por hallazgo**: 1 tarea de refutación
en revisión estándar, 3 en 4R (voto independiente 2-de-3), tenga la lista 2 candidatos o 20.
*"Nunca un refutador por candidato."* Veredicto ausente o malformado ⇒ el hallazgo `stands`.

**Aterriza en:** `.claude/agents/review-{riesgo,legibilidad,fiabilidad,resiliencia}.md` +
`review-refutador.md`. La lente Riesgo de Orbix debe cargar C-001…C-009 como reglas duras.

#### A5 · Orden de normalización antes del congelado

> *"Antes del START de la revisión y su congelado de identidad, corre todos los normalizadores
> que mutan la fuente, luego re-captura el candidato y revisa exactamente esos bytes, rutas y
> modos. Después del START, solo pueden correr formato en modo comprobación, typecheck, tests
> y gates. Cualquier cambio de byte, ruta o modo invalida el recibo y exige una revisión nueva
> — nunca tolerancia de 'es solo el formateador'."*

`rdd.md` congela con `git stash create` pero no dice nada de esto. Hoy, un `lint --fix` después
del congelado deja la evidencia apuntando a bytes que ya no existen, en silencio.

**Aterriza en:** `.specify/rdd.md` §1, dos líneas.

---

### Tier 2 · adoptar adaptado

#### A6 · Presupuesto de carga cognitiva de la entrega

400 líneas autoradas (`additions + deletions`, generados excluidos del conteo de riesgo pero
incluidos en la identidad del snapshot) como presupuesto de revisión, más una
`delivery_strategy` elegida una vez y cacheada:

| Estrategia | Comportamiento |
|---|---|
| `ask-on-risk` (default) | pregunta solo cuando el forecast detecta riesgo |
| `auto-chain` | trocea en PRs encadenados automáticamente |
| `single-pr` | exige registrar `size:exception` si se pasa |
| `exception-ok` | el usuario ya aceptó la excepción |

`sdd-tasks` emite el forecast con **líneas de guardia en texto exacto**:
`Decision needed before apply: Yes|No`, `Chained PRs recommended: Yes|No`,
`400-line budget risk: Low|Medium|High`. Un valor de estrategia no reconocido **no se mapea al
más cercano**: se detiene y se reporta.

Matiz honesto: en su propio CI el gate está `"enforcement": "dormant"` — es advisory, no
bloqueante. Y en ODD lo declaran explícitamente **heurística de planificación, no criterio de
aceptación**: *"si la solución correcta y clara excede las 400 naturalmente, explica por qué y
sigue, sin bucles de rework por tamaño"*.

**Adaptación Orbix:** el número sirve como forecast en el documento ODD y como disparador para
trocear en work-unit commits. Orbix no encadena PRs hoy; no inventar esa maquinaria.

#### A7 · work-unit commits con evidencia obligatoria

`odd.md` ya exige un work-unit commit por tarea. gentle-ai le pone checklist:

- [ ] un propósito claro
- [ ] el repo sigue teniendo sentido aplicando **solo** este commit
- [ ] tests o docs de la unidad incluidos
- [ ] rollback razonable sin revertir trabajo ajeno
- [ ] **comando de test enfocado y resultado exacto registrados**
- [ ] **comando/escenario del harness en runtime y resultado exacto, o `N/A` justificado**
- [ ] **frontera de rollback: los archivos/comportamiento exactos que se pueden quitar**
- [ ] el mensaje explica el resultado, no la lista de archivos

Los tres en negrita son campos que hoy la plantilla ODD de Orbix no pide. El de runtime encaja
exacto con C-021 (verificar con la app arrancada).

#### A8 · Declaración de ruta por tarea + spot check del padre

Sus propios `odd/tasks/*.md` registran, por tarea, **cómo se ejecutó**:

```
- [x] T2. Escribir tests que fallen para los triggers obligatorios.
  - Route: inline (1 archivo de test, ya entendido). Evidence: RED observado — TestX falló.
- [x] T4. Replicar los triggers en la guía ODD de pi.
  - Route: delegated (worker). Evidence: RED 2 fail → GREEN 12 pass. Commit f58774f2.
    Parent spot check re-corrió la suite: 12 pass.
```

Dos cosas que Orbix no tiene: la **ruta declarada** (hace visible el no-delegar, que hoy es
invisible) y el **spot check del padre** — re-correr uno de los comandos que el sub-agente
reportó, antes de entregar. *"Un auto-reporte es una afirmación, no evidencia."*

Complemento barato: **log de deduplicación** de `(fase, huella-de-tarea)` por sesión; si el par
ya existe, no se relanza.

#### A9 · Contrato de dominio de idioma reenviado a sub-agentes

Regla explícita de qué idioma lleva cada superficie (conversación vs. artefactos técnicos vs.
comentarios públicos) **y la obligación de reenviarla al ejecutor** *"para que la voz de la
persona nunca se convierta en el default del artefacto"*. Orbix escribe en español y no lo
declara en ningún sitio: cada sub-agente lo adivina.

#### A10 · Cierre con `## Key Learnings` → puente al vault

Todo agente delegado cierra su mensaje final con 1-5 aprendizajes factuales, cada uno una frase
autónoma de ≥4 palabras. En gentle-ai lo captura Engram; en Orbix el consumidor natural es
`vault-curator`. Hoy la absorción al vault depende de que el orquestador recuerde qué pasó;
esto la convierte en una entrada estructurada.

---

### Tier 3 · enforcement fuera del prompt — lo más diferenciador

#### A11 · Ratchets congelados

Lo mejor del repo, y lo que ninguna cantidad de prosa sustituye. `scripts/deadcode-ratchet.sh`
lo explica solo:

> *"Por qué un ratchet y no un gate limpio: el repositorio ya arrastra 230 funciones que nada
> alcanza, y la mayoría son legítimas. Exigir que esa lista llegue a cero antes de que el guard
> pueda existir significaría que el guard nunca existe. **Congelarla y negar el crecimiento es
> la parte que se paga sola.**"*

Y declara lo que **no** atrapa, *"dicho en claro para que nadie confíe más de lo que da"*: una
rama muerta dentro de una función viva, un campo que nadie asigna, una función llamada cuyo
efecto está muerto. Tres baselines congelados en el repo: código muerto, población de guards,
refusals.

**Orbix tiene el caso perfecto esperando:** C-022 — *"los 5 fallos de `retail` tenant-isolation
son preexistentes"*. Hoy es una excepción en prosa que nadie mide, y nada impide que mañana
sean seis. Un ratchet los congela por nombre y hace fallar CI ante el sexto. Lo mismo para la
cobertura de autorización (C-005, que ya tiene su spec) y para `force_completo`: un script que
compare `git diff --name-only` contra las rutas vale más que confiar en que el agente lo corra.

#### A12 · Issue-first y PR template como gate

*"No PR sin issue. Sin excepciones."* El PR template lleva checklist de verificación con los
comandos exactos, declaración de asistencia de IA, y —literal— `[ ] Mis commits no incluyen
trailers Co-Authored-By`, que es C-025 de Orbix convertido en casilla verificable en vez de
regla que hay que recordar.

---

## 4. Lo que no conviene traer

| Mecanismo | Por qué no |
|---|---|
| Engram / store de artefactos múltiple (`engram`/`openspec`/`hybrid`/`none`) | Orbix ya decidió: archivos en el repo + `brain/`. La indirección cuesta y no paga. |
| *Provider Defect Handoff* | específico de un producto distribuido que recibe reportes de sus usuarios. |
| Renderizado multi-runtime (12 agentes) | Orbix es Claude Code. Lo que **sí** aplica es la idea de fuente única — responde al pendiente ya escrito en `.specify/agents.md` § Duplicación con Codex. |
| El volumen y el estilo de la prosa normativa | párrafos de 400 palabras sin respiro, en un prompt siempre encendido. Contradice la regla de presupuesto de contexto de Orbix, que es mejor. |
| Grafo de 8 fases (`explore → propose → spec → design → tasks → apply → verify → archive`) | Orbix lo resuelve en 5. No cambiar lo que funciona. |

---

## 5. Plan de aplicación

| Fase | Adopciones | Archivos |
|---|---|---|
| 1 | A1, A2 | `.specify/agents.md`, `.claude/agents/*.md` |
| 2 | A4, A3, A5 | `.claude/agents/review-*.md` (5 nuevos), `.specify/rdd.md`, `.specify/templates/verify.md`, `.specify/templates/odd.md` |
| 3 | A7, A8, A9, A10 | `.specify/templates/odd.md`, `.specify/agents.md`, `.specify/odd.md` |
| 4 | A6 | `.specify/vias.md`, `.specify/templates/tasks.md` |
| 5 | A11, A12 | `scripts/` nuevo, CI, `.github/PULL_REQUEST_TEMPLATE.md` |

Trabajo trackeado en `docs/odd/sdd-gentle-ai.md`.
