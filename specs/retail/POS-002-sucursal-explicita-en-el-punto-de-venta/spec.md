---
id: POS-002
name: Sucursal explícita en el punto de venta
status: draft
version: 1.0
vertical: retail
module: orders
priority: high
branch: feat/POS-002-sucursal-explicita-en-el-punto-de-venta
parent: Domain/Ventas y Punto de Venta (Orbix)
depends_on: []
migration: none
reversible: true
---

# Sucursal explícita en el punto de venta

## 1. Objetivo

Que el cajero sepa —y decida— en qué sucursal está vendiendo. Hoy la sucursal llega implícita
en la sesión: si viene, el punto de venta funciona; si no viene, la pantalla se queda cargando
para siempre, sin decir por qué y sin salida. Un negocio con más de una sucursal no puede
vender desde el móvil.

No es una funcionalidad del bloque de venta completa: es la condición para que ese bloque
tenga sentido en un negocio con dos tiendas. Sin esto, cada spec posterior se prueba solo en
el caso de una sucursal.

## 2. Alcance

### Dentro
- Elección de la sucursal activa del punto de venta, cuando hay más de una.
- Persistencia de esa elección entre arranques de la app.
- Estado explícito cuando no hay sucursal resuelta, en lugar de una carga indefinida.
- Efecto de cambiar de sucursal sobre una venta a medio capturar.

### Fuera
- Elegir sucursal en el resto de la app (productos, clientes, caja). La caja ya resuelve la
  suya por el vínculo del dispositivo; tocarlo aquí mezclaría dos modelos distintos.
- Traspasos entre sucursales.
- Permisos por sucursal. Quién puede vender en cuál es otra pregunta, y hoy no existe.

## 3. Actores

- **Cajero de un negocio con una sola sucursal** — no debe notar nada.
- **Cajero de un negocio con varias** — elige dónde está vendiendo.
- **Dueño** — necesita que las ventas queden atribuidas a la sucursal correcta.

## 4. Requisitos funcionales

### FR-001
Cuando el negocio tiene más de una sucursal, el punto de venta MUST permitir elegir en cuál
se está vendiendo.

### FR-002
El sistema MUST recordar la sucursal elegida en el dispositivo, y usarla en los arranques
siguientes sin volver a preguntar.

### FR-003
Cuando el negocio tiene una sola sucursal, el sistema MUST usarla sin mostrar ningún
selector.

### FR-004
Cuando no hay sucursal resuelta, el punto de venta MUST decirlo y ofrecer la acción que lo
resuelve. No debe quedarse en un estado de carga.

### FR-005
El catálogo, la existencia mostrada y la venta registrada MUST corresponder a la sucursal
activa.

### FR-006
Al cambiar de sucursal con una venta a medio capturar, el sistema MUST advertirlo y pedir
confirmación antes de descartarla.

## 5. Reglas de negocio

### BR-001
Un carrito pertenece a una sucursal. Los precios y la existencia de sus líneas se resolvieron
allí, así que arrastrarlo a otra sucursal cobraría un artículo que puede no existir ahí o
costar otra cosa. Cambiar de sucursal vacía el carrito; no se migra.

No es expresable en base: el carrito no existe en el servidor hasta que se cobra (C-016). Se
cubre con test de la regla en el cliente.

### BR-002
La sucursal es del dispositivo, no de la persona. Dos cajeros que se releven en el mismo
mostrador venden en la misma sucursal, y cambiar de usuario no la reinicia. Es el mismo
criterio que ya rige el vínculo de la caja física al dispositivo.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-003
Dado un negocio con una sola sucursal
Cuando el cajero abre el punto de venta
Entonces vende sin ver ningún selector de sucursal.

### AC-002 · Covers: FR-001, FR-002
Dado un negocio con dos sucursales y ninguna elegida
Cuando el cajero abre el punto de venta y elige una
Entonces vende en esa, y al volver a abrir la app sigue en la misma sin que se le pregunte.

### AC-003 · Covers: FR-004
Dado un usuario sin sucursal resuelta
Cuando abre el punto de venta
Entonces ve un mensaje que explica la situación y un acceso para elegir sucursal, no un
indicador de carga.

### AC-004 · Covers: FR-005
Dada la sucursal A activa
Cuando el cajero consulta el catálogo
Entonces las existencias mostradas son las de A, y la venta que registre queda atribuida a A.

### AC-005 · Covers: FR-006, BR-001
Dado un carrito con artículos
Cuando el cajero cambia de sucursal
Entonces se le advierte que la venta en curso se perderá, y solo al confirmar se cambia y se
vacía el carrito.

### AC-006 · Covers: BR-002
Dada una sucursal elegida en el dispositivo
Cuando otro usuario inicia sesión en el mismo dispositivo
Entonces la sucursal activa sigue siendo la misma.

### AC-007 · Covers: FR-001
Dado un usuario del tenant A
Cuando abre el selector de sucursales
Entonces solo ve las sucursales de A.

## 7. Contrato

Sin endpoints nuevos. Se consume `GET /api/branches`, que ya existe y ya está declarado en el
cliente móvil sin ningún consumidor.

Lo que cambia es de dónde sale la sucursal que el punto de venta usa: hoy sale de la sesión
de autenticación y solo de ahí; pasa a salir de la elección persistida del dispositivo, con
la de la sesión como valor inicial cuando la hay.

La venta ya viaja atribuida a la sucursal por el contexto de la petición; este spec no cambia
el cuerpo de `POST /api/orders`.

## 8. Persistencia

Entidades afectadas: ninguna en base.

La elección vive en el almacenamiento local del dispositivo, junto al vínculo de la caja
física, que ya sigue exactamente este patrón.

Restricciones en base: ninguna. Migración: **none**.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/active-branch.spec.ts` | AC-001, AC-002, AC-006 |
| `apps/mobile/orbix-mobile/src/features/pos/cart-branch-guard.spec.ts` | AC-005 |

AC-003 y AC-004 son de pantalla. Hoy no hay pruebas de componente en el móvil
(`@testing-library/react-native` no monta con la versión de React que fija Expo SDK 54), así
que se verifican con la app arrancada y quedan anotados en `verify.md`.

### Cambian de significado
| Archivo | Por qué |
|---|---|
| Cualquier test que asuma que la sucursal del punto de venta es la de la sesión | Pasa a ser solo el valor inicial, no la fuente |

### Se conservan como red de seguridad
- Las claves de caché ya llevan `branchId`; sus tests garantizan que cambiar de sucursal no
  sirve datos de la anterior. Son justamente la red de esta entrega.

## 10. Riesgos

- **Caché servida de la sucursal anterior.** El riesgo real de este cambio. Las claves de
  consulta ya incluyen la sucursal, así que debería estar cubierto; hay que confirmarlo con
  una comprobación explícita, no asumirlo.
- **Elección persistida que apunta a una sucursal borrada o desactivada.** Debe degradar a
  "elige sucursal", no a pantalla en blanco.
- **Interacción con el vínculo de la caja física.** La caja se ata al dispositivo y pertenece
  a una sucursal. Una sucursal activa distinta de la de la caja abierta es un estado
  incoherente que hay que decidir cómo se resuelve — ver §11.

## 11. Preguntas abiertas

1. **Caja y sucursal en desacuerdo.** Si el dispositivo tiene una caja abierta en la sucursal
   A y el cajero cambia la sucursal activa a B, ¿se bloquea el cambio mientras haya caja
   abierta, o se permite y la venta se rechaza al cobrar? Inclinación: bloquear, y explicar
   que primero se corta la caja.
2. **Dónde vive el selector.** ¿En Configuración, como el de caja física, o en la cabecera del
   punto de venta? El de caja está en Configuración por ser un ajuste de puesto; la sucursal
   podría cambiar más a menudo.
3. **Valor inicial.** Cuando la sesión trae sucursal y el dispositivo no tiene elección
   guardada, ¿se adopta la de la sesión en silencio, o se pregunta la primera vez?
4. ¿Hay hoy algún caso real de usuario sin sucursal en la sesión, o el estado indefinido es
   solo teórico? Cambia la prioridad de FR-004.

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
