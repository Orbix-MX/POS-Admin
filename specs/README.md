# Specs

Specs SDD de Orbix ERP. Metodología en `.specify/` — plantillas, constitución y vías; los
comandos que la ejecutan, en `.claude/commands/sdd-*.md`.

Ruta: `specs/<vertical>/<ID>-<slug>/spec.md`, con `tasks.md`, `verify.md` y `contracts/` al
lado cuando el ciclo avanza.

Un spec no pasa a `tasks.md` hasta que su `status` es `approved` y su §11 dice "Ninguna".
Aprobar es del usuario, no del agente.

---

## Bloque 3 — Venta completa (móvil)

Origen: `apps/mobile/orbix-mobile/docs/faltantes-app-comercial.md` §3, la prioridad que sigue
al bloque 2 (puerta de entrada), cerrado en `a81cc42`.

El bloque no es una unidad desplegable: son siete, y por eso son siete specs. Un solo
documento con catorce faltantes tendría un `status` que no puede ser verdad.

| Spec | Qué entrega | Capa | Depende de |
|---|---|---|---|
| [POS-001](retail/POS-001-idempotencia-de-la-venta/spec.md) · Idempotencia de la venta | Que un reintento no cree una segunda venta | Servidor + móvil | — |
| [POS-002](retail/POS-002-sucursal-explicita-en-el-punto-de-venta/spec.md) · Sucursal explícita en el punto de venta | Elegir y recordar dónde se vende | Móvil | — |
| [POS-003](retail/POS-003-cliente-y-descuento-en-la-venta/spec.md) · Cliente y descuento en la venta | A quién se vendió y cuánto se rebajó | Móvil | — |
| [POS-004](retail/POS-004-presentaciones-vendibles-en-el-punto-de-venta/spec.md) · Presentaciones vendibles en el punto de venta | Vender la talla correcta sin escanear | Móvil | — |
| [POS-005](retail/POS-005-carrito-que-sobrevive/spec.md) · Carrito que sobrevive | Persistencia, suspender y retomar, tope por existencia | Móvil | POS-003, POS-004 |
| [POS-006](retail/POS-006-cobro-compuesto/spec.md) · Cobro compuesto | Pago mixto, dólares y crédito | Móvil (+ servidor si entra el límite de crédito) | POS-001, POS-003 |
| [POS-007](retail/POS-007-cupon-en-la-venta/spec.md) · Cupón en la venta | Canjear un código en el mostrador | Móvil | POS-003 |

```
POS-001 ──────────────┐
POS-002 (suelto)      ├──> POS-006
POS-003 ──┬───────────┘
          ├──> POS-005 <── POS-004
          └──> POS-007
```

**Orden recomendado:** POS-001 → POS-002 → POS-003 → POS-004 → POS-006 → POS-005 → POS-007.

POS-001 va primero aunque no sea el más pedido: todos los demás añaden campos a la misma
operación de cobro, y retroajustar la idempotencia obliga a volver a probar cada camino de
pago. POS-002 no es del bloque 3 —sale de §5 del mismo documento— pero sin él el punto de
venta no arranca en un negocio con dos sucursales, así que todo lo demás se probaría solo en
el caso de una.

### Lo que el bloque 3 tiene y aquí no está

| Faltante del §3 | Por qué no hay spec |
|---|---|
| Notas en la venta | El campo ya existe en el contrato; es una tarea, no un spec — sin regla de negocio ni contrato nuevo, no hay spec |
| IVA por defecto del tenant en la previsión | Es exponer un campo del servidor. Tarea suelta, con su ADR padre |
| Comprobante por WhatsApp · en PDF · impresión Bluetooth | Es entrega del comprobante, no la venta. Bloque propio, después de que la venta esté completa |

---

## Estado del ciclo

Los siete están en `status: draft` y con preguntas abiertas reales en su §11. Ninguno puede
descomponerse todavía: el gate de `/sdd-tasks` exige `approved` y §11 en "Ninguna".

Las preguntas que más trabajo mueven, por si conviene cerrarlas antes que el resto:

- **POS-003 §11.1** — ¿el descuento se captura sobre la venta (como la terminal web) o por
  renglón (como pide el documento de faltantes)? Cambia cuatro requisitos del spec.
- **POS-006 §11.1** — el límite de crédito del cliente se guarda y **nadie lo valida al
  vender**. Validarlo es regla nueva y trabajo de servidor.
- **POS-007 §11.1** — no hay regla escrita sobre acumular cupón y descuento manual. El vault
  lo marca como *requiere validación*.
- **POS-004 §11.1** — hay que verificar si la lista de productos ya trae las presentaciones
  con precio y existencia. Si no, aparece trabajo de servidor que hoy no está contado.

## Aviso sobre la trazabilidad

`.specify/verify-traceability.mjs` recorre `api/src`, `api/test`, `web/src` y
`apps/pos-web/src`. **No recorre `apps/mobile/orbix-mobile/src`**, que es donde vive casi todo
este bloque: sus anotaciones `@spec` no se encuentran, y cada requisito cubierto solo en el
móvil aparecería como huérfano, bloqueando el cierre.

Es un renglón en `SCAN_ROOTS`. Hay que arreglarlo antes de cerrar el primer spec del bloque.
