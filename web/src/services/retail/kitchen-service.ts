import { api } from '@/lib/api-client'

export type KitchenOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'READY'
  | 'REJECTED'
  | 'DELIVERED'

export interface KitchenSupply {
  id: string
  name: string
}

export interface KitchenMeasurementUnit {
  id: string
  name: string
  symbol: string
}

export interface KitchenRecipeItem {
  id: string
  quantity: string
  unit: string
  supply: KitchenSupply
  measurementUnit: KitchenMeasurementUnit | null
}

export interface KitchenRecipe {
  id: string
  items: KitchenRecipeItem[]
}

export interface KitchenComboChild {
  id: string
  name: string
  type: string
  recipe: KitchenRecipe | null
}

export interface KitchenComboItem {
  id: string
  quantity: number
  child: KitchenComboChild
}

export interface KitchenProduct {
  id: string
  name: string
  type: 'SIMPLE' | 'RECIPE' | 'COMBO' | 'SERVICE'
  recipe: KitchenRecipe | null
  comboItems: KitchenComboItem[]
}

export interface KitchenOrderItem {
  id: string
  name: string
  description: string | null
  quantity: number
  product: KitchenProduct | null
}

export interface KitchenCreatedBy {
  id: string
  firstName: string
  lastName: string
}

export interface KitchenOrder {
  id: string
  orderNumber: string
  tableNumber: string | null
  employeeNumber: string | null
  notes: string | null
  kitchenStatus: KitchenOrderStatus
  kitchenStartedAt: string | null
  kitchenReadyAt: string | null
  kitchenPausedAt: string | null
  kitchenRejectedAt: string | null
  kitchenRejectedById: string | null
  kitchenRejectionComment: string | null
  createdAt: string
  updatedAt: string
  items: KitchenOrderItem[]
  createdBy: KitchenCreatedBy | null
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const { data } = await api.get<KitchenOrder[]>('/restaurant/kitchen/orders')
  return data
}

export async function updateKitchenStatus(
  orderId: string,
  status: KitchenOrderStatus,
  rejectionComment?: string,
): Promise<KitchenOrder> {
  const { data } = await api.patch<KitchenOrder>(
    `/restaurant/kitchen/orders/${orderId}/status`,
    { status, ...(rejectionComment ? { rejectionComment } : {}) },
  )
  return data
}
