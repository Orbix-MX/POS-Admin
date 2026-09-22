---
id: POS-004
name: Presentaciones vendibles en el punto de venta
status: draft
version: 1.0
vertical: retail
module: orders
priority: high
branch: feat/POS-004-presentaciones-vendibles-en-el-punto-de-venta
parent: ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)
depends_on: []
migration: none
reversible: true
---

# Presentaciones vendibles en el punto de venta

## 1. Objetivo

Que se pueda vender la presentación correcta sin escanearla. La unidad vendible es la
presentación, no el producto (`ADR-0030`), y el punto de venta ya lo respeta **cuando el
código de barras llega desde el escáner**. Tocando una tarjeta del catálogo, no: se vende la
presentación por defecto, al precio de esa, y la existencia que baja es la de esa.

El resultado es un producto de dos comportamientos según cómo se agregó al carrito. Para el
refresco de 2 L, escanear cobra bien y tocar cobra el precio del de 600 ml.

## 0. Alternativas descartadas

**Mostrar cada presentación como su propia tarjeta en la retícula.** Parece lo más directo y
evita una pantalla intermedia, pero rompe el catálogo: un negocio con cincuenta productos de
cuatro tallas pasa a doscientas tarjetas, la búsqueda por nombre devuelve cuatro resultados
idénticos, y el filtro por categoría deja de acotar nada. El catálogo es del producto; la
presentación se elige al agregar.

## 2. Alcance

### Dentro
- Elección de presentación al agregar al carrito un producto que tiene más de una.
- Precio y existencia por presentación, visibles en el momento de elegir.
- Identidad del renglón del carrito por presentación, no por producto.
- La presentación vendida, visible en el carrito y en el ticket.

### Fuera
- Alta y edición de presentaciones. Ya existen en el móvil, en el formulario de producto.
- Matriz de opciones (talla × color). Queda fuera por `ADR-0030`.
- Recetas y combos por presentación. Fuera por `ADR-0030`.
- Cambiar de presentación un renglón ya agregado. Se quita y se vuelve a agregar.

## 3. Actores

- **Cajero** — agrega artículos al carrito desde la retícula.
- **Dueño** — necesita que la existencia por presentación cuadre con lo cobrado.

## 4. Requisitos funcionales

### FR-001
Al agregar al carrito un producto con más de una presentación, el sistema MUST pedir cuál se
está vendiendo.

### FR-002
Al elegir, el sistema MUST mostrar por cada presentación su nombre, su precio y su existencia
disponible.

### FR-003
El sistema MUST impedir elegir una presentación sin existencia cuando el producto lleva
control de inventario.

### FR-004
Al agregar al carrito un producto con una sola presentación, el sistema MUST NOT preguntar
nada: el comportamiento es el de hoy.

### FR-005
Cada presentación MUST ocupar su propio renglón del carrito, con su precio y su existencia;
dos presentaciones del mismo producto no se suman en un renglón.

### FR-006
El renglón del carrito y el ticket MUST identificar qué presentación se vendió.

### FR-007
La venta registrada MUST descontar la existencia de la presentación vendida.

## 5. Reglas de negocio

### BR-001
La unidad vendible y de existencia es la presentación. Todo producto tiene al menos una, la
que representa "el producto en sí". **Regla existente**: la define `ADR-0030` y la garantiza
la base con un índice único parcial. Se cita, no se reescribe.

### BR-002
Una presentación ajena al producto que se está vendiendo se rechaza. Ya lo valida el
servidor; la interfaz no debe abrir ninguna vía para intentarlo.

### BR-003
La existencia que el cliente muestra es una fotografía, no la verdad. El servidor vuelve a
validarla al cobrar, y su respuesta manda: entre que el catálogo se cargó y el cobro se
confirmó, otra terminal pudo vender la última pieza.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001, FR-002
Dado un producto con tres presentaciones
Cuando el cajero lo toca en la retícula
Entonces se le pide elegir una, y ve el nombre, el precio y la existencia de cada una.

### AC-002 · Covers: FR-004
Dado un producto con una sola presentación
Cuando el cajero lo toca en la retícula
Entonces se agrega al carrito directamente, sin pantalla intermedia.

### AC-003 · Covers: FR-005, FR-006
Dado un producto con dos presentaciones de precio distinto
Cuando el cajero agrega una de cada
Entonces el carrito muestra dos renglones, cada uno con su nombre de presentación y su propio
precio, y ninguno suma la cantidad del otro.

### AC-004 · Covers: FR-003
Dada una presentación sin existencia de un producto con control de inventario
Cuando el cajero abre la elección
Entonces esa presentación no se puede elegir y se indica por qué.

### AC-005 · Covers: FR-007
Dado un carrito con la presentación grande de un producto
Cuando se cobra
Entonces la existencia que baja es la de la presentación grande, y la de las demás no se
mueve.

### AC-006 · Covers: FR-001
Dado un producto escaneado por su código de barras
Cuando se agrega al carrito
Entonces no se pide elegir presentación: el código ya la identifica.

### AC-007 · Covers: BR-002
Dada una presentación que pertenece a otro producto, o a un producto de otro tenant
Cuando se envía una venta con ella
Entonces la venta se rechaza.

## 7. Contrato

Sin endpoints nuevos y sin cambios de contrato. El campo ya existe y el punto de venta ya lo
envía cuando viene del escáner:

```
POST /api/orders
{
  "items": [
    { "productId": "<uuid>", "variantId": "<uuid>", "quantity": 1, "price": 0 }
  ]
}
```

Omitir `variantId` significa "la presentación por defecto", que es exactamente el
comportamiento de hoy al tocar una tarjeta. Este spec hace que deje de omitirse cuando hay
elección real.

El catálogo ya devuelve las presentaciones con su precio, su código y su existencia; hay que
confirmar que la respuesta de la lista las trae y no solo la del detalle — ver §11.

## 8. Persistencia

Entidades afectadas: ninguna. `OrderItem.variantId` ya existe y ya se escribe.

Restricciones en base: ninguna nueva. Migración: **none**.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/variant-selection.spec.ts` | AC-001, AC-002, AC-004, AC-006 |
| `apps/mobile/orbix-mobile/src/features/pos/pos-totals.spec.ts` (casos nuevos) | AC-003 |

La identidad del renglón por presentación ya está resuelta en el módulo de carrito y tiene
pruebas; lo que falta es que la retícula la use. Los casos nuevos cubren que dos
presentaciones no colapsen en un renglón.

### Cambian de significado
| Archivo | Por qué |
|---|---|
| Los casos de la retícula que asumen "tocar = agregar" | Pasa a ser "tocar = agregar, salvo que haya que elegir". El camino de una sola presentación se conserva (FR-004) |

### Se conservan como red de seguridad
- Las pruebas del escáner: AC-006 dice explícitamente que su camino no cambia.
- Las suites de existencia por presentación en el servidor.

## 10. Riesgos

- **Un toque de más en el caso común.** Si la elección aparece donde no hace falta, el
  mostrador se vuelve más lento en el 90% de las ventas. FR-004 es tan importante como FR-001.
- **Existencia desactualizada en la elección.** Mostrar "3 disponibles" de algo que ya se
  agotó invita a un rechazo al cobrar. BR-003 lo asume; lo que no se puede es presentar la
  cifra como garantía.
- **Precio de la presentación.** Si el catálogo de la retícula solo trae el precio del
  producto, elegir una presentación mostraría el precio equivocado hasta cobrar. Es el defecto
  que este spec viene a cerrar; hay que verificar de dónde sale el precio por presentación en
  la respuesta de la lista.
- La tarea toca el dominio del dinero y de las existencias: es vía `completo`
  (`force_completo`, dominios), aunque el cambio viva casi todo en el cliente.

## 11. Preguntas abiertas

1. **La lista de productos, ¿trae las presentaciones?** Si `GET /products` solo devuelve el
   producto y su precio base, hace falta una consulta extra al elegir —o ampliar la respuesta,
   que encarece una lista ya pesada. Hay que verificarlo antes de descomponer: cambia el
   tamaño de la tarea y puede añadir trabajo de servidor.
2. **Existencia por sucursal en la elección.** La existencia es por sucursal y presentación.
   ¿La respuesta del catálogo ya viene acotada a la sucursal activa, o hay que pedirlo?
3. **Producto sin control de inventario.** No tiene existencia que mostrar. ¿Se muestra la
   presentación sin cifra, o con una marca de "sin control"?
4. **Cuántas presentaciones caben antes de necesitar búsqueda.** Un producto con veinte
   presentaciones no se elige en una lista corta. ¿Hay un caso real así, o se asume que son
   pocas?

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
