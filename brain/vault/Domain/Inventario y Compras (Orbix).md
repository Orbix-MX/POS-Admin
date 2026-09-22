---
title: Inventario y Compras (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-21
tags: [negocio, orbix-erp, inventario, compras]
---

# Inventario y Compras (Orbix)

## ¿Qué es?

El ciclo de abastecimiento: comprar a proveedores, recibir mercancía, mantener el stock de
productos e insumos, y transformarlo en recetas/combos cuando aplica.

## Objetivo

Que el stock disponible en cada sucursal sea confiable para vender, y que cada compra quede
ligada a una cuenta por pagar.

## Flujo

```
PurchaseOrder (a un Supplier) → PurchaseOrderItem
  → PurchaseReceipt (recepción física, puede ser parcial) → PurchaseReceiptItem
  → InventoryMovement (entra a BranchInventory) → AccountPayable (deuda con el proveedor)
  → consumo por venta (retail) o por receta (restaurante) → nuevo InventoryMovement (salida)
```

## Reglas de negocio encontradas

- Un `Product` puede ser `STANDARD`, `RECIPE` (compuesto de `RecipeItem` → `Supply`),
  `COMBO` (compuesto de `ComboItem` → otros `Product`) o `SUPPLY` (insumo directo).
- Los insumos (`Supply`) tienen conversión de unidades explícita vía
  `SupplyAllowedUnit` — una compra en una unidad puede consumirse en otra.
- El motor de inventario (`inventory.engine.ts`) tiene 5 funcionalidades marcadas
  pendientes ("Phase 2"): producción, transferencias entre sucursales, mermas, carga de
  inventario inicial y conteos físicos — hoy el módulo cubre el flujo básico de
  entrada/salida, no estas variantes.
- Cada `PurchaseOrder` recibida genera una `AccountPayable` — ver
  [[Cuentas por Cobrar y Pagar (Orbix)]].
- **El stock vive por sucursal y por variante**: `BranchInventory` está llaveado por
  `(branchId, variantId)`, no por producto (fase *expand* de
  [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]], 2026-08-18).
  Todo producto tiene una variante `isDefault` sin nombre que carga el stock de los
  artículos que nunca se dividieron en presentaciones, así que un abarrote se administra
  igual que antes. Los llamadores (POS, comanda, caja, compras, tienda) siguen hablando de
  productos: `VariantInventoryResolver` es el único punto que traduce a la llave nueva —
  variante `isDefault` si no se especifica otra, sucursal `isMain` si el contexto no trae
  `branchId`.
- `Product.stock` **sigue existiendo y escribiéndose**: es el fallback de la fase expand
  para tenants sin ninguna sucursal, y se retira en la fase contract. Mientras tanto hay dos
  contadores y el autoritativo es `BranchInventory`.


## Conceptos importantes

| Concepto | Significado |
|---|---|
| Product (STANDARD/RECIPE/COMBO/SUPPLY) | Tipo de artículo vendible o consumible |
| Supply | Insumo con conversión de unidades |
| PurchaseOrder / PurchaseReceipt | Compromiso de compra y su recepción física |
| InventoryMovement | Registro de entrada/salida de stock por sucursal |
| BranchInventory | Stock, costo y precio efectivos de una variante en una sucursal — PK `(branchId, variantId)` |
| ProductVariant | Unidad vendible y de stock; la `isDefault` (sin nombre) es "el producto en sí" |

## Sistemas que participan

- [[Orbix ERP API]] — módulos `retail/inventory`, `retail/purchases`, `retail/supplies`,
  `retail/suppliers`, `retail/products`.
- [[Orbix ERP Web]] — páginas `inventario`, `insumos`, `compras`, `proveedores`.

## Relaciones con otros procesos

- → [[Ventas y Punto de Venta (Orbix)]] — el stock vendido sale de aquí.
- → [[Cuentas por Cobrar y Pagar (Orbix)]] — cada compra recibida genera una CxP.
- → [[Restaurante (Orbix)]] — las recetas de cocina consumen insumos de este módulo.
- → [[Modelo de producto por vertical (Orbix)]] — cómo se compone e inventaría un producto
  (simple, receta, combo) y el modelo de variantes con stock propio
  ([[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]]).
