---
description: Verifica un spec contra su implementación y produce verify.md
argument-hint: <id del spec>
---

Verificar **$ARGUMENTS**.

Delega en `spec-verifier` — pásale la **ruta** del spec y de `tasks.md`, no un resumen: los
lee él. Ese agente **no arregla nada**: reporta.

## 0. Congelar el candidato

```bash
git status --short
git stash create          # SHA del candidato; no toca el árbol ni el índice
```

Anota el SHA en `verify.md` **antes** de verificar nada. Toda comprobación posterior lo
cita. No se verifica el árbol vivo: si cambia durante la verificación, la evidencia deja de
corresponder a lo que se aprueba. Detalle en `.specify/rdd.md`.

Si el trabajo ya está commiteado, el candidato es el rango `git diff <base>..HEAD`.

## 1. Trazabilidad — automática

```bash
node .specify/verify-traceability.mjs $ARGUMENTS
```

Reporta tres cosas y cada una significa algo distinto:

- **Huérfanos** — un FR/BR/AC que ningún `@spec` nombra. Es un requisito sin evidencia.
  Bloquea el cierre.
- **Referencias muertas** — un `@spec` que apunta a un requisito que no existe. Casi
  siempre es un id mal escrito, o un requisito que se renumeró. Bloquea.
- **Cobertura sin test** — FRs cubiertos solo por tareas `directo`. No bloquea; se
  declara en `verify.md`.

## 2. Suite

```bash
cd api && pnpm run lint && pnpm run build && pnpm run test
```

Los fallos preexistentes de `retail` tenant-isolation (C-022) no cuentan como regresión —
pero tampoco se "arreglan" cambiando el test para que pase.

## 3. Con la app arrancada

Obligatorio en vía `completo`, y en cualquier cambio que toque guards, interceptores, DI o
AsyncLocalStorage. La suite unitaria no prueba el cableado (C-021).

Arranca la API, ejecuta cada AC del spec contra el endpoint real con `curl`, y pega la
salida. Incluye siempre:

- el caso válido
- el mismo caso con un recurso de otro tenant
- el mismo caso sin el permiso requerido

Anota puerto, tenant y sucursal. Si creaste datos temporales, bórralos y dilo.

## 4. Profundidad de revisión

Según la vía más alta de `tasks.md` (`.specify/rdd.md` § 2):

| Vía | Qué añade |
|---|---|
| `directo` | nada más: readback estructural, silencioso |
| `simple` | `/code-review` sobre el diff congelado |
| `completo` | 4R + `/security-review` si toca auth/permisos/tenant (C-007) |

Bloquea solo lo severo **causado por el candidato**. Una corrección acotada; si sigue
fallando, escala y espera.

## Salida

`verify.md` junto al spec, desde `.specify/templates/verify.md`. Empieza por el SHA del
candidato congelado.

`result: pass` solo si no hay huérfanos ni referencias muertas, la suite está en verde
salvo los preexistentes conocidos, y la tabla de la app arrancada está llena.

Si `pass`, propón mover el spec a `status: implemented` — pero no lo edites tú.

**Pass no es entregado.** C-024 sigue mandando: no se commitea sin permiso explícito.
