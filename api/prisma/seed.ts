import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { ALL_PERMISSIONS } from '../src/modules/core/permissions/permissions.constants';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ============= Platform Super Admin =============
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (platformEmail && platformPassword) {
    const platformHashedPw = await bcrypt.hash(platformPassword, 10);
    await prisma.platformUser.upsert({
      where: { email: platformEmail },
      update: {},
      create: {
        email: platformEmail,
        password: platformHashedPw,
        firstName: 'Platform',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log('✅ Created platform super admin:', platformEmail);
  } else {
    console.warn('⚠️  PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD not set — skipping platform user seed');
  }

  // Create default tenant (required for multitenant schema)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Main Store',
      slug: 'default',
      status: 'ACTIVE',
      plan: 'PRO',
    },
  });
  console.log('✅ Created default tenant:', tenant.slug);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecommerce.com' },
    update: {},
    create: {
      email: 'admin@ecommerce.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Link admin to default tenant as OWNER
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      role: 'OWNER',
    },
  });

  // ============= Segundo tenant y usuario asociado =============
  const tenantNorte = await prisma.tenant.upsert({
    where: { slug: 'tienda-norte' },
    update: {},
    create: {
      name: 'Tienda Norte',
      slug: 'tienda-norte',
      status: 'ACTIVE',
      plan: 'STARTER',
    },
  });
  console.log('✅ Created tenant:', tenantNorte.slug);

  const ownerNortePassword = await bcrypt.hash('owner123', 10);
  const ownerNorte = await prisma.user.upsert({
    where: { email: 'owner@tienda-norte.com' },
    update: {},
    create: {
      email: 'owner@tienda-norte.com',
      password: ownerNortePassword,
      firstName: 'María',
      lastName: 'García',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created user for Tienda Norte:', ownerNorte.email);

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenantNorte.id, userId: ownerNorte.id } },
    update: {},
    create: {
      tenantId: tenantNorte.id,
      userId: ownerNorte.id,
      role: 'OWNER',
    },
  });
  console.log('✅ Linked user to Tienda Norte (OWNER)');

  // Create Walk-in customer (default for POS anonymous sales)
  const walkInCustomer = await prisma.customer.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'walkin@store.local' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'walkin@store.local',
      firstName: 'Cliente',
      lastName: 'General',
      phone: '0000000000',
      status: 'ACTIVE',
      type: 'NEW',
      createdById: admin.id,
    },
  });
  console.log('✅ Created Walk-in customer:', walkInCustomer.email);

  // Create default address for Walk-in customer
  let walkInAddress = await prisma.customerAddress.findFirst({
    where: {
      customerId: walkInCustomer.id,
      label: 'Store',
    },
  });

  if (!walkInAddress) {
    walkInAddress = await prisma.customerAddress.create({
      data: {
        customerId: walkInCustomer.id,
        label: 'Store',
        firstName: 'Cliente',
        lastName: 'General',
        phone: '0000000000',
        address1: 'Tienda Física',
        city: 'Local',
        state: 'N/A',
        zipCode: '00000',
        country: 'US',
        isDefault: true,
      },
    });
  }
  console.log('✅ Created Walk-in address');

  // Create categories
  const electronicsCategory = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'electronics' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and accessories',
      status: 'ACTIVE',
      sortOrder: 1,
      createdById: admin.id,
    },
  });

  const phonesCategory = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'smartphones' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Smartphones',
      slug: 'smartphones',
      description: 'Latest smartphones',
      parentId: electronicsCategory.id,
      status: 'ACTIVE',
      sortOrder: 1,
      createdById: admin.id,
    },
  });

  const clothingCategory = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'clothing' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Clothing',
      slug: 'clothing',
      description: 'Men and women clothing',
      status: 'ACTIVE',
      sortOrder: 2,
      createdById: admin.id,
    },
  });

  console.log('✅ Created categories');

  // Create products
  const product1 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH-14-PRO-128' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'IPH-14-PRO-128',
      name: 'iPhone 14 Pro 128GB',
      slug: 'iphone-14-pro-128gb',
      description: 'Latest iPhone with A16 Bionic chip',
      price: 999.99,
      comparePrice: 1099.99,
      costPrice: 750.00,
      categoryId: phonesCategory.id,
      status: 'ACTIVE',
      stock: 50,
      trackInventory: true,
      lowStockAlert: 10,
      metaTitle: 'iPhone 14 Pro - Buy Now',
      metaDescription: 'Get the latest iPhone 14 Pro with amazing features',
      createdById: admin.id,
    },
  });

  const existingImages1 = await prisma.productImage.count({ where: { productId: product1.id } });
  if (existingImages1 === 0) {
    await prisma.productImage.createMany({
      data: [
        {
          productId: product1.id,
          url: '/images/iphone-14-pro-1.jpg',
          altText: 'iPhone 14 Pro front view',
          sortOrder: 1,
          isPrimary: true,
        },
        {
          productId: product1.id,
          url: '/images/iphone-14-pro-2.jpg',
          altText: 'iPhone 14 Pro back view',
          sortOrder: 2,
          isPrimary: false,
        },
      ],
    });
  }

  await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'TSH-BLK-M' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'TSH-BLK-M',
      name: 'Classic Black T-Shirt',
      slug: 'classic-black-tshirt',
      description: '100% cotton comfortable t-shirt',
      price: 29.99,
      comparePrice: 39.99,
      costPrice: 15.00,
      categoryId: clothingCategory.id,
      status: 'ACTIVE',
      stock: 100,
      trackInventory: true,
      lowStockAlert: 20,
      createdById: admin.id,
    },
  });

  console.log('✅ Created products');

  // Create customer
  const customer = await prisma.customer.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'john.doe@example.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      status: 'ACTIVE',
      type: 'REGULAR',
      totalOrders: 1,
      totalSpent: 1089.99,
      createdById: admin.id,
    },
  });

  let address = await prisma.customerAddress.findFirst({
    where: {
      customerId: customer.id,
      label: 'Home',
    },
  });

  if (!address) {
    address = await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        label: 'Home',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        address1: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        isDefault: true,
      },
    });
  }

  console.log('✅ Created customer and address');

  // Create sample order
  const orderNumber = `ORD-${Date.now()}`;
  const existingOrder = await prisma.order.findFirst({
    where: { tenantId: tenant.id, orderNumber },
  });

  let order;
  if (!existingOrder) {
    order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber,
        customerId: customer.id,
        addressId: address.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 999.99,
        tax: 80.00,
        shippingCost: 10.00,
        discount: 0,
        total: 1089.99,
        createdById: admin.id,
        items: {
          create: [
            {
              productId: product1.id,
              name: product1.name,
              sku: product1.sku,
              quantity: 1,
              price: 999.99,
              discount: 0,
              tax: 0,
              subtotal: 999.99,
              total: 999.99,
            },
          ],
        },
      },
    });
  } else {
    order = existingOrder;
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { orderId: order.id },
  });

  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'CARD',
        transactionId: 'txn_' + Date.now(),
        amount: 1089.99,
        status: 'PAID',
      },
    });
  }

  console.log('✅ Created sample order');

  // Create sample coupons
  await prisma.coupon.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'WELCOME10' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'WELCOME10',
      description: 'Descuento de bienvenida para nuevos clientes',
      type: 'PERCENTAGE',
      value: 10,
      scope: 'GLOBAL',
      autoApply: true,
      customerTypes: ['NEW'],
      isFirstPurchaseOnly: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      isActive: true,
      createdById: admin.id,
    },
  });

  await prisma.coupon.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'VIP15' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'VIP15',
      description: 'Descuento exclusivo para clientes VIP',
      type: 'PERCENTAGE',
      value: 15,
      scope: 'GLOBAL',
      autoApply: true,
      customerTypes: ['VIP'],
      minPurchase: 100,
      startDate: new Date(),
      isActive: true,
      createdById: admin.id,
    },
  });

  await prisma.coupon.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'IPHONE50' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'IPHONE50',
      description: '$50 de descuento en iPhones',
      type: 'FIXED',
      value: 50,
      scope: 'PRODUCT',
      productId: product1.id,
      autoApply: false,
      customerTypes: [],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      usageLimit: 100,
      isActive: true,
      createdById: admin.id,
    },
  });

  await prisma.coupon.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ELECTRONICS20' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'ELECTRONICS20',
      description: '20% de descuento en Electrónicos',
      type: 'PERCENTAGE',
      value: 20,
      scope: 'CATEGORY',
      categoryId: electronicsCategory.id,
      autoApply: false,
      customerTypes: [],
      minPurchase: 500,
      maxDiscount: 200,
      startDate: new Date(),
      isActive: true,
      createdById: admin.id,
    },
  });

  console.log('✅ Created sample coupons');

  // ============= Permissions & Roles =============
  console.log('🌱 Seeding permissions...');

  // Upsert all permissions
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        description: perm.description ?? null,
        module: perm.module,
        action: perm.action,
      },
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description ?? null,
        module: perm.module,
        action: perm.action,
      },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permByKey = new Map(allPermissions.map((p) => [p.key, p]));

  console.log(`✅ Seeded ${allPermissions.length} permissions`);

  // Helper to get permission IDs by keys
  function getPermIds(...keys: string[]): string[] {
    return keys
      .map((k) => permByKey.get(k)?.id)
      .filter((id): id is string => id !== undefined);
  }

  // Super Admin role — all permissions (tenant-scoped)
  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Super Admin' } },
    update: { description: 'Full access to everything', isSystem: true, color: '#ef4444' },
    create: {
      tenantId: tenant.id,
      name: 'Super Admin',
      description: 'Full access to everything',
      isSystem: true,
      color: '#ef4444',
    },
  });

  // Delete and recreate permissions for system roles to keep them in sync
  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  if (allPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Created/updated Super Admin role');

  // Admin role — all except roles:delete and users:delete
  const adminExcluded = new Set(['roles:delete', 'users:delete']);
  const adminPermIds = allPermissions
    .filter((p) => !adminExcluded.has(p.key))
    .map((p) => p.id);

  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
    update: { description: 'Administration access', isSystem: true, color: '#f97316' },
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Administration access',
      isSystem: true,
      color: '#f97316',
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  if (adminPermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: adminPermIds.map((permissionId) => ({ roleId: adminRole.id, permissionId })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Created/updated Admin role');

  // Gerente role — management subset
  const gerentePermKeys = [
    'dashboard:view',
    'pos:access', 'pos.cash:open', 'pos.cash:close',
    'products:view', 'products:create', 'products:edit',
    'categories:view', 'categories:create', 'categories:edit',
    'orders:view', 'orders:create', 'orders:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'coupons:view', 'coupons:create', 'coupons:edit',
    'cash:view', 'cash:manage',
    'users:view',
    'roles:view',
    'reports:view',
    'settings:view',
    'work-orders:view', 'work-orders:create', 'work-orders:edit', 'work-orders:assign',
  ];
  const gerentePermIds = getPermIds(...gerentePermKeys);

  const gerenteRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Gerente' } },
    update: { description: 'Store manager', isSystem: false, color: '#8b5cf6' },
    create: {
      tenantId: tenant.id,
      name: 'Gerente',
      description: 'Store manager',
      isSystem: false,
      color: '#8b5cf6',
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: gerenteRole.id } });
  if (gerentePermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: gerentePermIds.map((permissionId) => ({ roleId: gerenteRole.id, permissionId })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Created/updated Gerente role');

  // Vendedor role — small subset for POS/sales staff
  const vendedorPermKeys = [
    'pos:access', 'pos.cash:open',
    'products:view',
    'orders:view', 'orders:create',
    'customers:view', 'customers:create',
    'cash:view',
  ];
  const vendedorPermIds = getPermIds(...vendedorPermKeys);

  const vendedorRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Vendedor' } },
    update: { description: 'Sales staff', isSystem: false, color: '#10b981' },
    create: {
      tenantId: tenant.id,
      name: 'Vendedor',
      description: 'Sales staff',
      isSystem: false,
      color: '#10b981',
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: vendedorRole.id } });
  if (vendedorPermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: vendedorPermIds.map((permissionId) => ({ roleId: vendedorRole.id, permissionId })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Created/updated Vendedor role');

  // ============= PLUS tenant: multi-branch example =============
  const tenantPlus = await prisma.tenant.upsert({
    where: { slug: 'fashion-plus' },
    update: { plan: 'PLUS' },
    create: {
      name: 'Fashion Plus',
      slug: 'fashion-plus',
      status: 'ACTIVE',
      plan: 'PLUS',
    },
  });
  console.log('✅ Created PLUS tenant:', tenantPlus.slug);

  const plusOwnerPw = await bcrypt.hash('plus123', 10);
  const plusOwner = await prisma.user.upsert({
    where: { email: 'owner@fashion-plus.com' },
    update: {},
    create: {
      email: 'owner@fashion-plus.com',
      password: plusOwnerPw,
      firstName: 'Carlos',
      lastName: 'Ramírez',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenantPlus.id, userId: plusOwner.id } },
    update: {},
    create: { tenantId: tenantPlus.id, userId: plusOwner.id, role: 'OWNER' },
  });
  console.log('✅ Created PLUS owner:', plusOwner.email);

  // Products for PLUS tenant (clone of default products, different SKUs)
  const plusProduct1 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenantPlus.id, sku: 'FP-TSH-BLK-M' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      sku: 'FP-TSH-BLK-M',
      name: 'Camiseta Negra Clásica',
      slug: 'camiseta-negra-clasica',
      description: 'Camiseta 100% algodón',
      price: 299.00,
      costPrice: 120.00,
      status: 'ACTIVE',
      stock: 300,
      trackInventory: true,
      lowStockAlert: 20,
      createdById: plusOwner.id,
    },
  });

  const plusProduct2 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenantPlus.id, sku: 'FP-JNS-BLU-32' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      sku: 'FP-JNS-BLU-32',
      name: 'Jeans Azul Slim Fit 32',
      slug: 'jeans-azul-slim-fit-32',
      description: 'Jeans slim fit color azul',
      price: 599.00,
      costPrice: 250.00,
      status: 'ACTIVE',
      stock: 200,
      trackInventory: true,
      lowStockAlert: 15,
      createdById: plusOwner.id,
    },
  });

  const plusProduct3 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenantPlus.id, sku: 'FP-HOD-GRY-L' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      sku: 'FP-HOD-GRY-L',
      name: 'Sudadera Gris L',
      slug: 'sudadera-gris-l',
      description: 'Sudadera con capucha talla L',
      price: 449.00,
      costPrice: 180.00,
      status: 'ACTIVE',
      stock: 150,
      trackInventory: true,
      lowStockAlert: 10,
      createdById: plusOwner.id,
    },
  });

  console.log('✅ Created products for PLUS tenant');

  // 3 branches for PLUS tenant
  const branchCentro = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenantPlus.id, code: 'FP-CENTRO' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      name: 'Sucursal Centro',
      code: 'FP-CENTRO',
      address: 'Av. Juárez 45',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '06010',
      phone: '+52 55 1234 0001',
      isMain: true,
      status: 'ACTIVE',
    },
  });

  const branchNorte = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenantPlus.id, code: 'FP-NORTE' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      name: 'Sucursal Norte',
      code: 'FP-NORTE',
      address: 'Blvd. Insurgentes Norte 890',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '07010',
      phone: '+52 55 1234 0002',
      isMain: false,
      status: 'ACTIVE',
    },
  });

  const branchSur = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenantPlus.id, code: 'FP-SUR' } },
    update: {},
    create: {
      tenantId: tenantPlus.id,
      name: 'Sucursal Sur',
      code: 'FP-SUR',
      address: 'Calz. de Tlalpan 2000',
      city: 'Ciudad de México',
      state: 'CDMX',
      zipCode: '14000',
      phone: '+52 55 1234 0003',
      isMain: false,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created 3 branches for PLUS tenant');

  // Branch inventory — different stock per branch per product
  const branchInventoryData = [
    // Centro (main)
    { branchId: branchCentro.id, productId: plusProduct1.id, stock: 80 },
    { branchId: branchCentro.id, productId: plusProduct2.id, stock: 60 },
    { branchId: branchCentro.id, productId: plusProduct3.id, stock: 45 },
    // Norte
    { branchId: branchNorte.id, productId: plusProduct1.id, stock: 50 },
    { branchId: branchNorte.id, productId: plusProduct2.id, stock: 35 },
    { branchId: branchNorte.id, productId: plusProduct3.id, stock: 8 }, // low stock
    // Sur
    { branchId: branchSur.id, productId: plusProduct1.id, stock: 30 },
    { branchId: branchSur.id, productId: plusProduct2.id, stock: 0 }, // out of stock
    { branchId: branchSur.id, productId: plusProduct3.id, stock: 25 },
  ];

  for (const inv of branchInventoryData) {
    await prisma.branchInventory.upsert({
      where: { branchId_productId: { branchId: inv.branchId, productId: inv.productId } },
      update: { stock: inv.stock },
      create: inv,
    });
  }

  console.log('✅ Created branch inventory for PLUS tenant (9 records across 3 branches)');

  // Link plusOwner to the main branch
  await prisma.branchMembership.upsert({
    where: { branchId_userId: { branchId: branchCentro.id, userId: plusOwner.id } },
    update: {},
    create: { branchId: branchCentro.id, userId: plusOwner.id, isPrimary: true },
  });
  console.log('✅ Linked plusOwner to Sucursal Centro');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
