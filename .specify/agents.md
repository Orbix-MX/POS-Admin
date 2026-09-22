# Plantilla de agentes

Quién hace qué. Los prompts viven en `.claude/agents/`; esta tabla dice a cuál llamar y
cuándo.

| Agente | Capa | Lo despacha | No debe |
|---|---|---|---|
| `spec-writer` | spec | `/sdd-specify` | tocar código; nombrar tecnología en §1–6 |
| `plan-architect` | diseño y descomposición | `/sdd-tasks`, paso 1 de vía `completo` | escribir implementación; aplicar migraciones |
| `backend-code-analyst` | `api/` | vías `simple` y `completo` | — |
| `ui-ux-frontend-analyzer` | `web/`, `apps/pos-web/` | vías `simple` y `completo` | — |
| `e2e-test-orchestrator` | tests | paso 3 de vía `completo` | — |
| `spec-verifier` | cierre | `/sdd-verify`, `/rdd-review` | arreglar lo que encuentra |
| `vault-curator` | absorción | `/sdd-absorb`, cierre de ODD | documentar por documentar |
| `review-riesgo` | lente R1 | 4R de vía `completo` | arreglar; proponer estilo |
| `review-legibilidad` | lente R2 | 4R de vía `completo` | arreglar; opinar sin ancla |
| `review-fiabilidad` | lente R3 | 4R de vía `completo` | arreglar; escribir tests |
| `review-resiliencia` | lente R4 | 4R de vía `completo` | arreglar; especular sin medida |
| `review-refutador` | refutación | 4R, tras fusionar las lentes | añadir hallazgos; arreglar |

Los agentes son del **eje de vía**, no del workflow: los mismos despachan en ODD y en SDD.
`/odd` no tiene agentes propios — el trabajo pequeño no se delega, y el substancial usa
estos según la capa.

Los tres de en medio son anteriores a SDD y se usan también fuera de cualquier ciclo.

## Delegación — cómo se pasa el contexto

**Pasa rutas, no resúmenes.** El sub-agente recibe la ruta del spec, del documento ODD o
del `SKILL.md` y los lee él. Un resumen generado degrada el contrato y cuesta tokens dos
veces: al resumir y al perder el matiz.

**El orquestador lee, el sub-agente escribe.** El padre sabe qué contexto es relevante y lo
acota; el hijo tiene el detalle completo de lo que hizo y persiste su propio artefacto.

**El último output del sub-agente es texto, nunca una llamada a herramienta.** Si termina
guardando, el padre recibe solo el resultado de la herramienta y pierde el análisis.
Siempre: trabajo → guardar → responder.

**Reenvía el idioma.** El sub-agente no adivina en qué idioma escribir. El prompt de
delegación lo declara: conversación y reportes al orquestador en **español**; artefactos del
repo —specs, documentos ODD, vault, comentarios de código, textos de UI— en **español**;
identificadores, nombres de símbolo, mensajes de commit convencionales y salidas de comando,
como los exige su convención. Sin esta línea, cada agente elige distinto y el repo se mezcla.

**Un solo escritor.** Dos agentes que escriben los mismos archivos en paralelo producen un
merge que nadie pidió. Exploración en paralelo, sí; escritura, uno.

**Log de lanzamientos.** El orquestador lleva, por sesión, los pares `(fase, tarea)` que ya
despachó. Si el par ya está, no se relanza. Un sub-agente relanzado por olvido cuesta lo mismo
que el primero y su resultado compite con el que ya había.

## El envelope de retorno — obligatorio

Todo sub-agente cierra su mensaje final con estos seis campos. Sin ellos el padre no puede
validar nada de forma mecánica: tiene que leer prosa y confiar.

```
estado:      ok | parcial | bloqueado
resumen:     1-3 frases. Qué se hizo, no qué se intentó.
artefactos:  rutas exactas escritas o modificadas. "ninguno" si no escribió.
siguiente:   el paso que recomienda, o "ninguno".
riesgos:     lo que encontró y no resolvió, o "ninguno".
evidencia:   comando ejecutado → resultado observado, uno por línea.
```

Y después, un cierre con los aprendizajes:

```
## Aprendizajes

1. <frase factual, autónoma, de ≥4 palabras>
2. …                                     (entre 1 y 5)
```

No es decoración: es lo que `vault-curator` lee para decidir la absorción. Hoy esa decisión
depende de que el orquestador recuerde qué pasó dentro del sub-agente; esto la vuelve una
entrada estructurada. El sesgo por defecto sigue siendo **no documentar**.

## El gatekeeper del orquestador

Tras recibir un resultado delegado y **antes** de lanzar el siguiente paso, el padre comprueba:

| Chequeo | Qué se mira |
|---|---|
| **Contrato** | los seis campos están y `estado` es `ok`. `parcial` o `bloqueado` no encadenan. |
| **Artefacto** | lo que declara en `artefactos` existe y se lee. |
| **Sin invención** | los archivos, símbolos y comandos que cita existen. Se comprueban, no se creen. |
| **Sin drift** | lo que produjo es consistente con lo que recibió: la tarea que se le dio, el spec o el documento ODD. |
| **Coherencia** | `siguiente` respeta el orden de la vía y no quedó ningún riesgo sin atender. |

**Un reintento, y solo uno.** Si un chequeo falla, se relanza **la misma** fase con el defecto
concreto en el prompt —qué campo faltó, qué archivo no existe—. Si el segundo resultado también
falla, **se detiene la cadena** y se reporta al usuario. No se lanza la fase dependiente.

**Spot check antes de entregar.** El padre re-corre **uno** de los comandos que el sub-agente
reportó en `evidencia` y compara. Un auto-reporte es una afirmación, no evidencia; el coste de
comprobar una línea es menor que el de entregar un verde que nadie vio.

## Separación de poderes

El que implementa no verifica, y el que verifica no arregla. Un agente que corrige de paso
lo que audita destruye la señal: el reporte deja de decir en qué estado llegó el trabajo.

Por eso `spec-verifier` tiene el código de producción en solo lectura y solo escribe
`verify.md`.

## Duplicación con Codex — pendiente

`.codex/agents/*.toml` replica a mano los tres agentes antiguos de `.claude/agents/*.md`:
el mismo prompt escrito dos veces, ~1500 líneas para tres agentes, y los `.toml` ya
arrastran `\r` incrustados en el texto.

Los cuatro agentes de SDD se escribieron **solo para Claude Code**. Las opciones:

1. Invertir la fuente — el prompt vive una vez en `.specify/agents/<nombre>.md` y un script
   genera el `.md` y el `.toml`.
2. Declarar `.codex/` muerto y dejar de mantenerlo.

Sin decidir. Hasta entonces, Codex no ve los agentes de SDD.
