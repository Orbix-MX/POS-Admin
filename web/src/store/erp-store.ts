import { create } from 'zustand'
import { fetchTenantInfo } from '@/services/core/tenant-service'
import type { TenantInfo } from '@/services/core/tenant-service'
import type {
  Empresa, DashboardData, Venta, Compra, ProductoInventario,
  Cliente, Proveedor, ContabilidadData, POSProducto, POSCliente, ModuleId
} from '@/types/erp'

interface ERPState {
  // Navigation
  activeModule: ModuleId
  setActiveModule: (module: ModuleId) => void

  // Dark mode
  darkMode: boolean
  toggleDarkMode: () => void

  // POS
  posOpen: boolean
  setPosOpen: (open: boolean) => void
  pendingQuoteId: string | null
  setPendingQuoteId: (id: string | null) => void

  // Tenant branding (logo, name, etc.)
  tenantBranding: TenantInfo | null
  setTenantBranding: (branding: TenantInfo) => void
  loadTenantBranding: () => Promise<void>

  // Data
  empresa: Empresa
  dashboard: DashboardData
  ventas: Venta[]
  compras: Compra[]
  inventario: ProductoInventario[]
  clientes: Cliente[]
  proveedores: Proveedor[]
  contabilidad: ContabilidadData
  posProductos: POSProducto[]
  posClientes: POSCliente[]
}

export const useERPStore = create<ERPState>((set) => ({
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),

  darkMode: false,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode
    if (newMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return { darkMode: newMode }
  }),

  posOpen: false,
  setPosOpen: (open) => set({ posOpen: open }),
  pendingQuoteId: null,
  setPendingQuoteId: (id) => set({ pendingQuoteId: id }),

  tenantBranding: null,
  setTenantBranding: (branding) => set({ tenantBranding: branding }),
  loadTenantBranding: async () => {
    try {
      const info = await fetchTenantInfo()
      set({ tenantBranding: info })
    } catch {
      // silently ignore — sidebar shows fallback
    }
  },

  empresa: {
    nombre: "TiendaPro ERP",
    version: "v2.0.1",
    usuario: "Carlos García",
    email: "carlos@tiendapro.com"
  },

  dashboard: {
    kpis: [
      { label: "Ventas Hoy", value: "$12,840", change: "+8.2%", up: true, icon: "trending_up" },
      { label: "Compras Mes", value: "$34,200", change: "+3.1%", up: true, icon: "shopping_cart" },
      { label: "Stock Bajo", value: "14 productos", change: "-2", up: false, icon: "warning" },
      { label: "Clientes Activos", value: "1,284", change: "+42", up: true, icon: "people" }
    ],
    ventasMensuales: [
      { mes: "Ene", ventas: 28000, compras: 18000 },
      { mes: "Feb", ventas: 32000, compras: 21000 },
      { mes: "Mar", ventas: 27000, compras: 19000 },
      { mes: "Abr", ventas: 38000, compras: 24000 },
      { mes: "May", ventas: 35000, compras: 22000 },
      { mes: "Jun", ventas: 42000, compras: 28000 },
      { mes: "Jul", ventas: 39000, compras: 25000 },
      { mes: "Ago", ventas: 45000, compras: 30000 },
      { mes: "Sep", ventas: 48000, compras: 32000 },
      { mes: "Oct", ventas: 52000, compras: 35000 },
      { mes: "Nov", ventas: 58000, compras: 38000 },
      { mes: "Dic", ventas: 65000, compras: 42000 }
    ],
    topProductos: [
      { nombre: "Laptop Dell XPS 15", vendidos: 48, ingreso: "$72,000" },
      { nombre: "Monitor LG 27\" 4K", vendidos: 35, ingreso: "$21,000" },
      { nombre: "Teclado Mecánico RGB", vendidos: 120, ingreso: "$14,400" },
      { nombre: "Mouse Logitech MX", vendidos: 98, ingreso: "$9,800" },
      { nombre: "Auriculares Sony WH", vendidos: 67, ingreso: "$16,750" }
    ],
    actividadReciente: [
      { tipo: "venta", desc: "Venta #3102 - Juan Pérez", monto: "$2,400", tiempo: "hace 5 min" },
      { tipo: "compra", desc: "OC #892 - Proveedor TechWorld", monto: "$8,200", tiempo: "hace 18 min" },
      { tipo: "stock", desc: "Ajuste de inventario - 12 items", monto: "", tiempo: "hace 45 min" },
      { tipo: "venta", desc: "Venta #3101 - María López", monto: "$560", tiempo: "hace 1h" },
      { tipo: "pago", desc: "Pago recibido - Factura #2994", monto: "$1,990", tiempo: "hace 2h" }
    ]
  },

  ventas: [
    { id: "#3102", cliente: "Juan Pérez", email: "juan.perez@gmail.com", producto: "Laptop Dell XPS 15", estado: "Pagado", total: "$2,400.00", fecha: "01 May 2026", items: 1 },
    { id: "#3101", cliente: "María López", email: "maria.lopez@empresa.com", producto: "Monitor LG 27\" 4K", estado: "Pendiente", total: "$600.00", fecha: "01 May 2026", items: 2 },
    { id: "#3100", cliente: "Carlos Ruiz", email: "carlos.ruiz@negocio.com", producto: "Teclado + Mouse Set", estado: "Pagado", total: "$280.00", fecha: "30 Abr 2026", items: 3 },
    { id: "#3099", cliente: "Ana Martínez", email: "ana.m@correo.com", producto: "Auriculares Sony WH", estado: "Vencido", total: "$250.00", fecha: "29 Abr 2026", items: 1 },
    { id: "#3098", cliente: "Pedro Sánchez", email: "pedro.s@tienda.com", producto: "Laptop Dell XPS 15", estado: "Pagado", total: "$2,400.00", fecha: "28 Abr 2026", items: 1 },
    { id: "#3097", cliente: "Laura García", email: "laura.g@mail.com", producto: "Tablet iPad Pro", estado: "En proceso", total: "$1,200.00", fecha: "27 Abr 2026", items: 1 },
    { id: "#3096", cliente: "Diego Fernández", email: "diego.f@corp.com", producto: "Monitor + Soporte", estado: "Pagado", total: "$750.00", fecha: "26 Abr 2026", items: 2 },
    { id: "#3095", cliente: "Isabel Torres", email: "isabel.t@biz.com", producto: "Impresora HP LaserJet", estado: "Vencido", total: "$380.00", fecha: "25 Abr 2026", items: 1 }
  ],

  compras: [
    { id: "#OC-892", proveedor: "TechWorld S.A.", email: "ventas@techworld.com", producto: "Laptops Dell XPS (lote 10u)", estado: "Recibido", total: "$24,000.00", fecha: "01 May 2026", entrega: "01 May 2026" },
    { id: "#OC-891", proveedor: "Distribuidora LG", email: "pedidos@distlg.com", producto: "Monitores 27\" 4K (lote 20u)", estado: "En tránsito", total: "$12,000.00", fecha: "30 Abr 2026", entrega: "05 May 2026" },
    { id: "#OC-890", proveedor: "PeriféricosMex", email: "compras@perifmex.com", producto: "Teclados mecánicos (50u)", estado: "Pendiente", total: "$6,000.00", fecha: "29 Abr 2026", entrega: "07 May 2026" },
    { id: "#OC-889", proveedor: "Sony México", email: "b2b@sony.mx", producto: "Auriculares WH-1000XM5 (30u)", estado: "Recibido", total: "$7,500.00", fecha: "28 Abr 2026", entrega: "28 Abr 2026" },
    { id: "#OC-888", proveedor: "Apple Reseller", email: "orders@appleres.mx", producto: "iPad Pro M4 (15u)", estado: "En tránsito", total: "$18,000.00", fecha: "27 Abr 2026", entrega: "10 May 2026" },
    { id: "#OC-887", proveedor: "Logitech Dist.", email: "dist@logitech.mx", producto: "Mouse MX Master 3 (40u)", estado: "Cancelado", total: "$4,000.00", fecha: "26 Abr 2026", entrega: "-" }
  ],

  inventario: [
    { sku: "LAP-001", nombre: "Laptop Dell XPS 15", categoria: "Computadoras", stock: 12, minimo: 5, precio: "$2,400.00", costo: "$1,800.00", proveedor: "TechWorld S.A.", estado: "OK" },
    { sku: "MON-002", nombre: "Monitor LG 27\" 4K", categoria: "Monitores", stock: 3, minimo: 5, precio: "$600.00", costo: "$420.00", proveedor: "Distribuidora LG", estado: "Bajo" },
    { sku: "TEC-003", nombre: "Teclado Mecánico RGB", categoria: "Periféricos", stock: 45, minimo: 10, precio: "$120.00", costo: "$72.00", proveedor: "PeriféricosMex", estado: "OK" },
    { sku: "MOU-004", nombre: "Mouse Logitech MX Master", categoria: "Periféricos", stock: 28, minimo: 10, precio: "$100.00", costo: "$60.00", proveedor: "Logitech Dist.", estado: "OK" },
    { sku: "AUR-005", nombre: "Auriculares Sony WH-1000", categoria: "Audio", stock: 2, minimo: 5, precio: "$250.00", costo: "$180.00", proveedor: "Sony México", estado: "Bajo" },
    { sku: "TAB-006", nombre: "Tablet iPad Pro M4", categoria: "Tablets", stock: 8, minimo: 3, precio: "$1,200.00", costo: "$950.00", proveedor: "Apple Reseller", estado: "OK" },
    { sku: "IMP-007", nombre: "Impresora HP LaserJet", categoria: "Impresoras", stock: 0, minimo: 2, precio: "$380.00", costo: "$260.00", proveedor: "HP México", estado: "Agotado" },
    { sku: "CAB-008", nombre: "Cable HDMI 4K 2m", categoria: "Cables", stock: 120, minimo: 20, precio: "$18.00", costo: "$8.00", proveedor: "CablesPro", estado: "OK" }
  ],

  clientes: [
    { id: "CLI-001", nombre: "Juan Pérez", empresa: "Freelancer", email: "juan.perez@gmail.com", telefono: "+52 55 1234-5678", ciudad: "CDMX", totalCompras: "$12,400.00", pedidos: 6, estado: "Activo", desde: "Mar 2025" },
    { id: "CLI-002", nombre: "María López", empresa: "López & Asociados", email: "maria.lopez@empresa.com", telefono: "+52 55 9876-5432", ciudad: "Monterrey", totalCompras: "$8,200.00", pedidos: 4, estado: "Activo", desde: "Ene 2025" },
    { id: "CLI-003", nombre: "Carlos Ruiz", empresa: "TechStartup MX", email: "carlos.ruiz@negocio.com", telefono: "+52 33 5555-0000", ciudad: "Guadalajara", totalCompras: "$31,500.00", pedidos: 14, estado: "Activo", desde: "Jun 2024" },
    { id: "CLI-004", nombre: "Ana Martínez", empresa: "Diseño Digital", email: "ana.m@correo.com", telefono: "+52 55 2222-3333", ciudad: "CDMX", totalCompras: "$2,800.00", pedidos: 2, estado: "Inactivo", desde: "Nov 2025" },
    { id: "CLI-005", nombre: "Pedro Sánchez", empresa: "Constructora SP", email: "pedro.s@tienda.com", telefono: "+52 81 4444-7777", ciudad: "Monterrey", totalCompras: "$18,900.00", pedidos: 9, estado: "Activo", desde: "Ago 2024" },
    { id: "CLI-006", nombre: "Laura García", empresa: "Agencia Creativa", email: "laura.g@mail.com", telefono: "+52 55 8888-9999", ciudad: "CDMX", totalCompras: "$5,400.00", pedidos: 3, estado: "Activo", desde: "Feb 2026" }
  ],

  proveedores: [
    { id: "PROV-001", nombre: "TechWorld S.A.", contacto: "Roberto Méndez", email: "ventas@techworld.com", telefono: "+52 55 1111-2222", ciudad: "CDMX", categoria: "Computadoras", comprasTotal: "$84,000.00", ordenes: 12, estado: "Activo", plazo: "30 días" },
    { id: "PROV-002", nombre: "Distribuidora LG", contacto: "Patricia Flores", email: "pedidos@distlg.com", telefono: "+52 55 3333-4444", ciudad: "CDMX", categoria: "Monitores/TV", comprasTotal: "$42,000.00", ordenes: 7, estado: "Activo", plazo: "15 días" },
    { id: "PROV-003", nombre: "PeriféricosMex", contacto: "Luis Ortega", email: "compras@perifmex.com", telefono: "+52 33 5566-7788", ciudad: "Guadalajara", categoria: "Periféricos", comprasTotal: "$28,500.00", ordenes: 15, estado: "Activo", plazo: "45 días" },
    { id: "PROV-004", nombre: "Sony México", contacto: "Yuki Tanaka", email: "b2b@sony.mx", telefono: "+52 55 9900-1122", ciudad: "CDMX", categoria: "Audio/Video", comprasTotal: "$31,200.00", ordenes: 8, estado: "Activo", plazo: "30 días" },
    { id: "PROV-005", nombre: "Apple Reseller MX", contacto: "Sofía Vega", email: "orders@appleres.mx", telefono: "+52 55 4455-6677", ciudad: "CDMX", categoria: "Tablets/Mac", comprasTotal: "$95,000.00", ordenes: 10, estado: "Activo", plazo: "60 días" },
    { id: "PROV-006", nombre: "HP México", contacto: "Marco Delgado", email: "b2b@hp.mx", telefono: "+52 55 7788-9900", ciudad: "CDMX", categoria: "Impresoras", comprasTotal: "$14,800.00", ordenes: 5, estado: "Inactivo", plazo: "30 días" }
  ],

  contabilidad: {
    cuentasPorCobrar: [
      { id: "#FAC-3099", cliente: "Ana Martínez", monto: "$250.00", fechaVenc: "15 Abr 2026", diasVenc: 16, estado: "Vencido" },
      { id: "#FAC-3095", cliente: "Isabel Torres", monto: "$380.00", fechaVenc: "20 Abr 2026", diasVenc: 11, estado: "Vencido" },
      { id: "#FAC-3101", cliente: "María López", monto: "$600.00", fechaVenc: "15 May 2026", diasVenc: -14, estado: "Por vencer" },
      { id: "#FAC-3097", cliente: "Laura García", monto: "$1,200.00", fechaVenc: "10 May 2026", diasVenc: -9, estado: "Por vencer" }
    ],
    cuentasPorPagar: [
      { id: "#OC-890", proveedor: "PeriféricosMex", monto: "$6,000.00", fechaVenc: "20 May 2026", diasVenc: -19, estado: "Por vencer" },
      { id: "#OC-888", proveedor: "Apple Reseller", monto: "$18,000.00", fechaVenc: "01 Jun 2026", diasVenc: -31, estado: "Por vencer" },
      { id: "#OC-891", proveedor: "Distribuidora LG", monto: "$12,000.00", fechaVenc: "05 May 2026", diasVenc: -4, estado: "Por vencer" }
    ],
    resumen: { ingresos: "$185,400", egresos: "$124,200", utilidad: "$61,200", margen: "33%" }
  },

  posProductos: [
    { id: 1, nombre: "Laptop Dell XPS 15", sku: "LAP-001", categoria: "Computadoras", precio: 2400, costo: 1800, stock: 12, emoji: "💻" },
    { id: 2, nombre: "MacBook Air M3", sku: "LAP-002", categoria: "Computadoras", precio: 1899, costo: 1500, stock: 6, emoji: "💻" },
    { id: 3, nombre: "Laptop HP Pavilion", sku: "LAP-003", categoria: "Computadoras", precio: 980, costo: 720, stock: 9, emoji: "💻" },
    { id: 4, nombre: "Monitor LG 27\" 4K", sku: "MON-002", categoria: "Monitores", precio: 600, costo: 420, stock: 3, emoji: "🖥️" },
    { id: 5, nombre: "Monitor Samsung 32\"", sku: "MON-003", categoria: "Monitores", precio: 480, costo: 330, stock: 7, emoji: "🖥️" },
    { id: 6, nombre: "Monitor Dell UltraSharp", sku: "MON-004", categoria: "Monitores", precio: 750, costo: 520, stock: 4, emoji: "🖥️" },
    { id: 7, nombre: "Teclado Mecánico RGB", sku: "TEC-003", categoria: "Periféricos", precio: 120, costo: 72, stock: 45, emoji: "⌨️" },
    { id: 8, nombre: "Mouse Logitech MX Master", sku: "MOU-004", categoria: "Periféricos", precio: 100, costo: 60, stock: 28, emoji: "🖱️" },
    { id: 9, nombre: "Mousepad XL Premium", sku: "PAD-001", categoria: "Periféricos", precio: 35, costo: 15, stock: 60, emoji: "🖱️" },
    { id: 10, nombre: "Webcam Logitech C920", sku: "CAM-001", categoria: "Periféricos", precio: 95, costo: 60, stock: 15, emoji: "📷" },
    { id: 11, nombre: "Auriculares Sony WH-1000", sku: "AUR-005", categoria: "Audio", precio: 250, costo: 180, stock: 2, emoji: "🎧" },
    { id: 12, nombre: "Bocina JBL Charge 5", sku: "BOC-001", categoria: "Audio", precio: 180, costo: 120, stock: 10, emoji: "🔊" },
    { id: 13, nombre: "Audífonos AirPods Pro", sku: "AIR-001", categoria: "Audio", precio: 280, costo: 210, stock: 8, emoji: "🎧" },
    { id: 14, nombre: "Tablet iPad Pro M4", sku: "TAB-006", categoria: "Tablets", precio: 1200, costo: 950, stock: 8, emoji: "📱" },
    { id: 15, nombre: "Samsung Galaxy Tab S9", sku: "TAB-007", categoria: "Tablets", precio: 850, costo: 640, stock: 5, emoji: "📱" },
    { id: 16, nombre: "Cable HDMI 4K 2m", sku: "CAB-008", categoria: "Accesorios", precio: 18, costo: 8, stock: 120, emoji: "🔌" },
    { id: 17, nombre: "Hub USB-C 7 puertos", sku: "HUB-001", categoria: "Accesorios", precio: 65, costo: 38, stock: 22, emoji: "🔌" },
    { id: 18, nombre: "Cargador USB-C 65W", sku: "CAR-001", categoria: "Accesorios", precio: 45, costo: 25, stock: 35, emoji: "🔋" },
    { id: 19, nombre: "Impresora HP LaserJet", sku: "IMP-007", categoria: "Impresoras", precio: 380, costo: 260, stock: 0, emoji: "🖨️" },
    { id: 20, nombre: "Impresora Epson EcoTank", sku: "IMP-008", categoria: "Impresoras", precio: 290, costo: 195, stock: 4, emoji: "🖨️" },
  ],

  posClientes: [
    { id: "CLI-001", nombre: "Juan Pérez", email: "juan.perez@gmail.com" },
    { id: "CLI-002", nombre: "María López", email: "maria.lopez@empresa.com" },
    { id: "CLI-003", nombre: "Carlos Ruiz", email: "carlos.ruiz@negocio.com" },
    { id: "CLI-004", nombre: "Ana Martínez", email: "ana.m@correo.com" },
    { id: "CLI-005", nombre: "Pedro Sánchez", email: "pedro.s@tienda.com" },
  ],
}))
