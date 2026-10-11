
---
id: INV-001
name: Inventory Stock Adjustment
status: approved
version: 1.0
module: inventory
priority: high

----

# Inventory Stock Adjustment

## 1. Objective

Allow authorized users to increase or decrease inventory
through an explicit stock adjustment.

## 2. Scope

### In scope

- Manual stock increases
- Manual stock decreases
- Adjustment reason
- Inventory movement
- Audit information

### Out of scope

- Purchases
- Sales
- Transfers
- Recipes
- Reservations

## 3. Actors

- Tenant Admin
- Inventory Manager

## 4. Functional Requirements

### FR-001

The system MUST allow authorized users to create a stock adjustment.

### FR-002

The adjustment MUST specify:

- product
- quantity
- unit
- reason
- branch

### FR-003

The system MUST create an immutable inventory movement.

### FR-004

The system MUST reject adjustments that violate inventory rules.

## 5. Business Rules

### BR-001

The adjustment must belong to the current tenant.

### BR-002

The branch must belong to the tenant.

### BR-003

Quantity must be greater than zero.

### BR-004

The resulting stock must be calculated by the inventory engine.

## 6. Acceptance Criteria

### AC-001

Given an authorized inventory user

When they create a valid adjustment

Then inventory is updated.

### AC-002

Given an unauthorized user

When they attempt to create an adjustment

Then the operation is rejected.

### AC-003

Given a product belonging to another tenant

When an adjustment is attempted

Then the operation is rejected.

## 7. API Contract

POST /inventory/adjustments

Request:

```ts
{
  productId: string;
  quantity: number;
  type: "IN" | "OUT";
  reason: string;
  branchId: string;
}
```

## 8. Persistence

Entities affected:

- InventoryMovement
- Stock

## 9. Tests

[@test] inventory-adjustment.valid.test.ts  
[@test] inventory-adjustment.authorization.test.ts  
[@test] inventory-adjustment.tenant-isolation.test.ts

## 10. Risks

- concurrent stock updates
- transaction consistency

## 11. Open Questions

None.

## 12. Approval

Approved by: Carlos  
Date: YYYY-MM-DD


La ventaja es que puedes hacer trazabilidad:

```text
FR-003
   ↓
AC-003
   ↓
test
   ↓
service
   ↓
commit
````