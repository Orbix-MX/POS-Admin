# Vías de implementación

Cada tarea lleva un campo `via` —en `tasks.md` si es SDD, en `docs/odd/<slug>.md` si es
ODD—. Determina qué pasos corre `/sdd-implement` u `/odd-close`, qué agentes despacha, qué
profundidad de revisión aplica (`.specify/rdd.md`) y qué se exige para darla por cerrada.

La vía es el eje de **riesgo**, independiente del workflow: la asigna
`.specify/force-completo.md` por coincidencia de patrón, y aplica igual en ODD y en SDD.
Una tarea ODD que toque `force_completo` sube a `completo` dentro de ODD; no se convierte
en spec.

La vía **solo sube**. Bajarla requiere aprobación explícita escrita en la tarea.

---

## `directo`

Cambio sin comportamiento nuevo observable.

**Pasos:** implementar.

**Agente:** el principal, sin delegar.

**Cierre:**
- `pnpm run lint` y `pnpm run build` en verde
- suite del paquete tocado en verde

**Anotación `@spec`:** solo si la tarea implementa un FR.

**Requiere las tres a la vez:**
- no toca schema, guards ni lógica de negocio
- no cambia comportamiento observable desde fuera
- se revierte con un solo commit

Ejemplos reales: renombrar una variable muerta (`needsRefetch`), incluir un campo ya
disponible en una respuesta, corregir un texto de la UI.

---

## `simple`

Comportamiento nuevo, acotado a un módulo, sin tocar nada de `force_completo`.

**Pasos:** escribir el test del AC → implementar → verde.

**Agente:** `backend-code-analyst` o `ui-ux-frontend-analyzer` según la capa.

**Cierre:**
- todo lo de `directo`
- test nuevo que nombra su AC en la anotación
- el verificador enlaza AC → test → símbolo

**Anotación `@spec`:** obligatoria en el test y en el servicio.

```ts
/** @spec INV-002 FR-004 */
private resolveSingleVariant(...) { ... }

/** @spec INV-002 AC-004 */
it('rechaza el movimiento sin variantId cuando hay varias variantes', ...)
```

**Es el default cuando dudas.** Entre `directo` y `simple`, `simple`.

---

## `completo`

Toca `force_completo`, o cruza módulos, o no es reversible.

**Pasos:**

1. **Diseño** — `plan-architect` lee el spec, el vault y el código real. Produce el
   apartado técnico y, si hay contrato, `contracts/`.
2. **Contrato** — DTO, OpenAPI o delta de `schema.prisma`, revisados antes de escribir
   implementación.
3. **Tests** — unitarios + integración; e2e si cruza capas, vía `e2e-test-orchestrator`.
4. **Implementar.**
5. **Verificar con la app arrancada** — `curl` contra el endpoint real, evidencia pegada
   en `verify.md`. Tests en verde no sustituyen este paso (C-021).
6. **Revisar** — `/security-review` si toca auth, permisos o tenant.
7. **Absorber** — `vault-curator` aplica
   `vault/AI/Commands/Actualizar documentacion tras un cambio.md`. El resultado esperado
   más frecuente es "no se toca nada"; eso también se reporta.

**Cierre:**
- todo lo de `simple`
- tabla de comprobaciones con la app encendida en `verify.md`
- orden de despliegue explícito si cambia un contrato publicado (C-019)
- vault actualizado, o justificación escrita de por qué no

---

## Escalada

`/sdd-implement`, antes de cerrar cualquier tarea:

```bash
git diff --name-only    # contra las rutas de force_completo
git diff                # contra los símbolos de force_completo
```

Una coincidencia en una tarea `directo` o `simple` **detiene la tarea**. El agente
reclasifica a `completo`, lo escribe en `tasks.md` y lo reporta. No la termina.

Esto no se confía al criterio del agente: el que lleva veinte minutos dentro de una tarea
tiene todo el incentivo de declararla acotada para cerrarla.

---

## Cobertura sin test

Un FR cubierto únicamente por tareas `directo` no tiene test que lo enlace: su cadena
`FR → AC → test` queda cortada.

`/sdd-verify` los lista como **cobertura sin test**. No bloquea el cierre, pero un spec con
la mitad de sus FRs ahí está aprobado sobre menos evidencia de la que aparenta.

---

## Presupuesto de entrega

La vía mide riesgo. Esto mide **cuánto puede revisar una persona de una sentada**, que es un
eje distinto y se lleva mal por su cuenta: un lote de 1 200 líneas en vía `simple` se aprueba
por cansancio.

**Referencia: ~400 líneas autoradas** (`additions + deletions`, sin contar generados) por lote
entregable. Al abrir el documento ODD o `tasks.md`, estima el total y déjalo escrito; al cerrar
cada tarea, actualiza el conteo real.

```
Decisión antes de implementar: Sí | No
Trocear recomendado:           Sí | No
Riesgo de presupuesto (400):   Bajo | Medio | Alto
```

Cuando el pronóstico o el conteo pasen el umbral, aplica la estrategia elegida para el trabajo:

| Estrategia | Qué hace |
|---|---|
| `preguntar` (default) | se detiene y pregunta si trocear o seguir con excepción registrada |
| `trocear` | parte en lotes por unidad de trabajo, sin preguntar |
| `uno-solo` | sigue, pero la excepción queda escrita en el documento con su motivo |

Un valor que no sea uno de esos tres **no se mapea al más cercano**: se detiene y se reporta.

**Es una heurística de planificación, no un criterio de aceptación.** Si la solución correcta
y clara pasa de 400 de forma natural, se explica en una línea y se sigue. Lo que **nunca** se
hace para bajar el número: borrar espacios o comentarios, omitir tests, minificar, abstraer de
más, o partir una tarea de forma artificial.
