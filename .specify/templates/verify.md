---
spec: XXX-000
verified: <YYYY-MM-DD>
result: pending              # pending | pass | fail
---

# Verificación — <Nombre del spec>

## Trazabilidad

<!-- Salida de /sdd-verify. Un hueco aquí es un requisito sin evidencia. -->

| Requisito | Cubierto por | Anotado en |
|---|---|---|
| FR-001 | AC-001 | `products.service.ts` · `<archivo>.spec.ts` |

**Huérfanos:** <FR/BR/AC sin ninguna anotación `@spec` que los nombre. Debe ser vacío.>

**Cobertura sin test:** <FRs cubiertos solo por tareas `directo`. No bloquea; se declara.>

## Automática

```
pnpm run lint
pnpm run build
pnpm run test
```

| Comprobación | Resultado |
|---|---|
| Suites / tests | |
| Specs nuevos | |
| Fallos preexistentes de retail tenant-isolation (C-022) | no cuentan |

## Con la app arrancada

<!--
Obligatorio en vía `completo` y en cualquier cambio que toque guards, interceptores, DI
o AsyncLocalStorage: la suite unitaria no prueba el cableado (C-021).

Anota puerto, tenant y sucursal usados, y si creaste datos temporales, que se borraron.
-->

Entorno: API en `:____`, tenant `____`, sucursal `____`.

| Comprobación | Esperado | Resultado |
|---|---|---|
| El contenedor de Nest resuelve los proveedores nuevos | arranca sin error | |
| <endpoint> con <caso válido> | 200 | |
| <endpoint> con recurso de otro tenant | 403 / 404 | |
| <endpoint> sin el permiso requerido | 403 | |

## Revisión

**Candidato congelado:** `<SHA>` — normalizadores corridos **antes** del congelado.

### Ledger

<!--
Esquema y reglas en `.specify/rdd.md` §3. Si una lente no encontró nada, se deja constancia:
"sin hallazgos" y "sin revisar" no son lo mismo. Solo BLOCKER/CRITICAL entran al bucle de
corrección; dos rondas como máximo.
-->

| id | Lente | Ubicación | Severidad | Estado | Evidencia |
|---|---|---|---|---|---|

**Refutación:** <n candidatos · n corroborated · n refuted · n inconclusive>, o "no aplica
(vía ≠ completo)".

**Rondas de corrección:** 0 / 2 · **abiertos al cierre:** <ids, o "ninguno">

- [ ] `/security-review` — obligatorio si toca auth, permisos o tenant (C-007)
- [ ] Orden de despliegue declarado, si cambia un contrato publicado (C-019)
- [ ] Spot check: un comando reportado por un sub-agente, re-corrido por el padre

## Absorción al vault

<!--
Aplica `vault/AI/Commands/Actualizar documentacion tras un cambio.md`. La entrada son los
Aprendizajes que cada sub-agente dejó en su envelope. El resultado más frecuente y correcto
es "nada". Se reporta igual.
-->

| Documento | Cambio | Motivo |
|---|---|---|

<O bien:> **Nada que documentar.** <Por qué.>
