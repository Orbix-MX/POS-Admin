---
description: Revisa un candidato congelado, con profundidad derivada de la vía
argument-hint: [slug ODD | ID de spec | rango git]
---

Revisar **$ARGUMENTS**. Sin argumento, revisa el working tree actual.

Carga `.specify/rdd.md` y `.specify/force-completo.md`. Nada más hasta saber la
profundidad.

Este comando **no arregla**: reporta. Un revisor que corrige lo que audita destruye la
señal del reporte.

## 1. Congelar

**Primero lo que muta.** Formateadores, `lint --fix`, generadores: todo eso corre **antes** del
congelado. Después del SHA solo corren comprobaciones de solo lectura. Si algo muta un byte
después, el candidato deja de existir y se vuelve a empezar.

```bash
pnpm run lint --fix       # y cualquier otro normalizador que escriba
git status --short
git stash create          # SHA del candidato; no toca el árbol ni el índice
```

Si el trabajo ya está commiteado, el candidato es `git diff <base>..HEAD`.

Anota el SHA **antes** de revisar nada. Toda comprobación posterior lo cita. Un reporte sin
SHA es una opinión sobre un árbol que ya cambió.

## 2. Derivar profundidad

De la vía más alta del lote: `via_max` del documento ODD, o la vía más alta de `tasks.md`.
Sin documento, derívala del diff contra `force-completo.md`.

| Vía | Qué corre |
|---|---|
| `directo` | `git diff --stat`, escalada contra `force-completo.md`, lint, build. **Silencioso**: sin lentes, sin reporte largo. |
| `simple` | lo anterior + `/code-review` sobre el diff congelado + suite del paquete tocado |
| `completo` | lo anterior + 4R + refutación + `/security-review` si toca auth/permisos/tenant (C-007) + tabla con la app arrancada (C-021) |

No subas la profundidad por intuición. Si crees que hace falta más, di por qué y qué
trigger de `force_completo` debería cubrirlo — esa es información sobre la lista, no sobre
este diff.

## 3. Las 4R — solo en vía `completo`

Despacha las cuatro lentes **en paralelo, en contexto fresco**, cada una con el SHA del
candidato y nada más:

`review-riesgo` · `review-legibilidad` · `review-fiabilidad` · `review-resiliencia`

Cada una hace **un** barrido y devuelve sus filas del ledger. Fusiónalas conservando los `id`.

Después, **una sola** tarea de `review-refutador` con la lista completa de candidatos
BLOCKER/CRITICAL —tres con voto 2-de-3 si el diff toca dinero, guards o migraciones—. Nunca
un refutador por hallazgo. Solo lo `corroborated` o `inconclusive` sigue vivo.

Aplica el gatekeeper de `.specify/agents.md` a lo que devuelva cada lente antes de fusionar:
una lente que cita un archivo inexistente se relanza una vez, y si vuelve a fallar se reporta
sin su fila.

## 4. Admitir

Bloquea solo lo severo **causado por el candidato**: regresión de este diff, violación de
la constitución, o coincidencia con `force_completo` no declarada — esta última además
reclasifica la tarea.

No bloquean: los 5 preexistentes de `retail` tenant-isolation (C-022), la deuda anterior
que el diff no tocó, ni la preferencia de estilo sin regla que la respalde. Van a
"Hallazgos fuera de alcance".

**Piso de severidad:** solo BLOCKER y CRITICAL entran al paso 5. WARNING y SUGGESTION se
reportan una vez con `estado: info` y no se vuelven a mirar.

## 5. Corrección

Con presupuesto congelado: solo lo que el hallazgo nombra. El que corrige recibe el ledger, no
el diff original. Se vuelve a congelar y se re-verifica **solo** lo que la corrección tocó.

**Dos rondas como máximo.** Lo que siga `open` tras la segunda se reporta al usuario con su
`id`. El bucle no se extiende.

## Salida

Envelope fijo, en este orden:

```
resultado:   aprobado | bloqueado | escalado
candidato:   <SHA>
profundidad: directo | simple | completo
ledger:      <n filas · n BLOCKER · n CRITICAL · n info · n refuted>
bloqueantes: <ids y una línea cada uno, o "ninguno">
fuera de alcance: <lista, o "ninguno">
rondas:      <0 | 1 | 2>
siguiente:   <una línea>
```

Y escríbelo en la sección Revisión de `docs/odd/<slug>.md` o en `verify.md`.

**Aprobado no es entregado.** C-024 sigue mandando: no se commitea sin permiso explícito.
