/**
 * Punto de entrada único al backend de Orbix.
 *
 * Orbix POS **no define servicios propios**: reexporta los del Admin Web
 * (`web/src/services/**`) a través del alias `@web`, de modo que ambos clientes
 * hablan con los mismos endpoints, con el mismo cliente HTTP (interceptores de
 * token, 401 y TENANT_SUSPENDED incluidos) y con los mismos tipos.
 *
 * Si algo falta aquí, la respuesta correcta es añadir el reexport — nunca
 * escribir una llamada `api.*` nueva dentro de `apps/pos-web`.
 */

// ---- cliente HTTP ----
export { api } from '@web/lib/api-client'

// ---- autenticación / contexto ----
export {
  login,
  logout,
  selectTenant,
  selectBranch,
  fetchMe,
  fetchBranches,
  fetchCapabilities,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from '@web/services/core/auth-service'
export type {
  AuthUser,
  Tenant,
  Branch,
  LoginResponse,
  SelectTenantResponse,
  SelectBranchResponse,
  CapabilitiesResponse,
  ProfileResponse,
} from '@web/services/core/auth-service'

export { fetchTenantInfo } from '@web/services/core/tenant-service'
export type { TenantInfo } from '@web/services/core/tenant-service'

export { fetchSettings } from '@web/services/core/configuracion-service'
export type { TenantSettings } from '@web/services/core/configuracion-service'

// ---- caja ----
export {
  fetchActiveCashSession,
  openCashSession,
  closeCashSession,
  listCashRegisters,
  createCashRegister,
  fetchCashSessionCapacity,
  withdrawCash,
  createCashCount,
  startCashCount,
  resumeCashSession,
} from '@web/services/core/caja-service'
export type {
  ApiCashSession,
  ApiCashMovement,
  CashSessionStatus,
  OpenSessionInput,
  CloseSessionInput,
  CashCountInput,
  WithdrawCashInput,
  ApiCashCount,
  SessionSummary,
  CashRegister,
  CashSessionCapacity,
} from '@web/services/core/caja-service'

// ---- catálogo ----
export { fetchAllProducts } from '@web/services/retail/product-service'
export type { Product, ProductVariant, ProductImage } from '@web/services/retail/product-service'

export { fetchCategories } from '@web/services/retail/categories-service'
export type { Category } from '@web/services/retail/categories-service'

// ---- clientes ----
export {
  fetchClientes,
  fetchCliente,
  createCliente,
} from '@web/services/core/clientes-service'
export type { Cliente, CreateClienteInput } from '@web/services/core/clientes-service'

// ---- ventas ----
export {
  createOrder,
  updateOrderStatus,
  getOrderById,
  customerName,
} from '@web/services/retail/ventas-service'
export type {
  ApiOrder,
  ApiOrderItem,
  ApiOrderPayment,
  CreateOrderInput,
  CreateOrderItemInput,
  CreateOrderPaymentSplit,
} from '@web/services/retail/ventas-service'

// ---- impresión ----
export { printOrder } from '@web/services/core/print-service'
