# ODD — Organic Driven Development

El camino por defecto. Todo el trabajo entra por aquí salvo que el usuario pida SDD.

Un solo documento por trabajo: `docs/odd/<slug>.md`. Contiene objetivo, alcance, tareas,
evidencia, progreso y siguiente paso. No hay fases, ni handoffs, ni artefactos separados.

---

## Los dos ejes

Se deciden por separado y no se confunden.

| Eje | Quién decide | Valores |
|---|---|---|
| **Workflow** | el usuario | ODD (default) · SDD (solo si lo pide) |
| **Vía** | coincidencia de patrón | `directo` · `simple` · `completo` |

SDD **nunca** se activa solo. Ni por tamaño, ni por incertidumbre, ni por riesgo. Si el
trabajo parece merecer un spec, se dice en una línea y se sigue en ODD hasta que el
usuario decida.

La vía, en cambio, no se negocia: la asigna `.specify/force-completo.md`. Una tarea ODD que
toque guards, dinero o migraciones sube a `completo` —con diseño, contrato, tests, app
arrancada, `/security-review` y absorción al vault— **sin convertirse en spec**.

Así la constitución protege igual sin que SDD sea obligatorio nunca.

---

## Protocolo

### 1. Autorizar

¿El pedido permite cambiar código? Una pregunta se responde leyendo. No se abre documento
ni se toca nada para responder "cómo funciona X".

### 2. Explorar

Proporcional al alcance. **Regla de 4 archivos:** si entender el flujo exige leer 4 o más
archivos, delega la exploración en un sub-agente en vez de cargarlos en este contexto.

### 3. Clasificar

| Señal | Resultado |
|---|---|
| ≥2 pasos de implementación con sentido propio | **substancial** → documento ODD |
| un cambio entendido, reversible en un commit | **pequeño** → sin documento |

Un trabajo pequeño no lleva artefacto durable. Crear el documento "por si acaso" es el
desperdicio que ODD existe para evitar.

### 4. Asignar vía — antes de escribir

Para cada tarea, mira qué archivos va a tocar y contrástalos contra
`.specify/force-completo.md`. Entre `directo` y `simple`, elige `simple`.

### 5. Trackear antes de la primera escritura

Crea `docs/odd/<slug>.md` desde `.specify/templates/odd.md`. Reporta en una línea qué
documento creaste y cuántas tareas tiene. **Antes** de tocar código: un documento escrito
después es una reconstrucción, no un registro.

### 6. Implementar tarea por tarea

Cada tarea corre los pasos de su vía (`.specify/vias.md`). Antes de cerrar cualquiera,
la comprobación de escalada de `force-completo.md` es obligatoria.

**Declara la ruta.** Cada tarea registra cómo se ejecutó —`inline` o `delegado`, y a quién—
junto a su evidencia. El criterio es el del presupuesto de contexto de `CLAUDE.md`: 4 o más
archivos para entender un flujo, o 2 o más archivos no triviales que escribir, se delegan. Sin
esa línea, el no-delegar es invisible y nadie puede corregir el hábito.

**Lo que devuelve un sub-agente se comprueba, no se cree.** Envelope y gatekeeper en
`.specify/agents.md`. Antes de cerrar la tarea, re-corre **uno** de los comandos que reportó.

Cada tarea cierra con **un work-unit commit** en la rama de trabajo: comportamiento, tests
y docs juntos, Conventional Commits. El documento registra el SHA como evidencia.
C-024 sigue mandando: se enseñan archivos y mensaje, se espera el visto bueno.

**Evidencia mínima de una tarea cerrada** — las tres, o no está cerrada:

1. comando de test enfocado **y su resultado exacto**;
2. comando o escenario con la app arrancada y su resultado, o un `N/A` que diga por qué no hay
   frontera de runtime (en vía `completo` el `N/A` casi nunca es correcto — C-021);
3. **frontera de rollback**: qué archivos y qué comportamiento se pueden quitar sin arrastrar
   trabajo ajeno. Se escribe aunque la tarea todavía no tenga commit.

### 7. Cerrar

`/odd-close` → revisión según vía (`.specify/rdd.md`) → resultado verificado, comprobaciones
fallidas o pendientes, y siguiente paso. Nunca se cierra con "funciona".

---

## Trazabilidad

ODD no tiene FR ni AC: tiene tareas. La anotación es la misma idea con otro prefijo:

```ts
/** @odd cobro-parcial T-003 */
```

Obligatoria en vías `simple` y `completo`, en el test y en el símbolo. En `directo` no
aplica. `verify-traceability.mjs` es de specs; ODD se verifica leyendo su documento.

---

## Reglas

**Un documento, no un plan.** Objetivo, tareas, evidencia y siguiente paso en el mismo
archivo. Si el documento pasa de ~150 líneas, o era un spec, o son dos trabajos.

**Los hallazgos no autorizan expansión.** Encontrar un bug adyacente no lo mete en el
alcance. Se anota en "Hallazgos fuera de alcance" y se sigue.

**Cambios aceptados.** Un cambio de intención del usuario actualiza objetivo y tareas
juntos: preserva lo completado que siga siendo válido, reabre lo invalidado con su motivo,
y añade lo nuevo. No se reescribe el documento desde cero.

**Checkoffs con prueba observada.** Una tarea se marca hecha con la salida del comando,
no con la intención de haberlo corrido.

**Reanudar.** Antes de continuar un trabajo interrumpido, lee el documento completo y
reconcilia contra el código real. Lo que el documento dice y lo que el árbol tiene pueden
diferir; gana el código, y la diferencia se anota.

**Nunca para ahorrar líneas:** borrar espacios o comentarios, omitir tests, minificar,
abstraer de más, o partir una tarea artificialmente.

---

## Cuándo el usuario querrá SDD

No lo decides tú, pero puedes decirlo en una línea y seguir. Señales legítimas para
sugerirlo —una vez, sin insistir:

- El alcance tiene fases desplegables por separado que necesitan `depends_on`.
- Hay que fijar un contrato con AC verificables antes de escribir código.
- El trabajo va a vivir en varias sesiones con más de un implementador.

Si el usuario no dice "hazlo spec", es ODD.
