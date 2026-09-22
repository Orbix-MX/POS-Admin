---
title: Cuentas por Cobrar y Pagar (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-11
tags: [negocio, orbix-erp, finanzas, caja]
---

# Cuentas por Cobrar y Pagar (Orbix)

## ¿Qué es?

El proceso financiero que registra las deudas del negocio con sus proveedores (CxP) y de los
clientes con el negocio (CxC), y el control de efectivo por caja física.

## Objetivo

Que el flujo de efectivo y las deudas pendientes (ambos sentidos) queden trazables desde
cualquier origen: ventas, compras, ajustes manuales — y que el saldo esperado de caja sea
siempre reconstruible desde los movimientos, nunca un número guardado que pueda divergir.

## Flujo

```
CashRegister (caja física, N por sucursal)
  → Apertura de CashSession (monto inicial, encadena con el fondo restante de la
    sesión anterior de esa misma caja)
      → cada cobro/pago genera un CashMovement, con su origen (venta, pago de CxP,
        cobro de CxC, movimiento manual, retiro, devolución) — sin sesión abierta,
        la operación se rechaza
      → arqueo (CashCount, N por sesión: parcial o final) → si la diferencia excede
        el umbral del tenant, exige motivo y pasa a revisión
  → cierre de CashSession (atómico, congela la caja)

CxP: PurchaseOrder recibida → AccountPayable → SupplierPayment(s) hasta saldarla
CxC: venta a crédito o servicio no cobrado → AccountReceivable →
     AccountReceivablePayment(s) hasta saldarla
```

## Reglas de negocio encontradas

- `CashMovement` es el punto de unificación: **todo** ingreso o egreso de efectivo pasa por
  ahí, sin importar si el origen es una venta, un pago a proveedor, un cobro a cliente o un
  movimiento manual. `cashSessionId` es `NOT NULL` con FK `RESTRICT` — no puede existir un
  movimiento huérfano ni borrarse una sesión con movimientos.
- Una `AccountPayable`/`AccountReceivable` puede saldarse con más de un pago
  (`SupplierPayment`/`AccountReceivablePayment` respectivamente) — pagos parciales
  soportados.
- **Caja física independiente de la sesión** (`CashRegister`): una sucursal puede tener
  varias cajas operando a la vez, cada una con su propia sesión viva. La unicidad de "sesión
  abierta" es por caja, no por sucursal.
- **Ciclo de estados de la sesión**: `ABIERTA → EN_ARQUEO → PENDIENTE_REVISION → CERRADA`.
  Mientras está en `EN_ARQUEO` o `PENDIENTE_REVISION` ningún movimiento nuevo entra — la caja
  queda congelada mientras se cuenta. El cierre reclama la sesión de forma atómica
  (`updateMany` condicionado al estado) antes de calcular, así que dos cierres simultáneos no
  pueden ambos prosperar.
- **Diferencia auditable**: si el contado se aparta del esperado más allá de
  `settings.cashDifferenceThreshold` (por tenant; ausente = cualquier descuadre exige
  motivo), el corte requiere `differenceReason` y queda `PENDIENTE_REVISION` hasta que
  alguien con el permiso `pos.cash:authorize` lo firme con sus propias credenciales — no hace
  falta cerrar sesión del cajero. Ese permiso es independiente de `pos.cash:close`: cualquiera
  puede cerrar un corte cuadrado, no cualquiera puede validar uno descuadrado.
- **Retiro de efectivo** (`WITHDRAWAL`, tipo de `CashMovement`, no tabla propia) deja el fondo
  restante encadenado a la apertura de la siguiente sesión de esa caja. Se valida contra el
  efectivo disponible **en la moneda retirada**.
- **Devoluciones** tienen tipo propio `REFUND` (antes se registraban como `EXPENSE` y el
  reporte las mostraba como gasto manual).
- **Multi-moneda**: CxC/CxP capturan `currency` y, si es USD, el tipo de cambio congelado de
  la sesión (`exchangeRateUsed`) más el equivalente en MXN. El resumen de caja separa CASH,
  CARD y TRANSFER por moneda usando ese equivalente — antes CARD/TRANSFER sumaban el importe
  crudo sin distinguir divisa.
- Egresos manuales (`EXPENSE`) exigen motivo obligatorio; ingresos no (no sacan dinero del
  cajón).
- Auditoría completa vía `AuditService`: apertura, cierre, movimiento manual y arqueo quedan
  en `AuditLog` con actor, motivo y estado antes/después.

## Conceptos importantes

| Concepto | Significado |
|---|---|
| CashRegister | Caja física; una sucursal puede tener varias, cada una con sesiones propias |
| CashSession | Periodo de apertura/cierre de una caja, con estado `ABIERTA/EN_ARQUEO/PENDIENTE_REVISION/CERRADA` |
| CashMovement | Cada entrada/salida de efectivo, con su origen — incluye `WITHDRAWAL` y `REFUND` |
| CashCount | Arqueo (parcial o final), N por sesión, con el esperado congelado al momento de contar |
| AccountPayable / AccountReceivable | Deuda con proveedor / de cliente |

## Permisos relevantes

`pos.cash:open` / `pos.cash:close` / `pos.cash:withdraw` / `pos.cash:count` /
`pos.cash:authorize` — cada acción sensible tiene su propio permiso; `authorize` es
deliberadamente más restrictivo que `close`.

## Sistemas que participan

- [[Orbix ERP API]] — módulos `core/cash-sessions`, `core/payables`, `core/receivables`.
- [[Orbix ERP Web]] — páginas `caja`/`caja-restaurante`, `cxp`/`cxc`, `contabilidad`.
- [[Orbix Apps Moviles y Desktop]] — módulo POS de `orbix-mobile` abre/cierra caja y vende
  contra la misma `CashSession`.

## Relaciones con otros procesos

- ← [[Ventas y Punto de Venta (Orbix)]] — toda venta cobrada genera un `CashMovement`.
- ← [[Inventario y Compras (Orbix)]] — toda compra recibida genera una `AccountPayable`.

## Referencia

Auditoría completa (13 hallazgos, 8 fases, veredicto y bitácora de implementación) en
`orbix-admin/docs/AUDITORIA-CAJA.md` del repositorio — no duplicado aquí por extensión;
este documento resume el resultado final, no el proceso.
