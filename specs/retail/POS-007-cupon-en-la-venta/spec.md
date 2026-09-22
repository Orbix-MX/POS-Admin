---
id: POS-007
name: Cupón en la venta
status: draft
version: 1.0
vertical: retail
module: orders
priority: low
branch: feat/POS-007-cupon-en-la-venta
parent: Domain/Ventas y Punto de Venta (Orbix)
depends_on: [POS-003]
migration: none
reversible: true
---

# Cupón en la venta

## 1. Objetivo

Que un cliente pueda presentar un código de promoción y el mostrador lo acepte. El negocio ya
puede crear cupones desde el back-office y el servidor ya los valida y los aplica al cobrar;
el móvil no tiene dónde escribir el código, así que los cupones que el negocio emite no se
pueden canjear en el mostrador.

## 0. Alternativas descartadas

**Enviar el código al cobrar y esperar el resultado.** Es lo mínimo y es lo equivocado: el
cajero descubre que el cupón no sirve cuando ya le dijo al cliente el total, con el cliente
delante y la fila detrás. El código se valida al capturarlo; el cobro solo lo confirma.

**Traducir el cupón a un descuento manual en el cliente.** Calcularía el efecto en el móvil y
lo mandaría como descuento por línea. Rompe dos cosas: el uso del cupón no se contaría, y el
descuento quedaría atribuido a un descuento manual del cajero —que exige otro permiso y se
audita de otra forma. El cupón lo aplica el servidor.

## 2. Alcance

### Dentro
- Capturar un código de cupón en la venta en curso.
- Validarlo antes de cobrar y mostrar su efecto en el total.
- Rechazar el inválido diciendo por qué.
- Quitar el cupón aplicado.

### Fuera
- Crear, editar y listar cupones. Ya existe en el back-office.
- Promociones automáticas sin código.
- Cupones por cliente o por producto más allá de lo que el servidor ya valida.
- Coexistencia de cupón y descuento manual — ver §11.

## 3. Actores

- **Cajero** — captura el código que el cliente presenta.
- **Cliente del negocio** — presenta el cupón.
- **Dueño** — emite los cupones y quiere saber cuántos se canjearon.

## 4. Requisitos funcionales

### FR-001
El punto de venta MUST permitir capturar un código de cupón en la venta en curso.

### FR-002
El sistema MUST validar el código en el momento de capturarlo, antes del cobro.

### FR-003
Validado el cupón, el sistema MUST mostrar su efecto sobre el total antes de confirmar el
cobro.

### FR-004
Ante un código inválido, el sistema MUST decir por qué —inexistente, vencido, agotado, no
aplicable a esta venta— y no aplicarlo.

### FR-005
El punto de venta MUST permitir quitar el cupón aplicado y volver al total sin él.

### FR-006
El cupón aplicado MUST quedar visible en el ticket y en el detalle de la venta.

## 5. Reglas de negocio

### BR-001
El cupón se aplica a la venta completa, no a un renglón. **Regla existente**, documentada en
el vault; se cita, no se reescribe.

### BR-002
La validación al capturar es una consulta, no una reserva: no aparta el cupón ni consume su
uso. El uso se cuenta cuando la venta se registra. Entre una cosa y otra, un cupón de un solo
uso puede agotarse en otra terminal, y el cobro fallará. Es correcto: reservar un cupón que
quizá no se cobre lo dejaría inservible.

### BR-003
El descuento del cupón lo calcula y lo aplica el servidor. El efecto que el móvil muestra al
validar es una previsión; el importe que vale es el de la venta registrada.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001, FR-002, FR-003
Dado un carrito con artículos y un cupón vigente
Cuando el cajero captura el código
Entonces el cupón se marca como aplicado y el total mostrado refleja su descuento.

### AC-002 · Covers: FR-004
Dado un código que no existe, o que está vencido, o cuyo uso está agotado
Cuando el cajero lo captura
Entonces se le indica el motivo concreto y el total no cambia.

### AC-003 · Covers: FR-005
Dado un cupón aplicado
Cuando el cajero lo quita
Entonces el total vuelve al importe sin cupón, y la venta se registra sin él.

### AC-004 · Covers: FR-006, BR-003
Dado un cupón aplicado
Cuando la venta se cobra
Entonces la venta registrada trae el código y el descuento que el servidor calculó, y el
ticket lo muestra.

### AC-005 · Covers: BR-002
Dado un cupón de un solo uso validado en dos terminales a la vez
Cuando ambas cobran
Entonces una venta se registra con el cupón y la otra se rechaza indicando que ya se agotó.

### AC-006 · Covers: BR-001
Dado un cupón de otro tenant
Cuando el cajero lo captura
Entonces se rechaza como inexistente, sin revelar que existe en otra empresa.

## 7. Contrato

Sin endpoints nuevos.

```
POST /api/coupons/validate     // coupons:view
POST /api/orders
{
  "couponCode": "<código>"
}
```

- La validación previa usa el endpoint de validación que el back-office ya consume.
- `couponCode` en la venta ya está declarado en el contrato y en el cliente móvil; el servidor
  vuelve a validarlo al registrar y cuenta el uso.

`tenantId` no viaja: se resuelve desde `TenantContextService` (C-001).

Nota de permisos: validar exige `coupons:view`. Un cajero que no lo tenga no podrá capturar
cupones — ver §11.

## 8. Persistencia

Entidades afectadas: ninguna. `Order.couponId` y `Order.couponCode` ya existen y ya se
escriben.

Restricciones en base: ninguna nueva. Migración: **none**.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/coupon.spec.ts` | AC-001, AC-002, AC-003 |
| `api/src/modules/retail/orders/orders.coupon.spec.ts` | AC-004, AC-005, AC-006 |

### Cambian de significado
Ninguno previsto.

### Se conservan como red de seguridad
- Las suites de integridad de precio de `orders`: el cupón no debe abrir una vía para cobrar
  menos de lo que la venta dice.
- La validación de cupones del servidor, que no cambia.

## 10. Riesgos

- **Previsión que no coincide con el cobro.** Si el móvil calcula el efecto del cupón por su
  cuenta en lugar de usar lo que devuelve la validación, mostrará un total y cobrará otro.
- **Doble descuento.** Cupón y descuento manual sobre la misma venta pueden acumularse sin que
  nadie lo decida. Hoy no hay regla escrita — es la pregunta abierta principal.
- **Permiso ausente en el perfil del cajero.** Si el rol de punto de venta no incluye
  `coupons:view`, la funcionalidad existe y nadie puede usarla. Hay que verificarlo contra los
  roles reales antes de descomponer.
- **Reglas de acumulación sin documentar.** El vault marca explícitamente como *requiere
  validación* el detalle de acumulación y exclusión entre cupones. Construir la interfaz sobre
  una regla no verificada es construir sobre una suposición.
- La tarea toca el dominio del dinero: vía `completo`.

## 11. Preguntas abiertas

1. **Cupón y descuento manual a la vez.** ¿Se acumulan, se excluyen, o el cupón se aplica
   sobre el importe ya descontado? No hay regla escrita y el servidor no la impone. Es la
   pregunta que hay que cerrar antes de descomponer.
2. **Más de un cupón por venta.** El contrato admite un solo código. ¿Es una limitación
   deliberada o un pendiente?
3. **Permiso para canjear.** Validar exige `coupons:view`, que es un permiso de gestión.
   ¿Debería el canje en mostrador tener el suyo, o se añade `coupons:view` al rol de punto de
   venta?
4. **Cupones en el plan gratuito.** ¿La funcionalidad está acotada por plan? Si lo está, la
   interfaz debe decirlo en lugar de fallar.
5. **Prioridad real.** Es el último del bloque por una razón: sin cupones emitidos desde el
   back-office, no hay nada que canjear. ¿Hay negocios usándolos hoy, o esto se adelanta a la
   demanda?

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
