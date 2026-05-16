---
name: project-modules
description: Módulos implementados en la API y su estado actual
type: project
---

## Módulos API implementados (a 2026-05-02)

- auth — Login, select-tenant, select-branch, JWT de dos pasos
- users — CRUD usuarios
- tenants — Gestión de tenants
- categories — Categorías de productos
- products — Productos con inventario
- customers — Clientes (patrón completo: DTO, service, controller, module)
- suppliers — Proveedores (implementado 2026-05-02, ver modelo Supplier en schema)
- orders — Pedidos/ventas
- coupons — Cupones de descuento
- dashboard — KPIs y métricas
- email — Envío de correos
- permissions — Permisos canónicos (ALL_PERMISSIONS + MODULES_ORDER)
- roles — Roles tenant-scoped
- branches — Sucursales con inventario por sucursal

## Modelo Supplier (schema)

Campos: id, tenantId, name, contactName?, email, phone?, city?, category?, paymentTerms?, status (ACTIVE/INACTIVE), totalOrders, totalSpent (Decimal 12,2), createdById?, updatedById?, createdAt, updatedAt
Unique: [tenantId, email]
Relaciones: tenant, createdBy (SupplierCreatedBy), updatedBy (SupplierUpdatedBy)

## Why:
Suppliers es el módulo más reciente. totalOrders y totalSpent son campos de conteo/acumulado que se actualizan manualmente (no hay triggers automáticos aún).

## How to apply:
Al agregar nuevos módulos, seguir el mismo patrón: schema → db push → generate → DTOs → service → controller → module → AppModule → permissions.constants.ts
