import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, MaxLength, ValidateIf, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { DiningServiceType, DiningOrderStatus } from '@prisma/client';

/**
 * Intención de visibilidad del solicitante de GET /dining-orders. Hace EXPLÍCITO
 * quién pregunta para que `restaurantVisibilityMode` (futuro) pueda restringir a
 * los operadores sin tocar a la caja:
 *  - 'all'  → caja: SIEMPRE todas las cuentas activas (cobra cualquiera).
 *  - 'own'  → comanda/operador: respetará la visibilidad futura (p. ej. OWN_ONLY
 *             filtra por mesero). Hoy NO filtra; solo se fija el contrato.
 */
export const DINING_ORDER_SCOPES = ['all', 'own'] as const;
export type DiningOrderScope = (typeof DINING_ORDER_SCOPES)[number];

export class OpenDiningOrderDto {
  @IsEnum(DiningServiceType)
  @IsOptional()
  serviceType?: DiningServiceType;

  @ValidateIf((o: OpenDiningOrderDto) => !o.serviceType || o.serviceType === 'DINE_IN')
  @IsString()
  @IsNotEmpty()
  tableId?: string;

  // Etiqueta libre para órdenes sin mesa (Mostrador, Para Llevar, Cliente Juan).
  // En órdenes DINE_IN se genera automáticamente desde el nombre de la mesa.
  @IsString()
  @IsOptional()
  @MaxLength(80)
  reference?: string;

  // Mesero (Employee) al que se atribuye la cuenta. Lo usa la comanda web, que
  // opera con sesión de usuario y autoriza al mesero por PIN (no por token
  // operator). Si se omite, se toma la identidad de empleado del token operator
  // (flujo de la app móvil).
  @IsString()
  @IsOptional()
  waiterId?: string;
}

export class AddDiningItemDto {
  // Id de cliente (uuid) para captura offline: permite que la app referencie la
  // línea (update/remove) antes de sincronizar. Si se provee, la línea se crea
  // con ese id de forma idempotente (sin fusionar) — reintentos no duplican.
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDiningItemDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  quantity?: number;

  // Nota/modificador libre de la línea ("sin cebolla", "término medio").
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ChangeDiningStatusDto {
  @IsEnum(DiningOrderStatus)
  status!: DiningOrderStatus;
}

export class ListDiningOrdersDto {
  // Default 'all' (sin cambio de comportamiento). La comanda envía 'own'.
  @IsOptional()
  @IsIn(DINING_ORDER_SCOPES)
  scope?: DiningOrderScope;
}

export class CleanupEmptyOrdersDto {
  // Only purge empty OPEN orders older than this many minutes (default 120).
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  olderThanMinutes?: number;
}
