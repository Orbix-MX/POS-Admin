import { api } from '@/lib/api-client'

// KDS sobre DiningOrder (fuente única de cocina, igual que la app móvil).
// Estados activos en cocina: SENT_TO_KITCHEN → IN_PREPARATION → READY.
export type KitchenOrderStatus =
  | 'SENT_TO_KITCHEN'
  | 'IN_PREPARATION'
  | 'READY'
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
  productId: string | null
  productName: string
  quantity: number
  notes: string | null
  product: KitchenProduct | null
}

export interface KitchenWaiter {
  id: string
  firstName: string
  lastName: string
}

export interface KitchenOrder {
  id: string
  reference: string | null
  status: KitchenOrderStatus
  serviceType: string
  openedAt: string
  table: { id: string; name: string } | null
  waiter: KitchenWaiter | null
  items: KitchenOrderItem[]
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const { data } = await api.get<KitchenOrder[]>('/restaurant/kitchen/orders')
  return data
}

export async function updateKitchenStatus(
  orderId: string,
  status: KitchenOrderStatus,
): Promise<KitchenOrder> {
  const { data } = await api.patch<KitchenOrder>(
    `/restaurant/kitchen/orders/${orderId}/status`,
    { status },
  )
  return data
}
