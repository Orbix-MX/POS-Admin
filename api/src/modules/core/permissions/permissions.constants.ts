export interface PermissionDef {
  key: string;
  name: string;
  description?: string;
  module: string;
  action: string;
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // dashboard
  { key: 'dashboard:view',   name: 'Ver dashboards',          module: 'dashboard', action: 'view'   },
  { key: 'dashboard:edit',   name: 'Editar layout',           description: 'Mover y redimensionar widgets en el dashboard', module: 'dashboard', action: 'edit'   },
  { key: 'dashboard:manage', name: 'Administrar dashboards',  description: 'Crear, editar y eliminar dashboards y widgets',  module: 'dashboard', action: 'manage' },
  // pos
  { key: 'pos:access', name: 'Acceder al POS', module: 'pos', action: 'access' },
  { key: 'pos.cash:open', name: 'Abrir caja desde POS', description: 'Permite abrir sesión de caja desde el punto de venta', module: 'pos', action: 'cash:open' },
  { key: 'pos.cash:close', name: 'Cerrar caja desde POS', description: 'Permite cerrar sesión de caja desde el punto de venta', module: 'pos', action: 'cash:close' },
  { key: 'pos.quotes:create', name: 'Crear cotizaciones desde POS', module: 'pos', action: 'quotes:create' },
  { key: 'pos.quotes:view', name: 'Ver cotizaciones desde POS', module: 'pos', action: 'quotes:view' },
  { key: 'pos.quotes:load', name: 'Cargar cotizaciones al carrito', module: 'pos', action: 'quotes:load' },
  // products
  { key: 'products:view', name: 'Ver productos', module: 'products', action: 'view' },
  { key: 'products:create', name: 'Crear productos', module: 'products', action: 'create' },
  { key: 'products:edit', name: 'Editar productos', module: 'products', action: 'edit' },
  { key: 'products:delete', name: 'Eliminar productos', module: 'products', action: 'delete' },
  // categories
  { key: 'categories:view', name: 'Ver categorías', module: 'categories', action: 'view' },
  { key: 'categories:create', name: 'Crear categorías', module: 'categories', action: 'create' },
  { key: 'categories:edit', name: 'Editar categorías', module: 'categories', action: 'edit' },
  { key: 'categories:delete', name: 'Eliminar categorías', module: 'categories', action: 'delete' },
  // orders
  { key: 'orders:view', name: 'Ver ventas', module: 'orders', action: 'view' },
  { key: 'orders:create', name: 'Crear ventas', module: 'orders', action: 'create' },
  { key: 'orders:edit', name: 'Editar ventas', module: 'orders', action: 'edit' },
  // refunds
  { key: 'refunds:create', name: 'Crear reembolsos', description: 'Procesar reembolsos de ventas y apartados', module: 'refunds', action: 'create' },
  { key: 'refunds:partial', name: 'Reembolsos parciales', description: 'Procesar devoluciones por monto menor al total cobrado', module: 'refunds', action: 'partial' },
  { key: 'refunds:override_window', name: 'Forzar reembolso fuera de plazo', description: 'Autorizar reembolsos de apartados cuando venció el plazo configurado', module: 'refunds', action: 'override_window' },
  { key: 'refunds:override_method', name: 'Cambiar método de reembolso', description: 'Devolver por método distinto al pago original', module: 'refunds', action: 'override_method' },
  // customers
  { key: 'customers:view', name: 'Ver clientes', module: 'customers', action: 'view' },
  { key: 'customers:create', name: 'Crear clientes', module: 'customers', action: 'create' },
  { key: 'customers:edit', name: 'Editar clientes', module: 'customers', action: 'edit' },
  { key: 'customers:delete', name: 'Eliminar clientes', module: 'customers', action: 'delete' },
  // coupons
  { key: 'coupons:view', name: 'Ver cupones', module: 'coupons', action: 'view' },
  { key: 'coupons:create', name: 'Crear cupones', module: 'coupons', action: 'create' },
  { key: 'coupons:edit', name: 'Editar cupones', module: 'coupons', action: 'edit' },
  { key: 'coupons:delete', name: 'Eliminar cupones', module: 'coupons', action: 'delete' },
  // users
  { key: 'users:view', name: 'Ver usuarios', module: 'users', action: 'view' },
  { key: 'users:create', name: 'Crear usuarios', module: 'users', action: 'create' },
  { key: 'users:edit', name: 'Editar usuarios', module: 'users', action: 'edit' },
  { key: 'users:delete', name: 'Eliminar usuarios', module: 'users', action: 'delete' },
  // roles
  { key: 'roles:view', name: 'Ver roles', module: 'roles', action: 'view' },
  { key: 'roles:create', name: 'Crear roles', module: 'roles', action: 'create' },
  { key: 'roles:edit', name: 'Editar roles', module: 'roles', action: 'edit' },
  { key: 'roles:delete', name: 'Eliminar roles', module: 'roles', action: 'delete' },
  // suppliers
  { key: 'suppliers:view', name: 'Ver proveedores', module: 'suppliers', action: 'view' },
  { key: 'suppliers:create', name: 'Crear proveedores', module: 'suppliers', action: 'create' },
  { key: 'suppliers:edit', name: 'Editar proveedores', module: 'suppliers', action: 'edit' },
  { key: 'suppliers:delete', name: 'Eliminar proveedores', module: 'suppliers', action: 'delete' },
  // purchases
  { key: 'purchases:view', name: 'Ver compras', description: 'Ver listado y detalle de órdenes de compra', module: 'purchases', action: 'view' },
  { key: 'purchases:create', name: 'Crear compras', description: 'Crear nuevas órdenes de compra', module: 'purchases', action: 'create' },
  { key: 'purchases:edit', name: 'Editar compras', description: 'Editar órdenes en borrador', module: 'purchases', action: 'edit' },
  { key: 'purchases:send', name: 'Enviar órdenes', description: 'Confirmar y enviar órdenes de compra', module: 'purchases', action: 'send' },
  { key: 'purchases:receive', name: 'Recibir mercancía', description: 'Registrar recepciones de mercancía', module: 'purchases', action: 'receive' },
  { key: 'purchases:cancel', name: 'Cancelar órdenes', description: 'Cancelar órdenes de compra', module: 'purchases', action: 'cancel' },
  // receivables (CxC)
  { key: 'receivables:view', name: 'Ver CxC', description: 'Ver cuentas por cobrar', module: 'receivables', action: 'view' },
  { key: 'receivables:pay', name: 'Registrar pagos', description: 'Registrar pagos en CxC', module: 'receivables', action: 'pay' },
  // payables (CxP)
  { key: 'payables:view', name: 'Ver CxP', description: 'Ver cuentas por pagar', module: 'payables', action: 'view' },
  { key: 'payables:pay', name: 'Pagar a proveedores', description: 'Registrar pagos a proveedores', module: 'payables', action: 'pay' },
  // cash sessions (Corte de caja)
  { key: 'cash:view', name: 'Ver caja', description: 'Ver sesiones y cortes de caja', module: 'cash', action: 'view' },
  { key: 'cash:manage', name: 'Gestionar caja', description: 'Abrir y cerrar sesiones de caja', module: 'cash', action: 'manage' },
  { key: 'caja:charge', name: 'Cobrar en Caja', description: 'Cobrar cuentas de comanda desde la estación de Caja (requiere el módulo Nodo de Caja activo)', module: 'cash', action: 'charge' },
  // branches (sucursales)
  { key: 'branches:view', name: 'Ver sucursales', description: 'Ver listado y detalle de sucursales', module: 'branches', action: 'view' },
  { key: 'branches:manage', name: 'Gestionar sucursales', description: 'Crear, editar y eliminar sucursales', module: 'branches', action: 'manage' },
  { key: 'branches:inventory', name: 'Gestionar inventario sucursal', description: 'Actualizar y transferir stock por sucursal', module: 'branches', action: 'inventory' },
  // work orders
  { key: 'work-orders:view', name: 'Ver órdenes de trabajo', description: 'Ver listado y detalle de órdenes de trabajo', module: 'work-orders', action: 'view' },
  { key: 'work-orders:create', name: 'Crear órdenes de trabajo', description: 'Crear nuevas órdenes de trabajo', module: 'work-orders', action: 'create' },
  { key: 'work-orders:edit', name: 'Editar órdenes de trabajo', description: 'Editar y actualizar órdenes de trabajo', module: 'work-orders', action: 'edit' },
  { key: 'work-orders:assign', name: 'Asignar técnicos', description: 'Asignar usuarios a órdenes de trabajo', module: 'work-orders', action: 'assign' },
  // employees (capital humano)
  { key: 'employees:view', name: 'Ver empleados', description: 'Ver listado y detalle de empleados', module: 'employees', action: 'view' },
  { key: 'employees:create', name: 'Dar de alta empleados', description: 'Registrar nuevos empleados', module: 'employees', action: 'create' },
  { key: 'employees:edit', name: 'Editar empleados', description: 'Editar datos de empleados', module: 'employees', action: 'edit' },
  { key: 'employees:delete', name: 'Dar de baja empleados', description: 'Desactivar empleados', module: 'employees', action: 'delete' },
  // comanda (restaurante)
  { key: 'comanda:view',   name: 'Acceder a Comandas',  description: 'Acceder al módulo de captura de comandas de restaurante', module: 'comanda', action: 'view'   },
  { key: 'comanda:manage', name: 'Administrar Comandas', description: 'Ver y gestionar todas las comandas del restaurante',       module: 'comanda', action: 'manage' },
  // restaurant areas
  { key: 'restaurant.areas:view',   name: 'Ver áreas de restaurante',   description: 'Ver listado de áreas (salón, terraza, etc.)', module: 'comanda', action: 'view'   },
  { key: 'restaurant.areas:create', name: 'Crear áreas de restaurante', description: 'Crear nuevas áreas en el restaurante',        module: 'comanda', action: 'create' },
  { key: 'restaurant.areas:update', name: 'Editar áreas de restaurante', description: 'Editar y activar/desactivar áreas',          module: 'comanda', action: 'update' },
  // restaurant tables
  { key: 'restaurant.tables:view',   name: 'Ver mesas',   description: 'Ver listado y estado de mesas', module: 'comanda', action: 'view'   },
  { key: 'restaurant.tables:create', name: 'Crear mesas', description: 'Agregar nuevas mesas',          module: 'comanda', action: 'create' },
  { key: 'restaurant.tables:update', name: 'Editar mesas', description: 'Editar mesas y cambiar estado', module: 'comanda', action: 'update' },
  // reports
  { key: 'reports:view', name: 'Ver reportes', module: 'reports', action: 'view' },
  // settings
  { key: 'settings:view', name: 'Ver configuración', description: 'Ver ajustes del tenant', module: 'settings', action: 'view' },
  { key: 'settings:manage', name: 'Gestionar configuración', description: 'Editar ajustes del tenant', module: 'settings', action: 'manage' },
  // tenant info & branding
  { key: 'tenant:view', name: 'Ver información empresa', description: 'Ver datos generales y branding de la empresa', module: 'tenant', action: 'view' },
  { key: 'tenant:edit', name: 'Editar información empresa', description: 'Editar datos generales de la empresa', module: 'tenant', action: 'edit' },
  { key: 'tenant:branding', name: 'Gestionar branding', description: 'Subir y cambiar logo y banner de la empresa', module: 'tenant', action: 'branding' },
  // kitchen (KDS)
  { key: 'kitchen:view',   name: 'Ver cocina (KDS)',       description: 'Ver órdenes activas en pantalla de cocina',     module: 'kitchen', action: 'view'   },
  { key: 'kitchen:manage', name: 'Gestionar cocina',       description: 'Iniciar, pausar, reanudar y marcar listo',      module: 'kitchen', action: 'manage' },
  { key: 'kitchen:reject', name: 'Rechazar órdenes',       description: 'Rechazar órdenes con comentario obligatorio',   module: 'kitchen', action: 'reject' },
];

export const MODULES_ORDER = [
  'dashboard', 'pos', 'comanda', 'products', 'categories', 'orders', 'refunds',
  'customers', 'receivables', 'suppliers', 'purchases', 'payables', 'cash', 'coupons', 'settings',
  'employees', 'branches', 'users', 'roles', 'reports',
];
