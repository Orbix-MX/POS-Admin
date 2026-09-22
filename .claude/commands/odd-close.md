---
description: Cierra una tarea ODD con evidencia, o cierra el trabajo completo
argument-hint: <slug> [T-00N]
---

Cerrar **$ARGUMENTS**.

Sin número de tarea, cierra la primera en `status: doing`. Si no hay ninguna, cierra el
trabajo entero.

Carga, y solo lo que falte en contexto: `docs/odd/<slug>.md` y `.specify/force-completo.md`
de entrada; `.specify/vias.md` en el paso 2 —solo los pasos de **esta** vía—; y
`.specify/rdd.md` en el paso 3. `constitution.md` se cita por id.

## 1. Escalada — obligatoria, antes que nada

```bash
git diff --name-only
git diff
```

Contrasta contra las rutas y los símbolos de `force-completo.md`. Una coincidencia en una
tarea `directo` o `simple`:

1. **Detén el cierre.** La tarea no se cierra.
2. Cambia su `via` a `completo` y su `status` a `escalated`.
3. Regístrala en la tabla de Escaladas con el trigger que coincidió.
4. Repórtalo y espera.

No es un juicio sobre si el cambio es riesgoso. Es una coincidencia de patrón.

## 2. Pasos de la vía

Corre lo que `.specify/vias.md` exige para la vía de la tarea. No saltes pasos porque el
cambio parezca pequeño: el tamaño aparente ya se usó al asignar la vía.

## 3. Revisión

Aplica `.specify/rdd.md`. En resumen:

- **Normaliza y luego congela** con `git stash create`; anota el SHA en la sección Revisión.
  Nada que mute la fuente corre después.
- **Profundidad por `via_max`**: `directo` → readback silencioso · `simple` → una lente
  (`/code-review`) · `completo` → las 4R en paralelo + refutación + `/security-review` si toca
  auth/permisos/tenant + tabla con la app arrancada.
- Bloquea solo lo severo causado por el candidato. Los preexistentes de `retail` (C-022)
  no bloquean y no se "arreglan" cambiando el test.
- Ledger con `id` y estado por hallazgo. Solo BLOCKER/CRITICAL entran al bucle; dos rondas
  como máximo.

Si delegaste algo en este paso, aplica el **gatekeeper** de `.specify/agents.md` antes de usar
su resultado: contrato, artefacto, sin invención, sin drift, coherencia. Un fallo se relanza
una vez; el segundo detiene el cierre.

## 4. Evidencia

Llena `Evidencia:` de la tarea con la salida real del comando, no con la intención de
haberlo corrido. Registra también la **ruta** con la que se ejecutó (`inline` o `delegado`, y
a quién) y la **frontera de rollback**. Actualiza la tabla de Progreso y el **Siguiente paso**.

Si un sub-agente reportó comandos, **re-corre uno** y compara antes de dar la tarea por
cerrada. Un auto-reporte es una afirmación, no evidencia.

## 5. Commit

Cada tarea cierra con un work-unit commit: comportamiento, tests y docs juntos,
Conventional Commits. Antes de proponerlo, comprueba:

- [ ] un solo propósito, y el repo sigue teniendo sentido aplicando **solo** este commit
- [ ] tests y docs de la unidad van dentro
- [ ] el rollback no arrastra trabajo ajeno, y la frontera está escrita
- [ ] el mensaje explica el resultado, no la lista de archivos

**No commitees** (C-024): enseña archivos y mensaje, espera el visto bueno. Sin
`Co-Authored-By` ni trailers (C-025).

Con el visto bueno, anota el SHA en el documento.

## 6. Al cerrar el trabajo completo

- Decide la absorción al vault: aplica
  `brain/vault/AI/Commands/Actualizar documentacion tras un cambio.md`. La entrada de esa
  decisión son los **Aprendizajes** que cada sub-agente dejó en su envelope, más lo que el
  documento registró como hallazgo. El resultado más frecuente y correcto sigue siendo
  **nada**; se reporta igual, con su motivo.
- `status: done` en el frontmatter.

**Los hechos del cierre mandan sobre los snapshots.** Lo que diga la sección Revisión o una
tabla que se llenó hace tres tareas es una foto de ese momento. Si algo se corrigió después,
el cierre registra el estado real y lo dice; no se copia el snapshot viejo ni se reescribe el
histórico para que cuadre.

## Salida

Resultado verificado, **toda** comprobación fallida o pendiente, y el siguiente paso. Nunca
"funciona".
