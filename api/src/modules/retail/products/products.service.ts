import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { BusinessConfigurationService } from '../../../common/business-config/business-configuration.service';
import { InventoryEngine } from '../inventory/inventory.engine';
import { R2Service } from '../../../storage/r2.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Product, Prisma } from '@prisma/client';
import { AiUsageRecorder } from '../../../ai/usage/ai-usage.recorder';

const MAX_IMAGE_WIDTH = 1200;

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  recipe: {
    include: {
      items: {
        include: {
          supply: { include: { inventoryUnit: true, baseUnit: true } },
        },
      },
    },
  },
  comboItems: { include: { child: true } },
  // La default primero: es la línea "el producto en sí" y encabeza la lista.
  variants: { orderBy: [{ isDefault: 'desc' as const }, { name: 'asc' as const }] },
  // Existencias por sucursal y variante — la fuente de verdad del stock.
  branchInventory: {
    select: { branchId: true, variantId: true, stock: true, price: true, cost: true, lowStockAlert: true },
  },
  features: true,
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private audit: AuditService,
    private r2: R2Service,
    // BR-02: recipes are a Restaurant-only capability. Availability is decided
    // exclusively through the business configuration facade — the service never
    // reads BusinessProfile. Combos and SIMPLE/SERVICE products are unaffected.
    private businessConfig: BusinessConfigurationService,
    // Fase 2A: la escritura de stock y el asiento de movimiento se delegan al
    // motor de inventario de bajo nivel. Las validaciones de negocio (tipo
    // SIMPLE, trackInventory, guard de stock) permanecen en este servicio.
    private inventoryEngine: InventoryEngine,
    // Fase 3 (AI Product Assistant): registra el desenlace de un draft de IA
    // cuando el producto que se crea vino de uno — ver `aiRequestId` en el DTO.
    // Nunca decide qué se crea, y su fallo nunca debe tumbar la creación.
    private aiUsageRecorder: AiUsageRecorder,
  ) {}

  private readonly logger = new Logger(ProductsService.name);

  /**
   * BR-02: gate recipe capabilities behind the `enableRecipes` feature. Throws
   * when the tenant's business configuration does not support recipes (e.g.
   * RETAIL). Restaurant (feature on) is unaffected. Only recipe entry points
   * call this — no sale/inventory/combo flow goes through here.
   */
  private async assertRecipesEnabled(): Promise<void> {
    if (!(await this.businessConfig.hasFeature('enableRecipes'))) {
      throw new ForbiddenException(
        'Las recetas no están disponibles para este tipo de negocio',
      );
    }
  }

  private async resolveNormalizedQty(
    db: any,
    item: { supplyId: string; quantity: number; unitId?: string | null },
  ): Promise<number | null> {
    if (!item.unitId) return null;

    const supply = await db.supply.findUnique({
      where: { id: item.supplyId },
      select: { inventoryUnitId: true, baseUnitId: true, conversionFactor: true },
    });

    if (!supply) return null;

    const convFactor = Number(supply.conversionFactor ?? 1) || 1;

    if (item.unitId === supply.inventoryUnitId) {
      return item.quantity * convFactor;
    }
    if (item.unitId === supply.baseUnitId) {
      return item.quantity;
    }

    // Legacy: supplyAllowedUnit lookup
    const [allowed, unit] = await Promise.all([
      db.supplyAllowedUnit.findUnique({
        where: { supplyId_unitId: { supplyId: item.supplyId, unitId: item.unitId } },
      }),
      db.measurementUnit.findUnique({ where: { id: item.unitId } }),
    ]);
    const factor = allowed ? Number(allowed.conversionFactor) : (unit ? Number(unit.baseFactor) : 1);
    return item.quantity * factor;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const { recipeItems, comboItems, variants, features, aiRequestId, aiOutcome, ...productData } = createProductDto;

    const existingProduct = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: productData.sku } },
    });

    if (existingProduct) {
      throw new ConflictException('SKU already exists');
    }

    if (productData.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: productData.categoryId, tenantId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const existingSlugs = await this.prisma.product.findMany({
      where: { tenantId },
      select: { slug: true },
    });

    const slug = SlugUtil.generateUnique(
      productData.name,
      existingSlugs.map((p) => p.slug),
    );

    // RECIPE/COMBO/SERVICE don't track product stock
    const type = productData.type ?? 'SIMPLE';
    // BR-02: only RECIPE products require the recipes capability. COMBO and
    // SERVICE remain available on every vertical (combos stay independent).
    if (type === 'RECIPE') await this.assertRecipesEnabled();
    if (type !== 'SIMPLE') {
      productData.trackInventory = false;
      productData.stock = 0;
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...productData, type, tenantId, slug },
        include: PRODUCT_INCLUDE,
      });

      // Toda alta necesita su variante default — la línea implícita "el producto
      // en sí", que es la que lleva el inventario — y una fila de existencias por
      // cada sucursal activa. Sin esas filas el producto nacería invendible.
      const defaultVariant = await tx.productVariant.create({
        data: {
          productId: created.id,
          name: null,
          isDefault: true,
          trackInventory: created.trackInventory,
          cost: created.costPrice ?? 0,
          price: created.price,
        },
        select: { id: true },
      });
      await this.seedBranchInventory(tx, tenantId, created, [defaultVariant.id]);

      let needsRefetch = true;

      if (type === 'RECIPE' && recipeItems?.length) {
        const normalizedItems = await Promise.all(
          recipeItems.map(async (i) => ({
            supplyId: i.supplyId,
            quantity: i.quantity,
            unit: i.unit,
            unitId: i.unitId ?? null,
            normalizedQuantity: await this.resolveNormalizedQty(tx, i),
          })),
        );
        await tx.recipe.create({
          data: {
            productId: created.id,
            items: { create: normalizedItems },
          },
        });
        needsRefetch = true;
      }

      if (type === 'COMBO' && comboItems?.length) {
        await tx.comboItem.createMany({
          data: comboItems.map((ci) => ({
            comboProductId: created.id,
            childProductId: ci.childProductId,
            quantity: ci.quantity ?? 1,
          })),
        });
        needsRefetch = true;
      }

      if (variants?.length) {
        await tx.productVariant.createMany({
          data: variants.map((v) => ({
            productId: created.id,
            name: v.name,
            cost: v.cost ?? 0,
            price: v.price ?? 0,
          })),
        });
        // Las variantes con nombre también necesitan existencias propias por
        // sucursal, o quedarían sin precio ni stock donde se vendan.
        const named = await tx.productVariant.findMany({
          where: { productId: created.id, isDefault: false },
          select: { id: true },
        });
        await this.seedBranchInventory(
          tx,
          tenantId,
          created,
          named.map((v) => v.id),
          0,
        );
      }

      if (features?.length) {
        await tx.productFeature.createMany({
          data: features.map((f) => ({
            productId: created.id,
            feature: f.feature,
            value: f.value,
          })),
        });
        needsRefetch = true;
      }

      return needsRefetch
        ? (tx.product.findUnique({ where: { id: created.id }, include: PRODUCT_INCLUDE }) as Promise<Product>)
        : created;
    });

    if (aiRequestId) {
      // Efecto secundario, no crítico: si falla, el producto ya se creó y
      // eso es lo que importa. Nunca debe tumbar la respuesta al usuario.
      this.aiUsageRecorder.recordOutcome(aiRequestId, aiOutcome ?? 'ACCEPTED').catch((err: unknown) => {
        this.logger.warn(
          `No se pudo registrar el outcome del draft de IA ${aiRequestId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return product;
  }

  /**
   * Adjunta a cada variante su existencia y sus valores comerciales efectivos.
   *
   * El stock vive en `branch_inventory` por (sucursal, variante), pero la UI
   * muestra un número por variante: se usa el de la sucursal del contexto y, si
   * no hay ninguna seleccionada, la suma de todas — que es lo que el usuario
   * entiende por "cuánto tengo".
   *
   * `stockByBranch` se incluye para que la UI pueda desglosar sin otra llamada.
   */
  private attachVariantStock(product: ProductWithRelations, branchId: string | null) {
    const { branchInventory, variants, ...rest } = product;
    // Defensivo: hay lecturas que proyectan el producto sin estas relaciones.
    const allRows = branchInventory ?? [];

    const enrichedVariants = (variants ?? []).map((variant) => {
      const rows = allRows.filter((row) => row.variantId === variant.id);
      const scoped = branchId ? rows.filter((row) => row.branchId === branchId) : rows;
      const source = scoped[0];

      return {
        ...variant,
        stock: scoped.reduce((total, row) => total + row.stock, 0),
        // Precio y costo efectivos: los de la sucursal en contexto, con respaldo
        // en los valores legacy de la variante mientras dure la fase expand.
        price: source?.price ?? variant.price,
        cost: source?.cost ?? variant.cost,
        lowStockAlert: source?.lowStockAlert ?? null,
        stockByBranch: rows.map((row) => ({ branchId: row.branchId, stock: row.stock })),
      };
    });

    return {
      ...rest,
      variants: enrichedVariants,
      // `stock` a nivel producto = suma de sus variantes, para no romper las
      // pantallas que todavía leen un escalar.
      //
      // Sin ninguna fila de inventario se conserva el valor legacy del producto:
      // los tenants que aún no tienen sucursales no tienen dónde guardar
      // existencias por variante, y devolver 0 ocultaría su stock real.
      stock: allRows.length
        ? enrichedVariants.reduce((total, variant) => total + variant.stock, 0)
        : rest.stock,
    };
  }

  /**
   * Crea la fila de existencias de cada variante en todas las sucursales activas
   * del tenant, copiando los valores comerciales del producto. `stockOverride`
   * permite arrancar en 0 las variantes con nombre: el stock capturado en el alta
   * pertenece a la variante default, no se replica en cada una.
   *
   * `skipDuplicates` la hace idempotente, de modo que volver a sembrar una
   * variante existente no rompe.
   */
  private async seedBranchInventory(
    tx: Prisma.TransactionClient,
    tenantId: string,
    product: Product,
    variantIds: string[],
    stockOverride?: number,
  ): Promise<void> {
    if (variantIds.length === 0) return;

    const branches = await tx.branch.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (branches.length === 0) return;

    await tx.branchInventory.createMany({
      data: branches.flatMap((branch) =>
        variantIds.map((variantId) => ({
          branchId: branch.id,
          productId: product.id,
          variantId,
          stock: stockOverride ?? product.stock,
          cost: product.costPrice,
          price: product.price,
          comparePrice: product.comparePrice,
          lastCost: product.lastCost,
          avgCost: product.avgCost,
          lowStockAlert: product.lowStockAlert,
        })),
      ),
      skipDuplicates: true,
    });
  }

  async findAll(queryDto: QueryProductDto): Promise<PaginatedResponse<Product>> {
    const { skip, limit, page, search, categoryId, status, type } = queryDto;
    const tenantId = this.tenantContext.requireTenantId();
    const where: Prisma.ProductWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    const branchId = this.tenantContext.getBranchId() ?? null;

    return {
      data: products.map((product) => this.attachVariantStock(product, branchId)) as Product[],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: PRODUCT_INCLUDE,
    });

    if (!product) throw new NotFoundException('Product not found');
    return this.attachVariantStock(product, this.tenantContext.getBranchId() ?? null) as Product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });

    if (!product) throw new NotFoundException('Product not found');

    const { recipeItems, comboItems, variants, features, ...productData } = updateProductDto;

    if (productData.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: productData.categoryId },
      });

      if (!category) throw new NotFoundException('Category not found');
    }

    let slug = product.slug;
    if (productData.name && productData.name !== product.name) {
      const existingSlugs = await this.prisma.product.findMany({
        where: { tenantId, id: { not: id } },
        select: { slug: true },
      });

      slug = SlugUtil.generateUnique(
        productData.name,
        existingSlugs.map((p) => p.slug),
      );
    }

    const newType = productData.type ?? product.type;
    if (newType !== 'SIMPLE') {
      productData.trackInventory = false;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { ...productData, slug },
        include: PRODUCT_INCLUDE,
      });

      // Sync recipe items
      if (newType === 'RECIPE' && recipeItems !== undefined) {
        const existingRecipe = await tx.recipe.findUnique({ where: { productId: id } });
        if (existingRecipe) {
          await tx.recipeItem.deleteMany({ where: { recipeId: existingRecipe.id } });
          if (recipeItems.length > 0) {
            const normalizedItems = await Promise.all(
              recipeItems.map(async (i) => ({
                recipeId: existingRecipe.id,
                supplyId: i.supplyId,
                quantity: i.quantity,
                unit: i.unit,
                unitId: i.unitId ?? null,
                normalizedQuantity: await this.resolveNormalizedQty(tx, i),
              })),
            );
            await tx.recipeItem.createMany({ data: normalizedItems });
          }
        } else if (recipeItems.length > 0) {
          const normalizedItems = await Promise.all(
            recipeItems.map(async (i) => ({
              supplyId: i.supplyId,
              quantity: i.quantity,
              unit: i.unit,
              unitId: i.unitId ?? null,
              normalizedQuantity: await this.resolveNormalizedQty(tx, i),
            })),
          );
          await tx.recipe.create({
            data: {
              productId: id,
              items: { create: normalizedItems },
            },
          });
        }
      }

      // Sync combo items
      if (newType === 'COMBO' && comboItems !== undefined) {
        await tx.comboItem.deleteMany({ where: { comboProductId: id } });
        if (comboItems.length > 0) {
          await tx.comboItem.createMany({
            data: comboItems.map((ci) => ({
              comboProductId: id,
              childProductId: ci.childProductId,
              quantity: ci.quantity ?? 1,
            })),
          });
        }
      }

      // Sincronización de variantes por id, NO reemplazo completo.
      //
      // `branch_inventory` cuelga de `variantId` con borrado en cascada: un
      // deleteMany aquí se llevaría por delante las existencias de todas las
      // sucursales cada vez que alguien guarda el producto. Se conserva la
      // variante default (nunca llega en el DTO — es interna) y las que traen id.
      if (variants !== undefined) {
        const existing = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true, isDefault: true },
        });
        const keepIds = new Set(
          existing.filter((v) => v.isDefault).map((v) => v.id),
        );

        for (const variant of variants) {
          if (variant.id && existing.some((v) => v.id === variant.id)) {
            keepIds.add(variant.id);
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { name: variant.name, cost: variant.cost ?? 0, price: variant.price ?? 0 },
            });
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                name: variant.name,
                cost: variant.cost ?? 0,
                price: variant.price ?? 0,
              },
              select: { id: true },
            });
            keepIds.add(created.id);
            await this.seedBranchInventory(tx, tenantId, product, [created.id], variant.stock ?? 0);
          }
        }

        // Solo se eliminan las que el usuario realmente quitó.
        const removed = existing.filter((v) => !keepIds.has(v.id)).map((v) => v.id);
        if (removed.length > 0) {
          await tx.productVariant.deleteMany({ where: { id: { in: removed } } });
        }
      }

      // Sync features (full replace — optional spec sheet)
      if (features !== undefined) {
        await tx.productFeature.deleteMany({ where: { productId: id } });
        if (features.length > 0) {
          await tx.productFeature.createMany({
            data: features.map((f) => ({
              productId: id,
              feature: f.feature,
              value: f.value,
            })),
          });
        }
      }

      return tx.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE }) as Promise<Product>;
    });

    if (
      productData.price != null &&
      Number(productData.price) !== Number(product.price)
    ) {
      await this.audit.log({
        action: 'PRICE_CHANGE',
        entityType: 'Product',
        entityId: id,
        before: { price: Number(product.price) },
        after: { price: Number(productData.price) },
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { orderItems: true, images: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.orderItems.length > 0) {
      throw new BadRequestException('Cannot delete product with existing orders');
    }

    await Promise.all(
      product.images.flatMap((img) =>
        img.key ? [this.r2.delete(img.key)] : [],
      ),
    );

    await this.prisma.product.delete({ where: { id } });
  }

  async uploadImage(productId: string, file: Express.Multer.File) {
    const tenantId = this.tenantContext.requireTenantId();

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { images: { where: { isPrimary: true } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    const webpBuffer = await sharp(file.buffer)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const imageId = randomUUID();
    const key = this.r2.buildKey(tenantId, productId, imageId);
    const url = await this.r2.upload(key, webpBuffer, 'image/webp');

    const oldPrimary = product.images?.[0];

    return this.prisma.$transaction(async (tx) => {
      if (oldPrimary) {
        await tx.productImage.delete({ where: { id: oldPrimary.id } });
      }

      const image = await tx.productImage.create({
        data: {
          id: imageId,
          productId,
          url,
          key,
          mimeType: 'image/webp',
          size: webpBuffer.length,
          isPrimary: true,
          sortOrder: 0,
        },
      });

      if (oldPrimary?.key) {
        await this.r2.delete(oldPrimary.key);
      }

      return image;
    });
  }

  async removeImage(productId: string, imageId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { tenantId } },
    });

    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.key) {
      await this.r2.delete(image.key);
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });

    if (!product) throw new NotFoundException('Product not found');

    if (product.type !== 'SIMPLE') {
      throw new BadRequestException('Solo productos SIMPLE manejan stock directo');
    }

    if (!product.trackInventory) {
      throw new BadRequestException('Product does not track inventory');
    }

    const branchId = this.tenantContext.getBranchId() ?? null;

    // Flujo de ajuste oficial: la baja/alta de stock y su movimiento AJUSTE van
    // juntos en una transacción, delegados al InventoryEngine.
    //
    // El guard de existencia lo aplica la base DENTRO de la transacción. Antes se
    // validaba en JS con un stock leído fuera de ella, lo que dejaba una ventana
    // TOCTOU: una venta concurrente entre la lectura y la escritura podía dejar
    // el stock en negativo.
    const updated = await this.prisma.$transaction(async (tx) => {
      const applied = await this.inventoryEngine.applyProductStockDelta(tx, {
        productId: id,
        delta: quantity,
        guardInsufficient: quantity < 0,
        branchId,
      });
      if (!applied) throw new BadRequestException('Insufficient stock');

      if (quantity !== 0) {
        await this.inventoryEngine.recordProductMovement(tx, {
          tenantId,
          type: 'AJUSTE',
          productId: id,
          quantity,
          referenceId: id,
          referenceType: 'PRODUCT_ADJUST',
          notes: `Ajuste manual (${quantity >= 0 ? '+' : ''}${quantity})`,
        });
      }
      return tx.product.findFirstOrThrow({ where: { id, tenantId } });
    });

    await this.audit.log({
      action: 'INVENTORY_ADJUST',
      entityType: 'Product',
      entityId: id,
      before: { stock: product.stock },
      after: { stock: updated.stock },
      reason: `Ajuste manual (${quantity >= 0 ? '+' : ''}${quantity})`,
    });

    return updated;
  }

  /**
   * Productos bajo su punto de reorden. La comparación stock ≤ mínimo ahora vive
   * entera en `branch_inventory` (antes cruzaba dos columnas de `products` con un
   * field reference), y se acota a la sucursal del contexto cuando la hay.
   *
   * Devuelve forma de producto, con `stock`/`lowStockAlert` tomados de la fila de
   * la sucursal, para no romper el contrato del endpoint.
   */
  async getLowStock(limit = 10) {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const rows = await this.prisma.branchInventory.findMany({
      where: {
        ...(branchId ? { branchId } : { branch: { tenantId } }),
        stock: { lte: this.prisma.branchInventory.fields.lowStockAlert },
        variant: { trackInventory: true },
        product: { tenantId, type: 'SIMPLE', status: 'ACTIVE' },
      },
      take: limit,
      orderBy: { stock: 'asc' },
      include: { product: { include: { category: true } } },
    });

    return rows.map((row) => ({
      ...row.product,
      stock: row.stock,
      lowStockAlert: row.lowStockAlert,
    }));
  }

  async getRecipe(productId: string) {
    await this.assertRecipesEnabled();
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'RECIPE' },
    });
    if (!product) throw new NotFoundException('Producto tipo RECIPE no encontrado');

    return this.prisma.recipe.findUnique({
      where: { productId },
      include: { items: { include: { supply: true } } },
    });
  }

  async upsertRecipe(
    productId: string,
    items: Array<{ supplyId: string; quantity: number; unit: string; unitId?: string }>,
    notes?: string,
  ) {
    await this.assertRecipesEnabled();
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'RECIPE' },
    });
    if (!product) throw new NotFoundException('Producto tipo RECIPE no encontrado');

    const normalizedItems = await Promise.all(
      items.map(async (i) => ({
        supplyId: i.supplyId,
        quantity: i.quantity,
        unit: i.unit,
        unitId: i.unitId ?? null,
        normalizedQuantity: await this.resolveNormalizedQty(this.prisma, i),
      })),
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({ where: { productId } });
      if (existing) {
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipe.update({
          where: { id: existing.id },
          data: {
            notes: notes ?? existing.notes,
            items: { create: normalizedItems },
          },
        });
      } else {
        await tx.recipe.create({
          data: { productId, notes, items: { create: normalizedItems } },
        });
      }

      return tx.recipe.findUnique({
        where: { productId },
        include: { items: { include: { supply: true, measurementUnit: true } } },
      });
    });
  }

  async getComboItems(productId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'COMBO' },
    });
    if (!product) throw new NotFoundException('Producto tipo COMBO no encontrado');

    return this.prisma.comboItem.findMany({
      where: { comboProductId: productId },
      include: { child: { include: { images: true } } },
    });
  }

  async upsertComboItems(productId: string, items: Array<{ childProductId: string; quantity: number }>) {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'COMBO' },
    });
    if (!product) throw new NotFoundException('Producto tipo COMBO no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await tx.comboItem.deleteMany({ where: { comboProductId: productId } });
      if (items.length > 0) {
        await tx.comboItem.createMany({
          data: items.map((i) => ({
            comboProductId: productId,
            childProductId: i.childProductId,
            quantity: i.quantity,
          })),
        });
      }
      return tx.comboItem.findMany({
        where: { comboProductId: productId },
        include: { child: { include: { images: true } } },
      });
    });
  }
}
