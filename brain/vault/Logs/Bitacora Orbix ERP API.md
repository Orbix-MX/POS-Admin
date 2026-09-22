---
title: Bitacora Orbix ERP API
type: log
owner: Requiere validación
updated: 2026-08-21
tags: [bitacora, orbix-erp]
---

# Bitácora — Orbix ERP API

> Bitácora, **no documentación**. Aquí se anota lo que pasó; cuando algo se vuelve
> conocimiento estable, se mueve al documento que le corresponde (`Domain/`, `Systems/`,
> `Decisions/`).

## 2026-08-21 — Auditoría de deriva: el vault iba tres semanas atrás del código

**Qué pasó:** Revisión de qué tan al día estaba la documentación frente a ~25 commits desde
el 2026-08-06.

**Hallazgo / causa:** Lo que caía dentro de un documento existente sí se había actualizado
(cajas múltiples, OAuth de Google). Lo que **estrenaba superficie** — una app nueva, un
canal de venta nuevo — no dejó rastro: `apps/pos-web`, los storefronts Astro y los pedidos
por WhatsApp no tenían una sola mención en el vault. El sesgo es previsible: actualizar un
párrafo es barato, crear un documento y enlazarlo no.

Además la carpeta local del repo pasó de `pos-admin/` a `orbix-admin/` sin que se
corrigieran las 26 referencias del vault ni el `CLAUDE.md` de la raíz.

**Qué se hizo:** Se corrigieron las rutas; se documentaron el PIN de caja, el inventario por
variante, [[Orbix POS Web]], [[Orbix Tienda en Linea]] y [[Tienda en Linea (Orbix)]]; se
cerró [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]] como
aceptada en fase expand; se añadieron `ai/`, `store` y `store-orders` a
[[Modulos de Orbix ERP API]].

**Pendiente:** `apps/pos-web/BACKEND-GAPS.md` sigue listando como abiertos dos huecos ya
cerrados. Falta validar la relación entre `e-commerce` y `e-commerce-singlepage`, y si
`apps/root-garden` (sitio de un cliente) debe vivir en este repo.

## 2026-08-20 — Google OAuth, cajas múltiples y autorización por PIN

**Qué pasó:** Tres entregas en el mismo día sobre `core/auth` y `core/cash-sessions`.

**Hallazgo / causa:** La resolución implícita de caja tomaba *la primera activa de la
sucursal*, así que todos los cajeros caían en la misma y el segundo en abrir chocaba contra
el índice único: una sucursal con tres cajas operaba de hecho con una.

**Qué se hizo:** `CashSession` cuelga de un `CashRegister` concreto; arqueo y corte admiten
respaldo por **PIN de un `Employee`** cuando el cajero no tiene el permiso; y el login con
Google entra por un ticket de un solo uso, sin JWT en la URL. Documentado en
[[Caja y cortes (Orbix)]] y [[Autenticacion]].

## 2026-08-18 — Inventario por variante (fase expand)

**Qué pasó:** `ProductAttribute` pasó a `ProductVariant` y `BranchInventory` cambió de PK
`(branchId, productId)` a `(branchId, variantId)`.

**Hallazgo / causa:** Con la llave vieja era imposible inventariar dos presentaciones del
mismo producto: la camisa se cobraba por talla pero el stock bajaba de un contador único.

**Qué se hizo:** Migración **expand**, con las columnas legacy aún escritas para que sea
revertible, y un `VariantInventoryResolver` que traduce las llaves viejas para no reescribir
POS, comanda, caja, compras ni tienda. Ver
[[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)]].

**Pendiente (fase contract):** `OrderItem.variantId`, retirar `Product.stock`, y el
`sku`/`barcode`/`status` de la variante.

## 2026-08-16 — Plataforma AI: fases 1-4

**Qué pasó:** Se entregó `api/src/ai/` — gateway, registro de proveedores, prompts,
límites y uso — con proveedor local, Anthropic y Gemini, más el kill switch de gasto.

**Hallazgo / causa:** `gemini-2.5-flash` dejó de estar disponible a mitad de la entrega y el
catálogo tuvo que moverse a `gemini-3.7-flash` y luego a `3.6`. Confirma por qué el binding
feature→modelo es configuración y no código.

**Qué se hizo:** ADR-0024 a ADR-0028. Primer consumidor real: el asistente de alta de
productos.

## 2026-08-06 — Vault reescrito con contenido real de Orbix ERP

**Qué pasó:** El vault se reescribió por completo con el análisis real de `pos-admin`
(Orbix ERP), reemplazando el contenido previo de un ecosistema "Argos/GMEX" no relacionado.

**Hallazgo / causa:** No se encontraron ADR formales en el repositorio pese a haber
decisiones estructurales claras en el código (multi-tenancy por `tenantId`+ALS, login en dos
pasos, Zustand sobre Redux, modelo `Order` unificado). Se documentaron como ADR 0020-0023
marcando explícitamente que el motivo original **requiere validación** en los casos donde no
hay evidencia escrita del razonamiento.

**Qué se hizo:** Se documentaron los módulos `core/`, `retail/`, `restaurant/` y `platform/`
en [[Modulos de Orbix ERP API]], y los procesos de negocio en `Domain/`.

**Pendiente:** Confirmar el pipeline de CI/CD (no se encontró documentación); auditar
`apps/pos`, `apps/mobile/orbix-app` y `apps/desktop` con más profundidad — su estado
temprano se documentó en [[Orbix Apps Moviles y Desktop]] pero sin analizar el código a
fondo.
