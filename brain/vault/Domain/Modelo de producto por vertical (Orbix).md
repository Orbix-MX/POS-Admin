---
title: Modelo de producto por vertical (Orbix)
type: business
owner: Requiere validación
updated: 2026-08-21
tags: [dominio, orbix-erp, catalogo, productos, inventario]
---

# Modelo de producto por vertical (Orbix ERP)

Cómo un mismo catálogo sirve a retail, restaurante y tienda online, qué está implementado
hoy y qué falta. Complemento de [[Separacion de datos por vertical (Orbix)]]: la conclusión
es la misma —el corte no es por vertical— pero aplicada al modelo de producto.

> **Estado al 2026-08-21.** El eje de variación dejó de ser una propuesta: el 2026-08-18 se
> entregó la fase *expand* de [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]].
> `ProductAttribute` es hoy **`ProductVariant`** con `isDefault`, y `BranchInventory` está
> llaveado por `(branchId, variantId)`. El análisis de abajo describe el punto de partida y
> el diseño objetivo; lo que **sigue sin hacerse** es el `variantId` en `OrderItem` /
> `StoreWhatsappOrderItem`, el `sku`/`barcode`/`status` de la variante y el retiro de
> `Product.stock`. Ver el ADR para el desglose exacto de entregado vs. pendiente.

## Los dos ejes

Lo que parece "un producto por vertical" son en realidad **dos ejes ortogonales**. Ninguno
pertenece a una vertical: un restaurante vende playeras con talla, una tienda online vende
cajas de regalo (combo), una cafetería de retail vende café que consume insumos.

| Eje | Pregunta | Estado |
|---|---|---|
| **Composición** — ¿de qué está hecho lo que vendo? | `SIMPLE` · `RECIPE` · `COMBO` · `SERVICE` | **Implementado** (`ProductType`) |
| **Variación** — ¿el mismo artículo tiene presentaciones vendibles distintas? | talla, color, presentación | **Parcial** (`ProductVariant` ya lleva el stock; falta SKU y `OrderItem.variantId`) |

La vertical no elige el modelo de datos: elige **qué parte de ese modelo se muestra en la
UI y qué combinaciones se permiten**. `Tenant.businessVertical`, `TenantFeature` y el flag
`Product.isEcommerce` ya cumplen ese papel.

## Eje 1 — composición (resuelto)

`ProductType` distingue cuatro formas, y `InventoryConsumptionEngine`
(`retail/inventory/inventory-consumption.engine.ts`) es la única fuente de verdad sobre el
movimiento de stock que provoca una venta y su reversa.

```
SIMPLE   Product.stock / BranchInventory        → descuenta el producto
RECIPE   Recipe → RecipeItem → Supply           → descuenta insumos, con conversión de unidad
COMBO    ComboItem (padre → hijos, recursivo)   → expande y descuenta cada hoja
SERVICE  sin inventario                          → se ignora
```

- El **negocio de venta** usa `SIMPLE`: `price`, `costPrice`, `categoryId`, `stock` por
  sucursal en `BranchInventory`.
- El **restaurante** usa `RECIPE` (hamburguesa → pan, carne, tomate, cada uno un `Supply`
  con `cost`, `unit` y `stock` decimal) y `COMBO` (`ComboItem`, expansión recursiva hasta
  profundidad 8; un combo hijo se vuelve a expandir).
- El motor es simétrico por diseño: `consume` y `restore` recorren el mismo árbol
  (`resolveEffects`), así que cancelar o devolver deshace exactamente lo que la venta
  descontó. Nunca abre su propia `$transaction` — participa en la del llamador, para que
  venta, pago y caja queden en la misma unidad atómica.

Esta parte no necesita nada nuevo. Un restaurante ya se modela bien hoy.

## Eje 2 — variación (el hueco real)

`ProductAttribute` es hoy `{ productId, name, cost, price }`. Sirve para **cobrar** distinto
por talla, pero **no** para inventariarla:

- no tiene `sku` ni `barcode` → no se puede escanear ni comprar por variante;
- **no tiene `stock`** → `BranchInventory` tiene PK `(branchId, productId)`, no por variante;
- `OrderItem` y `StoreWhatsappOrderItem` **no guardan qué variante se vendió**;
- `PurchaseOrderItem` compra al producto, no a la variante.

Consecuencia concreta con la camisa S/M/L/XL: se puede publicar cada talla con su precio,
pero al vender una L el stock baja del contador único del producto. No se sabe cuántas L
quedan, la compra a proveedor no distingue tallas y el reporte de rotación por talla no
existe. `ProductFeature` no cubre esto: es ficha técnica descriptiva, sin precio ni stock.

### Diseño propuesto: la variante es la unidad vendible

```
Product         identidad comercial: nombre, categoría, imágenes, tipo, SEO
  └─ ProductVariant   sku · barcode · price · costPrice · isDefault · attributes
        └─ BranchInventory (branchId, variantId)   ← el stock se mueve aquí
```

**Regla clave: todo producto tiene al menos una variante**, la `isDefault`, aunque no sea
configurable. Un producto `SIMPLE` de abarrotes tiene una variante; la camisa tiene cuatro.
Así el resto del sistema (venta, inventario, compra, reporte) habla **siempre** de
variantes y no se llena de `if (tieneVariantes)` — que es lo que vuelve sucio este tipo de
modelo cuando se añade a medias.

Camino de migración, en orden:

1. Ampliar `ProductAttribute` → `ProductVariant`: añadir `sku`, `barcode`, `isDefault`,
   `status`. Backfill: una variante default por producto existente, heredando `sku`,
   `price` y `costPrice`.
2. Mover el stock: `BranchInventory` con PK `(branchId, variantId)`; `Product.stock` pasa a
   ser un **agregado derivado** (o se elimina). `InventoryMovement` gana `variantId`.
3. Añadir `variantId` a `OrderItem`, `StoreWhatsappOrderItem`, `PurchaseOrderItem`,
   `PurchaseReceiptItem`, `ServiceQuoteItem`.
4. Adaptar `InventoryConsumptionEngine`: las hojas `SIMPLE` pasan a resolverse por variante.
   El árbol de `COMBO`/`RECIPE` no cambia.

**Opciones estructuradas** (`Talla` × `Color` como matriz filtrable) solo si la tienda
necesita facetas: `ProductOption` + `ProductOptionValue` + join a la variante. Mientras no
haya filtrado por atributo, basta el `name` plano más un `attributes Json` en la variante.
No adelantar esa tabla.

### La variante es unidad vendible, no unidad de inventario

Forzar una variante **no** significa forzar inventario. El stock cuelga de ella solo cuando
`trackInventory` — igual que hoy, donde `type !== 'SIMPLE'` fuerza `trackInventory = false`
y `stock = 0`.

| Tipo | Variantes | Dónde vive el stock |
|---|---|---|
| `SIMPLE` sin opciones | 1 default | en la variante |
| `SIMPLE` con opciones (camisa S/M/L/XL) | N | en cada variante |
| `RECIPE` | 1 default | en los **insumos**, no en la variante |
| `COMBO` | 1 default | en las hojas expandidas |
| `SERVICE` | 1 default | ninguno |

Para `RECIPE`/`COMBO`/`SERVICE` la default es solo el ancla de SKU y precio.

**Por qué obligatoria y no opcional (`variantId` nullable).** El costo de la alternativa no
es la columna nullable: es el `if (tieneVariantes)` replicado en cada consumidor — motor de
consumo, checkout, recepción de compra, ajuste de stock, corte, reportes, transferencias.
Hoy `InventoryConsumptionEngine` garantiza que `consume` y `restore` recorren **el mismo
árbol** (`resolveEffects` compartido), y de ahí viene la simetría venta/devolución. Con dos
caminos esa garantía se duplica y basta romperla en uno para tener stock descuadrado sin
rastro. Ver [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]].

**Invisible en la UI.** Regla de presentación: si `variants.length === 1 && isDefault`, el
formulario muestra el producto plano (precio, costo y stock directos), sin pestaña de
variantes. Un abarrote se administra igual que hoy; solo cambia dónde escribe ese campo.

**Deuda que conviene pagar en la misma migración.** Hoy el stock vive en **dos sitios**:
`Product.stock` (global, autoritativo — `consume` valida contra él) y `BranchInventory.stock`
(ledger por sucursal que, si queda corto, **se clampa a 0** en vez de fallar; el comentario
del engine lo llama "under-tracked"). Ya son dos verdades que pueden divergir en silencio.
Al mover a variantes, hacer `BranchInventory(branchId, variantId)` la **única** verdad y
derivar el total: es el momento natural, porque ese camino de código se toca una sola vez.

### Ciclo de vida de la variante por defecto

Caso central: un producto se da de alta sin variantes (una default implícita), y más tarde
se decide que sí tendrá tallas. **La default no se cancela ni se elimina: se promueve.**

Para entonces esa variante ya acumuló `OrderItem.variantId` de ventas pasadas,
`InventoryMovement`, stock real en `BranchInventory` y `PurchaseOrderItem` de compras
recibidas. Borrarla rompe el histórico; dejarla en `SetNull` deja líneas huérfanas en los
reportes; desactivarla y crear otra deja el stock varado en un registro fantasma. El
precedente ya existe un nivel arriba: `delete` de producto rechaza con "Cannot delete
product with existing orders".

```
Camisa → variante única (sin nombre, SKU CAM-001, 50 pzas, 12 ventas)

usuario: "esto va a manejar tallas"
  UI: "La configuración actual (CAM-001, 50 pzas) será la primera talla. ¿Cuál?"  → "M"
  UPDATE product_variants SET name = 'M' WHERE id = <la que ya existía>
  se agregan S, L, XL como variantes nuevas, stock 0
```

Un `UPDATE` de un campo. Stock, SKU, ventas e historial intactos; nunca hay dos registros
donde debería haber uno.

**Si el stock está mezclado** (las 50 piezas son de varias tallas), no es un problema del
modelo: se crean las variantes y se hace un **ajuste de inventario** que reparte las 50
entre S/M/L/XL, con su `InventoryMovement` y su motivo. El sistema pide el reparto y lo
registra; no lo adivina.

**Camino inverso** (volver de 4 variantes a producto plano): solo si las otras 3 quedan en
stock 0 y sin ventas. Con historial se **archivan** (`status: ARCHIVED`) — dejan de ser
vendibles y conservan sus FKs. Una variante con historial nunca se borra.

### El patrón `deleteMany` + `createMany` deja de ser válido

`update` de producto hoy hace **replace total** de los atributos
(`products.service.ts:378`, "Sync attributes — full replace"):

```ts
await tx.productAttribute.deleteMany({ where: { productId: id } });
await tx.productAttribute.createMany({ data: attributes.map(...) });
```

Funciona porque `ProductAttribute` es texto y precio, desechable. En cuanto la variante
lleve stock y FKs de venta, ese patrón se vuelve **destructivo**: borra el registro y crea
otro con id nuevo, dejando todo el histórico apuntando a un id inexistente. `update` tiene
que pasar a diff real — `create` los nuevos, `update` los existentes por id, `archive` los
que se quitaron — y nunca `deleteMany`. Es el punto de esta migración que más fácil se pasa
por alto y el que produce pérdida de datos silenciosa. Aplica igual a `comboItems`, que hoy
sigue el mismo patrón.

### Variantes que cambian la receta

Hamburguesa sencilla vs. doble es variación **y** composición a la vez. Dos salidas:

- **v1 (recomendada):** cada una es su propio `Product` de tipo `RECIPE`. Es como ya operan
  los restaurantes, el motor lo soporta sin cambios y no cuesta nada.
- **v2 (solo si se justifica):** mover `Recipe.productId @unique` a `Recipe.variantId`, con
  receta por variante. Es el cambio más caro del rediseño; no hacerlo por anticipado.

### Modificadores de comanda — problema distinto

"Sin cebolla", "extra queso" no son variantes: se eligen en la comanda, pueden sumar precio
y consumir insumos, y no son SKUs comprables. Hoy `DiningOrderItem.notes` es **texto libre**:
no suma al total ni descuenta insumos. Si el negocio lo requiere, se modela aparte
(`ModifierGroup` / `Modifier` con `supplyId` y `priceDelta` opcionales), **no** metiéndolo
en `ProductVariant`.

## Qué decide la vertical

Nada de lo anterior se duplica por vertical. Lo que cambia por vertical es la **presentación
y las reglas de captura**, gateadas por lo que ya existe:

| Vertical | Tipos que se ofrecen en la UI | Gate actual |
|---|---|---|
| Retail | `SIMPLE`, `SERVICE`, `COMBO` | `businessVertical`, `businessProfile` |
| Restaurante | `RECIPE`, `COMBO`, `SIMPLE` | `TenantFeature.TABLES` / `KITCHEN` |
| Tienda online | variantes + `ProductFeature` + imágenes | `Product.isEcommerce` |

`isEcommerce` es el precedente correcto: un flag en el producto decide si el formulario pide
atributos, sin catálogo paralelo. La misma técnica cubre el resto.

## Quién decide el tipo de producto

**El frontend decide qué se ofrece; el backend decide qué se acepta.** Son dos preguntas
distintas, y las dos están respondidas — pero solo para una capacidad.

Un negocio de venta de artículos no ve la opción "receta" en el formulario, y esa es la
conducta correcta. Lo importante es que el frontend **no la hardcodea**: la lee del backend,
así que hay una sola fuente de verdad.

```
Tenant.businessProfile                        RETAIL / RESTAURANT / …
  → buildFeaturesForProfile()                 api/src/common/business-config/business-features.ts
  → auth.service.ts:416  businessFeatures      viaja en la respuesta de select-tenant
  → auth-store → use-tenant-features.ts:36     hasBusinessFeature()
  → product-form-modal.tsx:670                 oculta RECIPE del selector de tipo
  ⟂ assertRecipesEnabled()                     403 si alguien llama el endpoint directo
```

Ese es el patrón a replicar. De los **11 flags** de `BusinessFeatures`, solo **2** están
conectados de punta a punta —`enableRecipes` y `enableSupplies`—; los otros nueve
(`enableInventory`, `enableBranchInventory`, `enableKitchen`, `enableTables`,
`enableReservations`, `enableManufacturing`, `enableLots`, `enableSerialNumbers`,
`enableScale`) existen solo como tipo en `web/src/types/business-config.ts`, sin consumidor
en API ni en UI.

Lo que el backend **sí** impone hoy (`retail/products/products.service.ts`):

- `type === 'RECIPE'` → `assertRecipesEnabled()` consulta
  `BusinessConfigurationService.hasFeature('enableRecipes')`, derivado de
  `Tenant.businessProfile` (`common/business-config/business-features.ts`). 403 si el perfil
  no lo permite — solo `RESTAURANT` y `RETAIL_MANUFACTURING` lo traen encendido.
- `type !== 'SIMPLE'` → fuerza `trackInventory = false` y `stock = 0`; `adjustStock` rechaza
  cualquier no-`SIMPLE` ("Solo productos SIMPLE manejan stock directo").
- `@RequireModule('inventario')` en el controller — gate por **plan**, no por vertical.
- `COMBO`, `SERVICE` y `SIMPLE` **sin gate de vertical**, por decisión explícita (BR-02:
  "COMBO and SERVICE remain available on every vertical").

El mecanismo correcto ya existe (`BusinessConfigurationService` + `BusinessFeatures`); falta
generalizarlo a un `assertProductTypeAllowed(type)`. Nota: el comentario BP-02 en
`business-features.ts` afirma que nada consume los flags — está desactualizado, `products` y
`supplies` ya los consumen.

### Huecos donde hoy manda solo el frontend

1. **`RECIPE` sin `recipeItems`** → se crea el producto pero no la receta
   (`if (type === 'RECIPE' && recipeItems?.length)` no falla con lista vacía). Producto
   vendible que no descuenta nada. Igual para **`COMBO` sin `comboItems`**.
2. **`SIMPLE` con `recipeItems`/`comboItems`** → se ignoran en silencio; debería ser 400.
3. **Sin validación de ciclos en `COMBO`** (A → B → A). `MAX_COMBO_DEPTH = 8` en el engine
   es red de seguridad en runtime, pero el ciclo se persiste igual.
4. **Referencias sin filtro de tenant — fuga de aislamiento, confirmada.** En `create`,
   `update` y `upsertComboItems`, el `childProductId` se inserta sin verificar que
   pertenezca al tenant; lo mismo con `supplyId` en `upsertRecipe`. El producto padre **sí**
   se valida (`findFirst({ id, tenantId })`), el hijo no. Y `InventoryConsumptionEngine`
   resuelve cada hoja con `tx.product.findUnique({ where: { id } })` y descuenta con
   `updateMany({ where: { id, stock: { gte } } })`, ambos **sin `tenantId`** —
   `PRODUCT_LOAD_SELECT` ni siquiera trae la columna, así que el motor no puede notarlo.

   Encadenado: un tenant que conozca un UUID ajeno lo referencia en su combo y, al vender,
   descuenta stock del otro tenant. Requiere conocer el id (no enumerable), pero no hay
   ninguna barrera después de eso.

   **Verificado** (2026-08-17) con dos specs que expresan el comportamiento esperado y hoy
   fallan: `retail/products/products.tenant-isolation.spec.ts` y
   `retail/inventory/inventory-consumption.tenant-isolation.spec.ts` — 7 rojos, 1 verde (el
   control que comprueba que el producto **padre** sí está protegido). El motor emite
   literalmente `where: { id: "producto-de-otro-tenant", stock: { gte: 2 } }` sin lanzar.
   Los specs quedan como test de regresión: pasan cuando se cierre el hueco.

   Corrección: validar contra el tenant todo id recibido en el body (`childProductId`,
   `supplyId`, `categoryId`) y acotar por `tenantId` las lecturas y escrituras del motor.
   Es un caso particular del aislamiento manual descrito en
   [[Separacion de datos por vertical (Orbix)]]; la extension de Prisma propuesta ahí lo
   cerraría de raíz.

## Evidencia

- `api/prisma/schema.prisma` — `ProductType`, `Product`, `ProductAttribute` (sin `sku` ni
  `stock`), `ProductFeature`, `Supply`, `Recipe`/`RecipeItem`, `ComboItem`,
  `BranchInventory` (PK `branchId, productId`), `OrderItem` y `StoreWhatsappOrderItem` (sin
  `attributeId`), `DiningOrderItem.notes`.
- `src/modules/retail/inventory/inventory-consumption.engine.ts` — expansión recursiva
  `COMBO` → `SIMPLE`/`RECIPE`, simetría consume/restore, `MAX_COMBO_DEPTH = 8`.
- `src/modules/core/store/store.service.ts` — la tienda pública expone
  `attributes { id, name, price }` y excluye `cost` a propósito.
- `src/modules/retail/products/products.service.ts:378` — replace total de atributos
  (`deleteMany` + `createMany`), mismo patrón en `comboItems`.
- `src/modules/retail/inventory/inventory-consumption.engine.ts:388` —
  `applyBranchInventoryDelta`: el ledger de sucursal se clampa a 0, el stock global es la
  barrera autoritativa.
- Cadena del gate por vertical: `api/src/common/business-config/business-features.ts`,
  `api/src/modules/core/auth/auth.service.ts:416`, `web/src/hooks/use-tenant-features.ts:36`,
  `web/src/components/inventario/product-form-modal.tsx:670`.

## Relacionados

- [[Inventario y Compras (Orbix)]] · [[Ventas y Punto de Venta (Orbix)]] · [[Restaurante (Orbix)]]
- [[Separacion de datos por vertical (Orbix)]]
- [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]]
