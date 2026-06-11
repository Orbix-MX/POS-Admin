export interface Empresa {
  nombre: string
  version: string
  usuario: string
  email: string
}

export interface KPI {
  label: string
  value: string
  change: string
  up: boolean
  icon: string
}

export interface VentaMensual {
  mes: string
  ventas: number
  compras: number
}

export interface TopProducto {
  nombre: string
  vendidos: number
  ingreso: string
}

export interface ActividadReciente {
  tipo: 'venta' | 'compra' | 'stock' | 'pago'
  desc: string
  monto: string
  tiempo: string
}

export interface DashboardData {
  kpis: KPI[]
  ventasMensuales: VentaMensual[]
  topProductos: TopProducto[]
  actividadReciente: ActividadReciente[]
}

export interface Venta {
  id: string
  cliente: string
  email: string
  producto: string
  estado: 'Pagado' | 'Pendiente' | 'Vencido' | 'En proceso'
  total: string
  fecha: string
  items: number
}

export interface Compra {
  id: string
  proveedor: string
  email: string
  producto: string
  estado: 'Recibido' | 'En tránsito' | 'Pendiente' | 'Cancelado'
  total: string
  fecha: string
  entrega: string
}

export interface ProductoInventario {
  sku: string
  nombre: string
  categoria: string
  stock: number
  minimo: number
  precio: string
  costo: string
  proveedor: string
  estado: 'OK' | 'Bajo' | 'Agotado'
}

export interface Cliente {
  id: string
  // Campos de display (UI)
  nombre: string
  empresa: string
  email: string
  telefono: string
  ciudad: string
  totalCompras: string
  pedidos: number
  estado: 'Activo' | 'Inactivo'
  desde: string
  // Campos raw del API (para edición)
  firstName?: string
  lastName?: string
  phone?: string | null
  company?: string | null
  city?: string | null
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  type?: 'NEW' | 'REGULAR' | 'VIP' | 'WHOLESALE'
  // Crédito
  hasCredit?: boolean
  creditLimit?: number | null
  creditDays?: number
}

export interface Proveedor {
  id: string
  // Campos de display (UI)
  nombre: string
  contacto: string
  email: string
  telefono: string
  ciudad: string
  categoria: string
  comprasTotal: string
  ordenes: number
  estado: 'Activo' | 'Inactivo'
  plazo: string
  // Campos raw del API (para edición)
  name?: string
  contactName?: string | null
  phone?: string | null
  city?: string | null
  category?: string | null
  paymentTerms?: string | null
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface CuentaCobrar {
  id: string
  cliente: string
  monto: string
  fechaVenc: string
  diasVenc: number
  estado: string
}

export interface CuentaPagar {
  id: string
  proveedor: string
  monto: string
  fechaVenc: string
  diasVenc: number
  estado: string
}

export interface ContabilidadData {
  cuentasPorCobrar: CuentaCobrar[]
  cuentasPorPagar: CuentaPagar[]
  resumen: {
    ingresos: string
    egresos: string
    utilidad: string
    margen: string
  }
}

export interface POSProducto {
  id: number
  nombre: string
  sku: string
  categoria: string
  precio: number
  costo: number
  stock: number
  emoji: string
}

export interface POSCliente {
  id: string
  nombre: string
  email: string
}

export interface CarritoItem extends POSProducto {
  qty: number
}

export interface Empleado {
  id: string
  // Campos de display (UI)
  nombre: string
  puesto: string
  departamento: string
  email: string
  telefono: string
  numEmpleado: string
  tipoContrato: string
  salario: string
  estado: 'Activo' | 'Inactivo' | 'Suspendido' | 'En permiso'
  fechaIngreso: string
  // Campos raw del API (para edición)
  firstName?: string
  lastName?: string
  phone?: string | null
  department?: string | null
  position?: string | null
  contractType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'TEMPORARY'
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE'
  hireDate?: string
  birthDate?: string | null
  curp?: string | null
  rfc?: string | null
  notes?: string | null
  salaryRaw?: number | null
}

export type ModuleId =
  | 'dashboard'
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'clientes'
  | 'proveedores'
  | 'contabilidad'
  | 'cxc'
  | 'cxp'
  | 'caja'
  | 'reportes'
  | 'configuracion'
  | 'usuarios'
  | 'roles'
  | 'servicios'
  | 'cotizaciones'
  | 'ordenes-trabajo'
  | 'empleados'
  | 'pos'
  | 'branches'
  | 'comanda'
  | 'caja-restaurante'
  | 'insumos'
  | 'kitchen'
