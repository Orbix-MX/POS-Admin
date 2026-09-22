---
title: ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-21
tags: [adr, orbix-erp, catalogo, inventario]
---

# ADR-0030 — `ProductVariant` obligatoria como unidad vendible y de stock (Orbix ERP)

**Estado:** Aceptada — implementada en fase *expand* (2026-08-18), contract pendiente
**Ámbito:** Orbix ERP · `retail/products`, `retail/inventory`, `retail/purchases`, `sales` · **Fecha:** 2026-08-17

## Contexto

`ProductAttribute` (`{ productId, name, cost, price }`) permite cobrar distinto por talla,
pero no inventariarla: no tiene `sku` ni `barcode`, no tiene `stock`, `BranchInventory` tiene
PK `(branchId, productId)` y ni `OrderItem` ni `StoreWhatsappOrderItem` guardan qué variante
se vendió. Una camisa S/M/L/XL se publica con precio por talla, pero al vender una L el stock
baja de un contador único: no se sabe cuántas L quedan ni se compra por talla.

Análisis completo en [[Modelo de producto por vertical (Orbix)]].

## Decisión

Introducir `ProductVariant` como **unidad vendible y de stock**, y hacerla **obligatoria**:
todo producto tiene al menos una variante, la `isDefault`, aunque no sea configurable.

```
Product          identidad comercial (nombre, categoría, imágenes, tipo, SEO)
  └─ ProductVariant   sku · barcode · price · costPrice · isDefault · status · attributes
        └─ BranchInventory (branchId, variantId)
```

Reglas asociadas:

1. La variante es unidad **vendible**, no obligación de inventario: el stock cuelga de ella
   solo cuando `trackInventory`. `RECIPE` descuenta insumos y `COMBO` sus hojas, igual que
   hoy; su variante default es solo ancla de SKU y precio.
2. `BranchInventory(branchId, variantId)` pasa a ser la **única** verdad de stock; el total
   por producto se deriva. Se retira `Product.stock` como valor autoritativo.
3. **Invisible en UI** cuando `variants.length === 1 && isDefault`: el formulario muestra el
   producto plano, sin pestaña de variantes.
4. **La default se promueve, no se elimina.** Al configurar variantes por primera vez, la
   default existente se renombra (`UPDATE … SET name = 'M'`) conservando id, SKU, stock e
   historial. Repartir stock mezclado entre las nuevas variantes es un **ajuste de
   inventario** explícito, con su `InventoryMovement`.
5. Una variante con historial **nunca se borra**: se archiva (`status: ARCHIVED`).
6. `update` de producto abandona el patrón `deleteMany` + `createMany` y pasa a **diff real**
   (create / update por id / archive). Aplica también a `comboItems`.

Rechazada la alternativa `variantId` nullable (stock en el producto cuando no hay variantes).

## Consecuencias

**Positivas**
- Un solo camino de código: venta, compra, ajuste, corte, reportes y transferencias hablan
  siempre de variantes, sin `if (tieneVariantes)` replicado en cada consumidor.
- Preserva la simetría de `InventoryConsumptionEngine` (`consume`/`restore` sobre el mismo
  `resolveEffects`), que se duplicaría —y podría romperse en una sola rama— con la variante
  opcional.
- Resuelve de paso la doble verdad de stock actual (`Product.stock` autoritativo vs.
  `BranchInventory` clampado a 0 cuando queda corto).
- Stock, compra y reportes por talla/presentación; SKU y código de barras escaneables.

**Negativas**
- Migración no incremental: toca `BranchInventory`, `InventoryMovement`, `OrderItem`,
  `PurchaseOrderItem`, `PurchaseReceiptItem`, `ServiceQuoteItem` y el motor de consumo, en
  una sola entrega.
- Un JOIN adicional en las lecturas de catálogo y una fila por producto que la mayoría de
  tenants nunca configurará.
- El backfill (una default por producto existente, heredando `sku`/`price`/`costPrice`) debe
  ser exacto: un producto sin variante deja de ser vendible.
- El cambio de `deleteMany` a diff en `update` es obligatorio y silencioso si se omite —
  perdería el historial de ventas de cada variante.

## Notas

`ProductOption` / `ProductOptionValue` (matriz `Talla` × `Color` filtrable) queda **fuera**
de esta decisión: solo si la tienda necesita facetas. Mientras tanto, `name` plano más
`attributes Json`.

Receta por variante (hamburguesa sencilla vs. doble) también queda fuera: en v1 cada una es
su propio `Product` de tipo `RECIPE`, que es como ya operan los restaurantes y no cuesta
nada. Ver [[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)]] para el
precedente de no duplicar modelos por canal.

## Estado de implementación (2026-08-21)

Implementada en **fase expand**: el modelo nuevo ya es la verdad de stock, pero las columnas
viejas siguen en su sitio y escribiéndose, así que el cambio es revertible.

Entregado (migraciones `20260818120000_rename_product_attributes_to_variants`,
`20260818140000_add_variant_inventory`, `20260818150000_variant_inventory_primary_key`):

- `ProductAttribute` renombrado a **`ProductVariant`**, con `isDefault` y `trackInventory`.
  La default lleva `name = null` — es la línea implícita "el producto en sí". Un índice único
  **parcial** garantiza exactamente una default por producto a nivel de base.
- `BranchInventory` repasa su PK de `(branchId, productId)` a **`(branchId, variantId)`**, con
  `productId` denormalizado e indexado para las lecturas por producto. Sus columnas
  comerciales (`cost`, `price`, `comparePrice`, `lastCost`, `avgCost`) son **nullable a
  propósito**: un backfill faltante se ve, en vez de leerse como 0.
- **`VariantInventoryResolver`** (`retail/inventory/`) traduce las llaves viejas
  `(productId, branchId?)` a `(branchId, variantId)`, para que POS, comanda, caja, compras y
  tienda **no se reescriban**. Sin variante explícita usa la `isDefault`; sin sucursal
  explícita usa la `isMain` del tenant (hoy ~82% de las órdenes no trae `branchId`), y sin
  ninguna sucursal cae al comportamiento legacy sobre `Product.stock`.
  `ensureDefaultVariantId` crea la default al vuelo, para que un producto sembrado por una
  ruta antigua (importación, seeds) se auto-repare en vez de quedar sin inventario.

Pendiente para la fase *contract*:

- `OrderItem` y `StoreWhatsappOrderItem` **todavía no guardan `variantId`**: se sabe qué
  producto se vendió, no qué variante. Hasta cerrar esto, vender por talla no queda
  trazado en la orden.
- Retirar `Product.stock` y las columnas `cost`/`price` de `ProductVariant`, hoy legacy pero
  aún escritas.
- El diseño original preveía `sku`, `barcode`, `status: ARCHIVED` y `attributes Json` en la
  variante; **ninguno existe todavía** en el esquema. Sin ellos, la regla 5 (archivar en vez
  de borrar) no está soportada por el modelo.

## Relacionados

- [[Modelo de producto por vertical (Orbix)]] — análisis y evidencia
- [[Separacion de datos por vertical (Orbix)]] · [[Inventario y Compras (Orbix)]]
