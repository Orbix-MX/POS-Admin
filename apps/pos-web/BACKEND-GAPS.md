# Orbix POS — diferencias entre el diseño y el backend actual

El diseño de referencia (`Orbix POS.dc.html`) plantea funcionalidad que el backend
de Orbix hoy no expone. **Ninguna se ha simulado ni resuelto inventando endpoints**:
aquí queda registrada la limitación, el método existente más cercano y qué se
implementó en su lugar.

Regla que se siguió en todos los casos: antes de dejar algo pendiente se buscó un
endpoint existente que lo resolviera; solo cuando no había ninguno se documentó.

---

## 1. Selección de caja

**Funcionalidad del diseño**
Pantalla «Selecciona dónde vas a operar» con dos rejillas: sucursales y cajas
(«Caja 1», «Caja 2»…), cada caja con su estado propio («Abierta por otro usuario»).

**Método existente**
`GET /cash-sessions/active?branchId=…` (`fetchActiveCashSession`),
`POST /cash-sessions` (`openCashSession`).

**Problema**
No existe entidad de caja/terminal en el modelo de datos. La caja **es** la sesión
de efectivo, y hay como máximo una activa por sucursal. No hay forma de listar
«las cajas de la sucursal» ni de identificar un punto de venta concreto.

**Impacto en frontend**
`SelectContextScreen` mantiene el layout del diseño, pero el segundo bloque no
ofrece cajas a elegir: muestra el estado real de la caja de la sucursal
seleccionada (Sin abrir / Abierta / En arqueo), con su fondo inicial y quién la
abrió. El identificador de caja de la barra superior se sustituye por el estado de
la sesión.

**Qué haría falta**
Entidad `CashRegister` (o equivalente) ligada a `Branch`, y que `CashSession`
apunte a ella.

---

## 2. Autorización de descuento por PIN

**Funcionalidad del diseño**
Diálogo «Autorización requerida»: un descuento sobre la venta pide el PIN de un
encargado y la venta se conserva mientras tanto.

**Método existente**
`POST /cash-sessions/verify-auth` (`verifyCloseAuth`) verifica credenciales
(correo + contraseña), pero es específico del cierre de caja descuadrado. No hay
permiso de descuento en `ALL_PERMISSIONS` (`api/src/modules/core/permissions/permissions.constants.ts`)
ni ningún endpoint de autorización de PIN.

**Problema**
Desviar `verify-auth` a autorizar descuentos sería usar un endpoint fuera de su
propósito, y además no hay dónde registrar que el descuento quedó autorizado.
Simular la verificación en el frontend sería un control de seguridad falso.

**Impacto en frontend**
`DiscountDialog` aplica el descuento directamente. El backend ya lo acepta y lo
registra en `order.discount`, así que la venta queda correcta y auditable; lo que
no existe es el paso de aprobación.

**Qué haría falta**
Permiso `pos.sales:discount`, y un endpoint de verificación de PIN que devuelva un
token de autorización asociable a la orden.

---

## 3. Descuento a nivel de venta

**Funcionalidad del diseño**
Un importe de descuento aplicado a la venta completa.

**Método existente**
`POST /orders` acepta `items[].discount` (descuento por renglón) y `couponCode`.
No hay campo de descuento a nivel de orden.

**Problema**
Enviar el descuento en un solo renglón distorsionaría el impuesto de esa línea,
porque el backend calcula `lineTax` sobre `price × qty − discount`.

**Impacto en frontend**
`distributeOrderDiscount` (`src/services/order-totals.ts`) reparte el importe entre
las líneas de forma proporcional a su valor, con el redondeo cuadrado en la última
línea. **El servidor sigue siendo quien lo aplica**: el frontend solo decide cómo
se distribuye, sobre un campo que el contrato ya soporta.

**Qué haría falta**
`orderDiscount` a nivel de `CreateOrderDto`, aplicado antes del cálculo de
impuestos.

---

## 4. Variantes de producto en la venta

**Funcionalidad del diseño**
Las tarjetas de producto abren un selector de variante (talla, calibre, medida) y
cada variante tiene su propio precio.

**Método existente**
`Product.variants` (`ProductVariant`: `id`, `name`, `price`, `stock` por sucursal)
existe en el catálogo. Pero `CreateOrderItemDto` **no tiene `variantId`**, y
`orders.service.ts` no menciona variantes en ninguna parte.

**Problema**
Vender una variante enviando solo `productId` y el precio de la variante
descontaría inventario de la variante por defecto, no de la vendida. Sería un
error de existencias silencioso.

**Impacto en frontend**
No se implementó el selector de variantes. El catálogo trata cada producto como
una línea simple con su precio base — el mismo comportamiento que hoy tiene el POS
del Admin Web.

**Qué haría falta**
`variantId` en `CreateOrderItemDto` y descuento de inventario por variante en
`orders.service.ts`.

---

## 5. Ventas suspendidas

**Funcionalidad del diseño**
Contador «Suspendidas · 2» en la barra superior; suspender una venta y retomarla.

**Método existente**
Ninguno. Las órdenes `PENDING` y `LAYAWAY` son ventas **ya registradas** (con
folio y afectación de inventario), no ventas en espera.

**Impacto en frontend**
Las ventas suspendidas viven en `localStorage` de la terminal, igual que en el POS
del Admin Web (`pos_hold_sales`). Consecuencia operativa: una venta suspendida
solo puede retomarse en el mismo equipo y navegador.

**Qué haría falta**
Recurso de borrador de venta en el servidor, sin folio ni afectación de inventario.

---

## 6. Envío del ticket por WhatsApp

**Funcionalidad del diseño**
Botón «Enviar por WhatsApp» en la pantalla de comprobante.

**Método existente**
`print-service` cubre impresión (red vía servidor, o QZ Tray en el equipo). Existe
un módulo de pedidos por WhatsApp en el Admin Web, pero no expone envío de
comprobante de una orden.

**Impacto en frontend**
El botón está presente por fidelidad al diseño, pero deshabilitado y con el motivo
en su `title`.

**Qué haría falta**
Endpoint de envío de comprobante (`POST /orders/:id/send-receipt`) con canal
WhatsApp.

---

## 7. Desglose de IVA antes de cobrar

**Funcionalidad del diseño**
El panel de venta muestra Subtotal / Descuento / IVA / Total mientras se arma el
carrito.

**Método existente**
`POST /orders` calcula y devuelve `subtotal`, `discount`, `tax` y `total`. No hay
endpoint de «cotizar totales» sin crear la venta.

**Impacto en frontend**
`previewTotals` (`src/services/order-totals.ts`) replica la aritmética del backend
(`orders.service.ts` + `common/utils/money.util.ts`) **solo para la vista previa**.
La pantalla de ticket muestra exclusivamente los importes que devolvió el servidor.

Riesgo asumido y acotado: si la fórmula del backend cambia, la vista previa puede
desviarse hasta que se sincronice. El importe cobrado nunca se ve afectado, porque
el servidor recalcula todo.

**Qué haría falta**
`POST /orders/preview` que devuelva los totales sin persistir.

---

## 8. Operación sin conexión

**Funcionalidad del diseño**
Indicador de estado en línea / fuera de línea en la barra superior.

**Método existente**
Ninguno. El backend no soporta cola de sincronización ni ventas diferidas.

**Impacto en frontend**
`NetworkStatusProvider` informa del estado de la red y bloquea el botón de cobro
cuando no hay conexión, para que el cajero entienda por qué falla. **No hay cola
propia de sincronización**: inventarla produciría ventas divergentes y folios
duplicados. El tipo `SyncStatus` deja el hueco modelado para cuando exista soporte
real en el servidor.
