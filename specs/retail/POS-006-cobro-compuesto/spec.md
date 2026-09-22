---
id: POS-006
name: Cobro compuesto — pago mixto, dólares y crédito
status: draft
version: 1.0
vertical: retail
module: orders
priority: high
branch: feat/POS-006-cobro-compuesto
parent: Domain/Cuentas por Cobrar y Pagar (Orbix)
depends_on: [POS-001, POS-003]
migration: none
reversible: true
---

# Cobro compuesto — pago mixto, dólares y crédito

## 1. Objetivo

Que el cobro del móvil acepte las tres formas de pagar que un mostrador real usa a diario y
que hoy solo existen en el servidor: repartir el pago entre varios métodos, cobrar en dólares
al tipo de cambio congelado del turno, y fiar.

Hoy el cobro es un método y una moneda. El cliente que paga mitad en efectivo y mitad con
tarjeta no se puede atender; el que paga con un billete de veinte dólares tampoco; y el
cliente con crédito autorizado —que ya se configura en su ficha, con límite y días— no puede
comprar a crédito desde el móvil.

## 0. Alternativas descartadas

**Entrar antes que la idempotencia.** Es la tentación, porque el pago mixto es lo que más se
pide. Pero el cobro compuesto multiplica los caminos de reintento: un pago repartido en tres
métodos que falla a medias es exactamente el escenario que duplica ventas, movimientos de
caja y cuentas por cobrar. Poner la idempotencia después obliga a volver a probar los tres
caminos con todas sus combinaciones. De ahí el `depends_on` en `POS-001`.

**Cobrar a crédito sin cliente identificado.** Una cuenta por cobrar sin deudor no es una
cuenta por cobrar. Por eso el `depends_on` en `POS-003`.

## 2. Alcance

### Dentro
- Reparto del cobro entre varios métodos en una sola venta.
- Cobro en dólares, con el tipo de cambio de la sesión de caja.
- Cambio a devolver, en la moneda que corresponda.
- Venta a crédito contra un cliente con crédito autorizado.
- Lo que el cajero ve mientras reparte: cuánto falta, cuánto sobra, qué cambio sale.

### Fuera
- Abonos posteriores a una venta a crédito, y la pantalla de cuentas por cobrar. Es el bloque
  de clientes y cobranza.
- Apartados y anticipos.
- Terminal bancaria integrada. "Tarjeta" sigue siendo una declaración del cajero.
- Configurar el tipo de cambio. Ya se captura al abrir la caja.
- Monedas distintas de peso y dólar. El contrato del servidor solo admite esas dos.

## 3. Actores

- **Cajero** — reparte el cobro y entrega el cambio.
- **Cliente con crédito** — compra sin pagar hoy.
- **Quien cuadra la caja** — necesita que el efectivo, la tarjeta y los dólares queden
  separados y convertidos igual que en el corte.

## 4. Requisitos funcionales

### FR-001
El cobro MUST permitir repartir el importe de la venta entre varios métodos de pago.

### FR-002
El cobro MUST mostrar en todo momento cuánto falta por cubrir y, cuando lo recibido supera el
total, cuánto cambio sale.

### FR-003
El cobro MUST impedir confirmar una venta cuyo reparto no cubre el total, salvo que la parte
no cubierta sea a crédito.

### FR-004
El cobro MUST permitir capturar un pago en dólares, y MUST mostrar el tipo de cambio con el
que se convierte.

### FR-005
El tipo de cambio aplicado MUST ser el de la sesión de caja abierta, no uno capturado en el
cobro.

### FR-006
El cobro MUST permitir registrar la venta a crédito, total o parcialmente, contra el cliente
asignado.

### FR-007
El sistema MUST impedir el cobro a crédito sin cliente asignado.

### FR-008
Al registrar una venta a crédito, el sistema MUST dejar la cuenta por cobrar del cliente por
el saldo no pagado, no por el total.

### FR-009
El ticket y el detalle de la venta MUST mostrar cada pago con su método, su moneda y su
importe.

## 5. Reglas de negocio

### BR-001
Una venta puede tener más de un pago. **Regla existente**, del modelo unificado de venta; se
cita, no se reescribe.

### BR-002
El tipo de cambio de un pago en dólares es el congelado en la sesión de caja, y queda grabado
en el movimiento. El resumen de caja separa efectivo, tarjeta y transferencia por moneda
usando ese equivalente. **Regla existente**, ya implementada; se cita.

### BR-003
El crédito no es un pago: es la ausencia de uno. No entra al efectivo esperado de la caja, no
genera movimiento de caja, y genera una cuenta por cobrar por el saldo. **Regla existente**,
ya implementada en el servidor; lo que este spec origina es que la interfaz la muestre así en
lugar de presentarla como un método más (C-017).

### BR-004
El crédito exige cliente identificado. Sin deudor no hay cuenta por cobrar.

### BR-005
El método de crédito se nombra `CREDITO` en el contrato, no `CREDIT`. No es un detalle
cosmético: el servidor decide con esa cadena exacta si el importe entra a la caja o a la
cuenta por cobrar, y un valor distinto lo trataría como un método de efectivo desconocido.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001, FR-002, FR-009
Dada una venta de 300
Cuando el cajero captura 100 en efectivo y 200 con tarjeta
Entonces el faltante llega a cero, la venta se registra con dos pagos, y el ticket los muestra
por separado.

### AC-002 · Covers: FR-003
Dada una venta de 300
Cuando el cajero captura 100 en efectivo y nada más
Entonces no puede confirmar el cobro, y ve que faltan 200.

### AC-003 · Covers: FR-002
Dada una venta de 300 y una sesión de caja abierta
Cuando el cajero captura 500 en efectivo
Entonces se le muestra un cambio de 200, y la venta se registra con ese cambio.

### AC-004 · Covers: FR-004, FR-005, BR-002
Dada una sesión de caja abierta con tipo de cambio 18.50 y una venta de 370
Cuando el cajero captura un pago de 20 dólares
Entonces la venta queda cubierta, el pago se registra en dólares con el tipo de cambio 18.50 y
su equivalente en pesos, y el cajero vio ese tipo de cambio antes de confirmar.

### AC-005 · Covers: FR-005
Dada una sesión de caja cuyo tipo de cambio se capturó al abrir
Cuando el cajero cobra en dólares
Entonces no se le pide ni se le permite capturar otro tipo de cambio.

### AC-006 · Covers: FR-006, FR-008, BR-003
Dada una venta de 1000 y un cliente con crédito autorizado
Cuando el cajero cobra 400 en efectivo y deja 600 a crédito
Entonces la venta se registra, la caja recibe 400 y no 1000, y el cliente queda con una cuenta
por cobrar de 600.

### AC-007 · Covers: FR-007, BR-004
Dada una venta sin cliente asignado
Cuando el cajero intenta dejar parte a crédito
Entonces no puede, y se le indica que hace falta identificar al cliente.

### AC-008 · Covers: FR-003, BR-003
Dada una venta de 1000 con 600 a crédito
Cuando el cajero confirma con solo 400 capturados
Entonces la venta se registra: el faltante cubierto por crédito no bloquea la confirmación.

### AC-009 · Covers: BR-005
Dado un cobro parcialmente a crédito
Cuando la venta se envía
Entonces el método del pago a crédito viaja como `CREDITO`, y el servidor no lo suma al
efectivo de la caja.

### AC-010 · Covers: BR-004
Dado un cliente del tenant A con crédito autorizado
Cuando un usuario del tenant B intenta cobrarle a crédito
Entonces la venta se rechaza.

### AC-011 · Covers: FR-006
Dado un dispositivo sin sesión de caja abierta
Cuando el cajero intenta cobrar
Entonces la venta se rechaza, igual que hoy, sin importar la forma de pago.

## 7. Contrato

Sin endpoints nuevos. Todo está declarado y en uso desde otros clientes; lo que falta es la
interfaz del cobro.

```
POST /api/orders
{
  "paymentMethod": "CASH",
  "payments": [
    { "method": "CASH",     "currency": "MXN", "amount": 100, "amountReceived": 500, "changeGiven": 200 },
    { "method": "CARD",     "currency": "MXN", "amount": 200 },
    { "method": "CREDITO",  "amount": 600 }
  ],
  "changeAmount": 200,
  "changeCurrency": "MXN",
  "customerId": "<uuid>",
  "dueDate": "<ISO 8601>"
}
```

- `payments[]` — cuando viene, manda sobre `paymentMethod` para los registros de pago.
- `method` — `CASH`, `CARD`, `TRANSFER` o `CREDITO`.
- `currency` — `MXN` o `USD`. El tipo de cambio no viaja: lo pone el servidor desde la sesión
  de caja abierta (BR-002).
- `dueDate` — vencimiento del crédito; por omisión, 30 días.

`tenantId` no viaja: se resuelve desde `TenantContextService` (C-001).

## 8. Persistencia

Entidades afectadas: ninguna en su forma. `Payment` con moneda y tipo de cambio,
`CashMovement` y `AccountReceivable` ya existen y ya se escriben desde este mismo endpoint.

Restricciones en base: ninguna nueva. Migración: **none**.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/payment-split.spec.ts` | AC-001, AC-002, AC-003, AC-008 |
| `apps/mobile/orbix-mobile/src/features/pos/usd-payment.spec.ts` | AC-004, AC-005 |
| `apps/mobile/orbix-mobile/src/features/pos/credit-payment.spec.ts` | AC-007, AC-009 |
| `api/src/modules/retail/orders/orders.mixed-credit.spec.ts` (casos nuevos) | AC-006, AC-010 |

La aritmética del reparto —faltante, cambio, conversión a pesos— va a módulos puros y se
prueba con casos de redondeo adversos. Es el mismo criterio que la suite de importes de caja.

AC-011 y la verificación de que el resumen de caja refleja los importes correctos se hacen con
la app arrancada (C-021).

### Cambian de significado
| Archivo | Por qué |
|---|---|
| Los casos del cobro móvil que asumen un solo método | El cobro pasa de "un método" a "uno o varios"; el camino de un método se conserva |

### Se conservan como red de seguridad
- `orders.payment-parity.spec.ts` y `orders.price-payment-integrity.spec.ts`: son la red que
  impide que un reparto mal construido cobre de menos.
- `orders.mixed-credit.spec.ts` en lo ya cubierto.
- Las pruebas del resumen de caja por moneda.

## 10. Riesgos

- **Que el crédito parezca un método de pago.** Si la interfaz lo pone como un botón más al
  lado de efectivo y tarjeta, el cajero cerrará ventas a crédito sin darse cuenta de que no
  entró dinero. Es el riesgo de negocio más caro de este spec.
- **Conversión hecha en el cliente.** Si el móvil convierte dólares a pesos para decidir si el
  total está cubierto, y el servidor convierte con otro redondeo, hay ventas que se confirman
  y el servidor rechaza —o peor, que se cierran cobrando de menos. La conversión mostrada es
  informativa; la que cuenta es la del servidor.
- **Tipo de cambio de una sesión que no es la del dispositivo.** El tipo de cambio sale de la
  sesión de caja abierta. Con dos cajas en la sucursal, tiene que ser la del dispositivo — que
  es justo lo que resolvió el vínculo de caja al dispositivo. Hay que verificar que el camino
  del cobro respeta ese vínculo.
- **Límite de crédito no validado.** El límite y los días se guardan en la ficha del cliente,
  pero **ninguna validación del servidor los usa al vender a crédito**. Hoy se puede fiar sin
  tope. Este spec lo expone; ver §11.
- La tarea toca dinero, cuentas por cobrar y caja: vía `completo` por ruta y por dominio.

## 11. Preguntas abiertas

1. **Límite de crédito.** Está en la ficha del cliente y nadie lo comprueba al vender. ¿Se
   valida en este spec —regla de negocio nueva, cambio de servidor— o se declara como hueco
   conocido y se atiende aparte? Inclinación: validarlo aquí; vender a crédito sin tope
   convierte el campo en decorativo, que es justo lo que C-017 prohíbe.
2. **Cambio en dólares.** El contrato admite devolver el cambio en la moneda que se elija.
   ¿Debe el móvil ofrecerlo, o el cambio siempre sale en pesos? Devolver dólares exige que
   haya dólares en el cajón y que el arqueo los cuente.
3. **Días de crédito.** La ficha del cliente tiene `creditDays`. ¿El vencimiento se calcula con
   ese valor, o el cajero lo captura? El servidor usa 30 días por omisión, no el del cliente —
   hay que confirmar si eso es lo deseado.
4. **Vender a crédito, ¿qué permiso?** Hoy basta con poder crear ventas. Fiar es una decisión
   de riesgo, no una de mostrador. ¿Merece permiso propio?
5. **Métodos habilitados por negocio.** La categoría "Pagos" de Configuración está pendiente.
   ¿El móvil ofrece siempre los cuatro métodos, o solo los que el negocio habilitó? Si es lo
   segundo, hace falta exponerlo desde el servidor.
6. **Visibilidad del tipo de cambio.** ¿Se muestra siempre, o solo al capturar un pago en
   dólares?

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
