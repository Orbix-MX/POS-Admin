# Revisión del candidato

Cómo se revisa un trabajo terminado, en ODD y en SDD. Dos reglas lo definen:

**La revisión sigue al trabajo, sobre un candidato congelado.** No se revisa el árbol vivo.
Se congela una versión exacta y toda la evidencia cita ese SHA. Si el árbol cambia durante
la revisión, la evidencia recogida deja de corresponder a lo que se aprueba.

**La aprobación no entrega.** Commit, push, PR y despliegue siguen gobernados por C-024,
C-025 y C-026. Una revisión en verde es evidencia, no permiso.

---

## 1. Congelar

**Normalizar primero.** Todo lo que **muta** la fuente corre antes del congelado: formateo,
`lint --fix`, generadores, organización de imports.

```bash
pnpm run lint --fix                   # y cualquier otro normalizador que escriba
git status --short                    # ¿hay trabajo sin commitear?
git stash create                      # devuelve un SHA sin tocar el árbol
```

Después del congelado **solo corren comprobaciones de solo lectura**: lint en modo
comprobación, typecheck, tests, `/code-review`, las lentes. Si algo muta un byte, una ruta o
un modo después de tener el SHA, el candidato deja de existir: se vuelve a normalizar, se
vuelve a congelar y la revisión empieza de nuevo.

No hay tolerancia de "es solo el formateador". Un `lint --fix` posterior al congelado deja
toda la evidencia citando bytes que ya no están, y lo hace en silencio.

`git stash create` produce un commit huérfano con el estado actual y **no modifica el
working tree ni el índice**: se sigue trabajando igual. Ese SHA es el candidato.

Si el trabajo ya está commiteado, el candidato es el rango: `git diff <base>..HEAD`.

Anota el SHA en el documento antes de revisar nada. Toda comprobación posterior lo cita.

---

## 2. Derivar profundidad

De la vía más alta del lote (`via_max` en ODD, la vía más alta de `tasks.md` en SDD). No
del criterio del revisor.

| Vía | Profundidad | Qué corre |
|---|---|---|
| `directo` | **readback estructural** | `git diff --stat`, comprobación de escalada contra `force-completo.md`, lint y build. Silencioso: sin lentes, sin reporte largo. |
| `simple` | **una lente** | lo anterior + `/code-review` sobre el diff congelado + suite del paquete tocado. |
| `completo` | **4R** | lo anterior + Riesgo · Resiliencia · Legibilidad · Fiabilidad en paralelo, refutación, `/security-review` si toca auth/permisos/tenant (C-007), y la tabla con la app arrancada (C-021). |

Una vía `directo` que produce un reporte de tres páginas está mal calibrada: el coste de
revisar debe ser proporcional al riesgo, o se deja de revisar.

**Presupuesto de barrido.** Una lente hace **un** barrido exhaustivo del diff y se detiene;
dos como máximo en `completo`. No existe "seguir buscando hasta que salga limpio": el primer
barrido **es** el primer paso completo. Una lente que vuelve por tercera vez ya no está
revisando el candidato, está revisando su propio reporte.

---

## 3. Registrar hallazgos

Un hallazgo sin identidad no se puede auditar al cerrar. Toda lente escribe sus filas en el
**ledger**, con este esquema:

| Campo | Valores |
|---|---|
| `id` | `{LENTE}-{NNN}` — `R1-001` riesgo, `R2` legibilidad, `R3` fiabilidad, `R4` resiliencia |
| `lente` | riesgo · legibilidad · fiabilidad · resiliencia · code-review · security-review |
| `ubicación` | `ruta/archivo.ts:línea` o `:inicio-fin` |
| `severidad` | BLOCKER · CRITICAL · WARNING · SUGGESTION |
| `estado` | open · fixed · verified · refuted · wont-fix · info |
| `evidencia` | por qué importa, con el hecho concreto que lo respalda |

Si el barrido no encuentra nada, la lente **persiste un ledger vacío**; no omite la sección.
"Sin reporte" y "sin hallazgos" son cosas distintas y el cierre necesita distinguirlas.

**Puerta de precisión.** Se reporta un hallazgo solo si es un defecto real, con impacto para
el usuario, que defenderías con evidencia concreta. Ante la duda, silencio: un nitpick que se
escapa no cuesta nada; un falso positivo cuesta un ciclo de corrección entero. Los hallazgos
de estilo están prohibidos salvo que oculten un defecto.

### Qué bloquea

| Hallazgo | Bloquea |
|---|---|
| Regresión introducida por este diff | sí |
| Violación de la constitución (C-0XX) | sí |
| Coincidencia con `force_completo` no declarada | sí — además reclasifica la tarea |
| Los 5 fallos preexistentes de `retail` tenant-isolation | no (C-022) |
| Deuda anterior que el diff no tocó | no — va a "Hallazgos fuera de alcance" |
| Preferencia de estilo sin regla que la respalde | no |

Un hallazgo preexistente que el candidato no causó se anota, no se arregla de paso: un
revisor que corrige lo que audita destruye la señal del reporte.

**Piso de severidad.** Solo BLOCKER y CRITICAL entran al bucle de corrección. WARNING y
SUGGESTION se reportan **una vez** con `estado: info`, no se re-revisan y no bloquean nunca.
Un WARNING no está `open`: si de verdad hay que arreglarlo, es CRITICAL.

### Refutación — solo en vía `completo`

Antes de corregir nada, la lista **completa** de candidatos BLOCKER/CRITICAL de las cuatro
lentes pasa por `review-refutador`, que devuelve por cada uno `corroborated`, `refuted` o
`inconclusive`.

El techo es **estructural, no por hallazgo**: una sola tarea de refutación —o tres con voto
independiente 2-de-3 cuando el diff toca dinero, guards o migraciones— tenga la lista dos
candidatos o veinte. **Nunca un refutador por candidato.** Un veredicto ausente o malformado
cuenta como `stands`: la duda no borra hallazgos.

Solo lo que sobrevive a la refutación entra al paso 4.

---

## 4. Corrección y convergencia

Si hay hallazgo bloqueante que sobrevivió:

1. Una corrección, con presupuesto congelado: solo lo que el hallazgo nombra. El que corrige
   recibe **el ledger congelado**, no el diff original: no hace descubrimiento de defectos.
2. Se vuelve a congelar (SHA nuevo) y se re-verifica **solo** lo que la corrección tocó. Los
   hallazgos que la corrección resuelve pasan a `fixed`, y a `verified` cuando la
   re-verificación lo confirma.
3. Si sigue fallando, **escala**: se reporta y se espera.

**Presupuesto de convergencia: dos rondas.** Lo que siga `open` después de la segunda ronda se
reporta como abierto al usuario, con su id. El bucle no se extiende.

Una observación que aparece durante la re-verificación es un seguimiento no bloqueante: no
cambia hallazgos, ni ids, ni alcance, ni el contador de rondas.

Un bucle corregir-reverificar sin límite consume más que el trabajo original y suele
indicar que la vía estaba mal asignada.

---

## 5. Separación de poderes

El que implementa no revisa, y el que revisa no arregla. `spec-verifier` tiene el código
de producción en solo lectura. En vía `completo`, la revisión corre en contexto fresco:
el que lleva una hora dentro del cambio ya no lo ve.

---

## Salida

En ODD, la sección "Revisión" de `docs/odd/<slug>.md`. En SDD, `verify.md`.

Ambas empiezan por el SHA del candidato congelado. Un reporte sin SHA no es una revisión:
es una opinión sobre un árbol que ya cambió.
