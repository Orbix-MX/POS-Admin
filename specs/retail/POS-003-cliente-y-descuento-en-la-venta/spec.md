---
id: POS-003
name: Cliente y descuento en la venta
status: draft
version: 1.0
vertical: retail
module: orders
priority: high
branch: feat/POS-003-cliente-y-descuento-en-la-venta
parent: Domain/Ventas y Punto de Venta (Orbix)
depends_on: []
migration: none
reversible: true
---

# Cliente y descuento en la venta

## 1. Objetivo

Que una venta pueda decir **a quién** se le vendió y **cuánto se le rebajó**. Hoy toda venta
del móvil es anónima y al precio de lista: no hay forma de identificar al comprador ni de
bajar el precio, aunque el negocio lo haga a diario y el servidor lo acepte desde hace tiempo.

Sin cliente en la venta no hay historial de compras, no hay cuenta por cobrar y no hay venta a
crédito. Es el requisito que desbloquea el bloque de clientes y cobranza.

## 2. Alcance

### Dentro
- Asignar un cliente existente a la venta en curso, y quitarlo.
- Crear un cliente sin salir del cobro, cuando no está dado de alta.
- Aplicar un descuento a la venta, con el control de permiso que ya rige.
- Ver el efecto del descuento en el total antes de confirmar el cobro.
- Dejar ambos reflejados en el ticket y en el detalle de la venta.

### Fuera
- Cupones. Son otro mecanismo, con su propia validación en el servidor.
- Venta a crédito. Exige cliente, pero es cobro, no captura.
- Saldo, historial y cuentas por cobrar del cliente.
- Precios por tipo de cliente o listas de precio.
- Descuento como regla automática (promociones, 2x1).

## 3. Actores

- **Cajero** — captura la venta; puede o no tener permiso para descontar.
- **Supervisor** — tiene el permiso de descuento.
- **Cliente del negocio** — queda identificado en la venta.

## 4. Requisitos funcionales

### FR-001
El punto de venta MUST permitir asignar a la venta en curso un cliente ya registrado,
buscándolo.

### FR-002
El punto de venta MUST permitir quitar el cliente asignado y volver a venta general.

### FR-003
La venta sin cliente MUST seguir siendo posible y MUST seguir siendo el comportamiento por
defecto: nada obliga a identificar al comprador de mostrador.

### FR-004
El punto de venta MUST permitir dar de alta un cliente durante el cobro, sin perder el
carrito, y asignarlo a la venta.

### FR-005
El punto de venta MUST permitir aplicar un descuento a la venta en curso.

### FR-006
Sin el permiso de descuento manual, el sistema MUST no ofrecer la acción de descontar, y MUST
rechazar la venta con descuento si llegara a enviarse.

### FR-007
El total mostrado antes de confirmar MUST reflejar el descuento aplicado.

### FR-008
El cliente y el descuento MUST quedar visibles en el ticket y en el detalle de la venta ya
registrada.

## 5. Reglas de negocio

### BR-001
El descuento manual exige el permiso `orders:discount-override`, y cada venta con descuento
queda en la bitácora de auditoría. **Regla existente**, ya implementada en el servidor; se
cita, no se reescribe. Lo que este spec origina es que la interfaz la refleje en lugar de
contradecirla (C-017).

### BR-002
El descuento se captura **sobre la venta**, no renglón por renglón, y se reparte entre las
líneas proporcionalmente a su importe; el ajuste de redondeo cae en la última línea para que
la suma cuadre exactamente con lo pedido.

No es una regla nueva: es la composición que la terminal web ya hace sobre el mismo contrato,
que solo acepta descuento por renglón. Replicarla mantiene una sola forma de descontar en
todo el producto. El servidor sigue siendo quien lo aplica y quien lo suma al total.

### BR-003
El descuento nunca deja una línea en negativo ni supera el importe de la venta.

Expresable como invariante de cálculo, no como restricción de base: el reparto ocurre en el
cliente y el servidor valida cada línea por separado (C-016). Se cubre con test de invariante.

### BR-004
Un cliente de otro tenant no existe para esta venta. El aislamiento lo garantiza el servidor;
la interfaz no debe ofrecer ninguna vía para intentarlo.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001, FR-008
Dado un carrito con artículos y un cliente registrado
Cuando el cajero lo asigna a la venta y cobra
Entonces la venta queda registrada a nombre de ese cliente y el detalle del ticket lo muestra.

### AC-002 · Covers: FR-002, FR-003
Dado un carrito con un cliente asignado
Cuando el cajero lo quita y cobra
Entonces la venta se registra como venta general, sin cliente.

### AC-003 · Covers: FR-004
Dado un carrito con artículos y un comprador que no está registrado
Cuando el cajero lo da de alta desde el cobro
Entonces el cliente queda creado, asignado a la venta, y el carrito conserva sus líneas y
cantidades.

### AC-004 · Covers: FR-005, FR-007, BR-002
Dado un carrito de tres líneas de importes distintos y un usuario con permiso de descuento
Cuando aplica un descuento sobre la venta
Entonces el total mostrado baja en ese importe, y la venta registrada reparte el descuento
entre las tres líneas de forma proporcional, sumando exactamente lo aplicado.

### AC-005 · Covers: FR-006, BR-001
Dado un cajero sin el permiso de descuento manual
Cuando abre el cobro
Entonces no ve ninguna acción para descontar.

### AC-006 · Covers: FR-006, BR-001
Dado un cajero sin el permiso de descuento manual
Cuando se envía una venta con descuento en su nombre
Entonces el servidor la rechaza.

### AC-007 · Covers: BR-003
Dado un carrito cuyo importe total es menor que el descuento capturado
Cuando se calcula el reparto
Entonces el descuento se acota al importe de la venta y ninguna línea queda con descuento
mayor que su propio importe.

### AC-008 · Covers: BR-004
Dado un cliente registrado en el tenant A
Cuando un usuario del tenant B intenta registrar una venta a su nombre
Entonces la venta se rechaza y el cliente no aparece en ninguna búsqueda de B.

## 7. Contrato

Sin endpoints nuevos y sin cambios de contrato. Todo lo que hace falta ya existe y ya está
declarado en el cliente móvil:

```
POST /api/orders
{
  "customerId": "<uuid>",          // ya declarado, hoy nunca se envía
  "items": [
    { "productId": "...", "quantity": 1, "price": 0, "discount": 0 }
  ]
}
```

- `customerId` — opcional; omitirlo es la venta general.
- `items[].discount` — importe descontado de esa línea. Exige `orders:discount-override`.

Se consumen además `GET /api/customers` (búsqueda) y `POST /api/customers` (alta), ambos ya
en uso por la pantalla de clientes del móvil.

`tenantId` no viaja: se resuelve desde `TenantContextService` (C-001).

## 8. Persistencia

Entidades afectadas: ninguna en su forma. `Order.customerId` y `OrderItem.discount` ya
existen y ya se escriben desde otros clientes.

Restricciones en base: ninguna nueva. Migración: **none**.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/order-discount.spec.ts` | AC-004, AC-007, BR-002, BR-003 |
| `apps/mobile/orbix-mobile/src/features/pos/to-create-request.spec.ts` | AC-001, AC-002 |
| `api/src/modules/retail/orders/orders.discount-permission.spec.ts` | AC-006 |

El reparto del descuento es aritmética de dinero en el cliente: va a módulo puro y se prueba
con casos de redondeo adversos, no con una pantalla montada. Es la misma decisión que ya tomó
la suite de importes de caja.

### Cambian de significado
| Archivo | Por qué |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/pos-totals.spec.ts` | Hoy el total es subtotal + impuesto. Pasa a restar el descuento, así que los casos de total cambian de valor esperado |

### Se conservan como red de seguridad
- Las suites de `orders` sobre integridad de precio y pago: el descuento no debe abrir una vía
  para cobrar menos de lo que la venta dice.
- Los casos existentes de venta sin cliente: FR-003 dice que no cambian.

## 10. Riesgos

- **Que el descuento se aplique dos veces.** El cliente lo reparte por línea y el servidor lo
  suma al total de la venta. Si la interfaz además lo resta de su propio total antes de
  enviar, el importe cobrado y el mostrado divergen. El total que vale es el que devuelve el
  servidor.
- **Descuento sin permiso escondido en la interfaz.** Ocultar el botón no es control. El
  rechazo del servidor es el control; ocultar el botón es cortesía. AC-006 prueba el control y
  AC-005 la cortesía, en ese orden de importancia.
- **Alta de cliente a mitad del cobro.** Es el punto donde más fácil se pierde el carrito. El
  criterio de AC-003 sobre conservar líneas y cantidades no es decorativo.
- **Permiso cacheado.** Los permisos efectivos se cachean 60 s por usuario y tenant (C-009):
  un test que conceda el permiso y cobre inmediatamente después es un test mal escrito, no un
  defecto.
- La tarea toca el dominio del dinero: es vía `completo` aunque el cambio parezca de interfaz
  (`force_completo`, dominios).

## 11. Preguntas abiertas

1. **Descuento sobre la venta o por renglón.** El documento de faltantes pide "descuento por
   línea"; el contrato del servidor es por línea; la terminal web captura sobre la venta y
   reparte. BR-002 propone seguir a la terminal web, por coherencia de producto y porque en un
   mostrador se negocia el total, no el renglón. **Hay que confirmarlo**: si la respuesta es
   "por renglón", cambian FR-005, BR-002, AC-004 y AC-007.
2. **Importe o porcentaje.** ¿El cajero captura pesos, porcentaje, o ambos? La terminal web
   captura pesos.
3. **Tope del descuento.** ¿Existe un máximo por venta o por usuario? Hoy no hay ninguno: con
   el permiso se puede descontar el 100%. Si debe haberlo, es una regla de negocio nueva y un
   cambio de servidor, no de interfaz.
4. **Motivo del descuento.** ¿Se pide? Queda en auditoría quién descontó, no por qué.
5. **Autorización por PIN.** El corte y el arqueo ya permiten que un supervisor autorice con
   su PIN sin cerrar la sesión del cajero. ¿El descuento debería poder autorizarse igual, o
   basta con el permiso del usuario conectado?

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
