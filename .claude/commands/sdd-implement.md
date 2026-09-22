---
description: Ejecuta una tarea del spec por su vía, con escalada automática
argument-hint: <id del spec> [T-00N]
---

Ejecutar tareas de **$ARGUMENTS**.

Sin número de tarea, toma la primera en `status: todo` cuyas dependencias estén cerradas.

## Carga

Solo lo que falte en contexto, y en este orden:

1. `tasks.md` — la tarea y sus dependencias
2. `.specify/force-completo.md` — para la comprobación de escalada
3. `.specify/vias.md` — solo los pasos de **esta** vía
4. el spec — solo los FR/BR/AC que la tarea dice `covers`

`constitution.md` no se carga entera: se cita por id y se lee la sección cuando una regla
aplica de verdad. **No releas lo que ya está en este contexto.**

## Despacho

Sigue **exactamente** los pasos que `.specify/vias.md` define para la vía de la tarea. No
saltes pasos porque el cambio parezca pequeño: el tamaño aparente ya se usó al asignar la
vía.

- `directo` — implementar
- `simple` — test del AC primero, luego implementar
- `completo` — los siete pasos, incluida la verificación con la app arrancada

**Declara la ruta.** Antes de ejecutar cada paso, di si va `inline` o `delegado` —y a quién—,
y anótalo en la tarea junto a su evidencia. El criterio está en `CLAUDE.md` § Presupuesto de
contexto: 4 o más archivos para entender un flujo, o 2 o más archivos no triviales que
escribir, se delegan. Sin declararla, el no-delegar es invisible.

**No relances lo mismo.** Lleva la cuenta de los pares `(paso, tarea)` que ya despachaste en
esta sesión. Si el par ya está, no se relanza.

## Gatekeeper — tras cada resultado delegado

Antes de encadenar el siguiente paso, comprueba lo que devolvió el sub-agente, según
`.specify/agents.md`:

| Chequeo | Qué se mira |
|---|---|
| Contrato | los seis campos del envelope, `estado: ok` |
| Artefacto | lo que declara existe y se lee |
| Sin invención | archivos, símbolos y comandos citados existen — se comprueban |
| Sin drift | lo producido es consistente con la tarea y los FR/AC que `covers` |
| Coherencia | el siguiente paso respeta el orden de la vía |

Un fallo: se relanza **el mismo** paso una vez, con el defecto concreto en el prompt. Si el
segundo resultado también falla, **se detiene la tarea** y se reporta. No se lanza el paso
dependiente.

Antes de cerrar, **re-corre uno** de los comandos que el sub-agente reportó y compara.

## Anotaciones

Toda función y todo test que implemente un requisito lleva su marca, o la cadena de
trazabilidad queda rota y `/sdd-verify` lo reporta como huérfano:

```ts
/** @spec INV-002 FR-001, BR-001 */
```

## Comprobación de escalada — obligatoria antes de cerrar

```bash
git diff --name-only
git diff
```

Contrasta contra las rutas y los símbolos de `.specify/force-completo.md`. Una coincidencia
en una tarea `directo` o `simple`:

1. **Detén la tarea.** No la termines.
2. Cambia su `via` a `completo` y su `status` a `escalated`.
3. Regístrala en la tabla de Escaladas de `tasks.md` con el trigger que coincidió.
4. Repórtalo y espera.

Esto no es un juicio sobre si el cambio "realmente" es riesgoso. Es una coincidencia de
patrón.

## Al cerrar

Marca `status: done`. **No commitees** (C-024): enseña archivos y mensaje, espera el visto
bueno.
