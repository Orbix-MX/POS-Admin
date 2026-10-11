import type {
  CategoryDto,
  CodeMatch,
  CreateCategoryRequest,
  CreateProductRequest,
  PaginatedDto,
  ProductDto,
  ProductImageDto,
  ProductVariantDto,
  ResolvedCodeDto,
  UpdateProductRequest,
} from '@/dto/products.dto';
import { http } from '@/services/api';

export interface ProductImage {
  id: string;
  /** URL pública absoluta en R2 (Cloudflare); se usa tal cual como `source`. */
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

/** Lo que `expo-image-picker` devuelve, reducido a lo que necesita el multipart. */
export interface ImageAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/**
 * Variante con nombre del producto. Precio, costo y existencia son los de la
 * **sucursal en contexto** — ver `ProductVariantDto`.
 *
 * La variante default (`isDefault`) no llega hasta aquí: `toDomain` la filtra,
 * porque es la línea interna "el producto en sí" y la UI no la trata como una
 * presentación más.
 */
export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  cost: number;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  costPrice: number | null;
  type: ProductDto['type'];
  categoryId: string | null;
  categoryName: string | null;
  status: ProductDto['status'];
  stock: number;
  trackInventory: boolean;
  lowStockAlert: number;
  taxRate: number | null;
  taxCode: ProductDto['taxCode'];
  isEcommerce: boolean;
  images: ProductImage[];
  /**
   * La imagen a pintar, ya resuelta: la primaria si existe, la primera si no.
   * Se decide aquí —igual que en el web (`images.find(isPrimary) ?? images[0]`)—
   * para que la lista, el detalle y la retícula del POS no repitan la regla.
   * `null` cuando el producto no tiene ninguna: quien la use pinta su marcador.
   */
  primaryImage: ProductImage | null;
  /** Solo las que tienen nombre; vacío si el producto nunca se dividió. */
  variants: ProductVariant[];
  createdAt: string;
}

/**
 * Un escaneo resuelto. `product` ya viene con el precio y la existencia de la
 * sucursal en contexto, así que quien lo reciba puede cobrarlo sin otra
 * consulta.
 */
export interface ResolvedCode {
  product: Product;
  variantId: string | null;
  matchedBy: CodeMatch;
  alternatives: ResolvedCodeDto['alternatives'];
}

export interface ProductListResult {
  products: Product[];
  meta: PaginatedDto<ProductDto>['meta'];
}

export interface ProductListParams {
  search?: string;
  categoryId?: string;
  status?: ProductDto['status'];
  type?: ProductDto['type'];
  page?: number;
  limit?: number;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toImage(dto: ProductImageDto): ProductImage {
  return {
    id: dto.id,
    url: dto.url,
    altText: dto.altText ?? null,
    isPrimary: dto.isPrimary,
    sortOrder: dto.sortOrder,
  };
}

/**
 * Misma regla que el web (`images.find(isPrimary) ?? images[0]`). Exportada
 * porque las mutaciones de imagen la reaplican al parchear la caché — si la
 * regla viviera solo en `toDomain`, un producto recién editado y el mismo
 * producto recién traído del API podrían mostrar imágenes distintas.
 */
export function resolvePrimaryImage(images: ProductImage[]): ProductImage | null {
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

function toVariant(dto: ProductVariantDto): ProductVariant {
  return {
    id: dto.id,
    name: dto.name ?? '',
    // `''` y no `null`: el formulario los edita como texto.
    sku: dto.sku ?? '',
    barcode: dto.barcode ?? '',
    cost: toNumber(dto.cost) ?? 0,
    price: toNumber(dto.price) ?? 0,
    stock: dto.stock,
  };
}

function toDomain(dto: ProductDto): Product {
  const images = (dto.images ?? []).map(toImage);
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    slug: dto.slug,
    description: dto.description ?? '',
    price: toNumber(dto.price) ?? 0,
    comparePrice: toNumber(dto.comparePrice),
    costPrice: toNumber(dto.costPrice),
    type: dto.type,
    categoryId: dto.categoryId,
    categoryName: dto.category?.name ?? null,
    status: dto.status,
    stock: dto.stock,
    trackInventory: dto.trackInventory,
    lowStockAlert: dto.lowStockAlert,
    taxRate: toNumber(dto.taxRate),
    taxCode: dto.taxCode,
    isEcommerce: dto.isEcommerce,
    images,
    primaryImage: resolvePrimaryImage(images),
    // La default se descarta: es interna y la UI nunca la edita ni la reenvía.
    variants: (dto.variants ?? []).filter((variant) => !variant.isDefault).map(toVariant),
    createdAt: dto.createdAt,
  };
}

export const productsRepository = {
  async list(params: ProductListParams): Promise<ProductListResult> {
    const dto = await http.get<PaginatedDto<ProductDto>>('/products', { params });
    return { products: dto.data.map(toDomain), meta: dto.meta };
  },

  async getById(id: string): Promise<Product> {
    const dto = await http.get<ProductDto>(`/products/${id}`);
    return toDomain(dto);
  },

  /**
   * `GET /products/resolve?code=` — un escaneo a un artículo.
   *
   * No es `list({ search })`: la búsqueda de texto mira nombre, SKU y
   * descripción, y **no cubre el código de barras**, que vive en la variante.
   * Un código leído por la cámara no encontraría nada por esa vía.
   *
   * Lanza `ApiError` con 404 cuando el código no existe en la empresa — que es
   * el caso que abre "crear producto con este código", no un error a tapar.
   */
  async resolveCode(code: string): Promise<ResolvedCode> {
    const dto = await http.get<ResolvedCodeDto>('/products/resolve', { params: { code } });
    return {
      product: toDomain(dto.product),
      variantId: dto.variantId,
      matchedBy: dto.matchedBy,
      alternatives: dto.alternatives,
    };
  },

  async create(request: CreateProductRequest): Promise<Product> {
    const dto = await http.post<ProductDto>('/products', request);
    return toDomain(dto);
  },

  async update(id: string, request: UpdateProductRequest): Promise<Product> {
    const dto = await http.patch<ProductDto>(`/products/${id}`, request);
    return toDomain(dto);
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/products/${id}`);
  },

  /**
   * `PATCH /products/:id/stock` — ajusta la existencia del producto "sin
   * variante" (la default) en la sucursal del token.
   *
   * `quantity` es un **delta con signo**, no la existencia final: `10` suma
   * diez. El servidor deja su `InventoryMovement` de tipo `AJUSTE` y rechaza la
   * salida si no hay suficiente, comprobándolo dentro de la transacción para
   * que una venta concurrente no cuele el stock en negativo.
   *
   * Solo productos `SIMPLE` con `trackInventory`.
   */
  async adjustStock(id: string, quantity: number): Promise<Product> {
    const dto = await http.patch<ProductDto>(`/products/${id}/stock`, { quantity });
    return toDomain(dto);
  },

  /**
   * `PATCH /products/:id/variants/:variantId/stock` — mismo delta, sobre una
   * presentación concreta. Es la única forma de mover la existencia de una
   * variante con nombre después de crearla.
   */
  async adjustVariantStock(id: string, variantId: string, quantity: number): Promise<Product> {
    const dto = await http.patch<ProductDto>(`/products/${id}/variants/${variantId}/stock`, {
      quantity,
    });
    return toDomain(dto);
  },

  /**
   * `POST /products/:id/image` — multipart, campo `file`, igual que el logo del
   * tenant: `FormData` de RN acepta un `{ uri, name, type }` en lugar de un
   * `Blob` y el adaptador de axios lo transmite desde disco.
   *
   * El servidor reescribe la imagen a WebP (max 1200 px de ancho) antes de
   * subirla a R2, **reemplaza** la primaria anterior —borrando su objeto del
   * bucket— y devuelve solo la imagen creada, no el producto. De ahí que quien
   * llame tenga que refrescar el producto para verla reflejada.
   */
  async uploadImage(productId: string, asset: ImageAsset): Promise<ProductImage> {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'product.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    const dto = await http.post<ProductImageDto>(`/products/${productId}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return toImage(dto);
  },

  async removeImage(productId: string, imageId: string): Promise<void> {
    await http.delete(`/products/${productId}/images/${imageId}`);
  },
} as const;

export const categoriesRepository = {
  async list(): Promise<CategoryDto[]> {
    return http.get<CategoryDto[]>('/categories');
  },

  async create(request: CreateCategoryRequest): Promise<CategoryDto> {
    return http.post<CategoryDto>('/categories', request);
  },
} as const;
