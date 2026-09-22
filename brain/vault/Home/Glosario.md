---
title: Glosario
type: home
owner: Requiere validación
updated: 2026-08-06
tags: [orbix, glosario, dominio]
---

# Glosario

Vocabulario de negocio de los dos productos del vault. El código mezcla español e inglés;
aquí se fija el término de negocio y su equivalente técnico observado.

## Orbix ERP (POS / ERP multi-vertical)

| Término | Significado | En código |
|---|---|---|
| **Tenant** | Cliente de la plataforma (una empresa). Unidad de aislamiento de datos. | `Tenant` |
| **Sucursal / Branch** | Punto físico de operación de un tenant. | `Branch` |
| **Vertical** | Tipo de negocio del tenant: retail, restaurante, gimnasio, servicios. | `Tenant.vertical` |
| **Feature de tenant** | Módulo opcional activable por tenant (mesas, cocina, delivery, membresías, servicios, citas). | `TenantFeature` |
| **Orden** | Venta, unificada entre POS de retail y comanda de restaurante. | `Order`, `OrderOrigin` |
| **Insumo** | Materia prima o consumible con conversión de unidades. | `Supply`, `SupplyAllowedUnit` |
| **Receta / Combo** | Producto compuesto por insumos u otros productos. | `Recipe`, `ComboItem` |
| **Cuenta por pagar (CxP)** | Deuda con un proveedor derivada de una compra. | `AccountPayable` |
| **Cuenta por cobrar (CxC)** | Deuda de un cliente con el tenant. | `AccountReceivable` |
| **Sesión de caja** | Periodo de apertura/cierre de una caja física, con sus movimientos. | `CashSession`, `CashMovement` |
| **Cotización de servicio** | Presupuesto de un servicio, convertible en orden. | `ServiceQuote` |
| **Orden de trabajo** | Trabajo de taller asignado a uno o más empleados. | `WorkOrder` |
| **Ronda de cocina (KDS)** | Agrupación de items enviados a cocina en un momento dado. | `KitchenRound` |
| **Panel Platform** | Administración interna de Orbix sobre todos los tenants (no es parte del ERP de un tenant). | módulos `platform/*` |

## Técnico (transversal)

| Término | Significado |
|---|---|
| **AsyncLocalStorage (ALS)** | Mecanismo de Orbix ERP para propagar `tenantId`/`branchId` sin pasarlo explícito por cada capa. |
| **Permiso `modulo:accion`** | Formato de los permisos granulares de Orbix ERP (`@RequirePermissions`). |
