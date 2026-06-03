export type UnitCategory = 'WEIGHT' | 'VOLUME' | 'COUNT'

interface UnitDef {
  category: UnitCategory
  /** Multiply quantity by this to reach the canonical base unit */
  factor: number
}

const UNIT_DEFS: Record<string, UnitDef> = {
  // WEIGHT — base unit: gr
  kg:    { category: 'WEIGHT', factor: 1000 },
  kilo:  { category: 'WEIGHT', factor: 1000 },
  g:     { category: 'WEIGHT', factor: 1 },
  gr:    { category: 'WEIGHT', factor: 1 },
  // VOLUME — base unit: ml
  lt:    { category: 'VOLUME', factor: 1000 },
  l:     { category: 'VOLUME', factor: 1000 },
  litro: { category: 'VOLUME', factor: 1000 },
  ml:    { category: 'VOLUME', factor: 1 },
  // COUNT — no cross-unit conversions; each is its own base
  pieza:   { category: 'COUNT', factor: 1 },
  pza:     { category: 'COUNT', factor: 1 },
  caja:    { category: 'COUNT', factor: 1 },
  bolsa:   { category: 'COUNT', factor: 1 },
  rollo:   { category: 'COUNT', factor: 1 },
  porcion: { category: 'COUNT', factor: 1 },
  paquete: { category: 'COUNT', factor: 1 },
  unidad:  { category: 'COUNT', factor: 1 },
}

const norm = (u: string) => u.toLowerCase().trim()

export function getUnitCategory(unit: string): UnitCategory | undefined {
  return UNIT_DEFS[norm(unit)]?.category
}

/** True if fromUnit can be mathematically converted to toUnit */
export function areUnitsCompatible(fromUnit: string, toUnit: string): boolean {
  const a = norm(fromUnit)
  const b = norm(toUnit)
  if (a === b) return true
  const da = UNIT_DEFS[a]
  const db = UNIT_DEFS[b]
  if (!da || !db) return false
  // COUNT units are incompatible with each other; WEIGHT↔WEIGHT and VOLUME↔VOLUME are fine
  return da.category === db.category && da.category !== 'COUNT'
}

/**
 * Convert quantity from one unit to another.
 * Throws if units are incompatible or unknown.
 */
export function convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
  const a = norm(fromUnit)
  const b = norm(toUnit)
  if (a === b) return quantity

  const da = UNIT_DEFS[a]
  const db = UNIT_DEFS[b]

  if (!da) throw new Error(`Unidad desconocida: ${fromUnit}`)
  if (!db) throw new Error(`Unidad desconocida: ${toUnit}`)
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(`Conversión inválida: ${fromUnit} → ${toUnit} (categorías incompatibles)`)
  }

  // fromUnit → canonical base → toUnit
  return (quantity * da.factor) / db.factor
}

/**
 * Like convertUnits but returns quantity unchanged on error.
 * Safe to use with legacy data where units may be unknown/unregistered.
 */
export function safeConvertUnits(quantity: number, fromUnit: string, toUnit: string): number {
  try {
    return convertUnits(quantity, fromUnit, toUnit)
  } catch {
    return quantity
  }
}

/** 1 fromUnit expressed in toUnit, or null if incompatible */
export function getConversionFactor(fromUnit: string, toUnit: string): number | null {
  if (!areUnitsCompatible(fromUnit, toUnit)) return null
  const da = UNIT_DEFS[norm(fromUnit)]
  const db = UNIT_DEFS[norm(toUnit)]
  if (!da || !db) return null
  return da.factor / db.factor
}

/** Human-readable quantity string with sensible decimal places */
export function formatQuantity(quantity: number, unit: string): string {
  const n = norm(unit)
  const wholePreferred = ['gr', 'g', 'ml', 'pieza', 'pza', 'unidad'].includes(n)
  const maximumFractionDigits = wholePreferred ? 0 : 3
  return `${Number(quantity).toLocaleString('es-MX', { maximumFractionDigits })} ${unit}`
}

// ── ERP unit model helpers ─────────────────────────────────────────────────
// Each Supply has:
//   inventoryUnit (KG, LT, BOX) — what users see and operate with
//   baseUnit      (GR, ML, PIECE) — where stock is internally stored
//   conversionFactor: 1 inventoryUnit = conversionFactor baseUnits

/**
 * Convert a quantity expressed in inventoryUnit to baseUnit.
 * E.g. 5 KG → 5000 GR if conversionFactor=1000
 */
export function convertToBaseUnit(qty: number, conversionFactor: number): number {
  return qty * conversionFactor
}

/**
 * Convert a quantity stored in baseUnit back to inventoryUnit for display.
 * E.g. 5000 GR → 5 KG if conversionFactor=1000
 */
export function convertFromBaseUnit(qty: number, conversionFactor: number): number {
  if (conversionFactor === 0) return qty
  return qty / conversionFactor
}

/**
 * Convert an input qty (assumed to be in inventoryUnit) to baseUnit for storage.
 * Alias for convertToBaseUnit; use this at entry points (purchases, stock adjustments).
 */
export function normalizeInventoryQuantity(inventoryQty: number, conversionFactor: number): number {
  return convertToBaseUnit(inventoryQty, conversionFactor)
}

/**
 * Format baseUnit stock as a human-friendly inventoryUnit quantity.
 * E.g. (5000, 1000, 'KG', 'GR') → '5 KG  (5000 GR)'
 */
export function formatInventoryQuantity(
  baseQty: number,
  conversionFactor: number,
  inventorySymbol: string,
  baseSymbol?: string,
): string {
  const inventoryQty = convertFromBaseUnit(baseQty, conversionFactor)
  const decimals = Number.isInteger(inventoryQty) ? 0 : 3
  const display = Number(inventoryQty).toLocaleString('es-MX', { maximumFractionDigits: decimals })
  const suffix = baseSymbol && baseSymbol !== inventorySymbol
    ? `  (${Number(baseQty).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${baseSymbol})`
    : ''
  return `${display} ${inventorySymbol}${suffix}`
}

/**
 * Compute the default conversionFactor from two MeasurementUnit baseFactor values.
 * Only valid when both units share the same category (WEIGHT or VOLUME).
 * For COUNT units, returns null — must be defined per supply.
 */
export function defaultConversionFactor(
  inventoryBaseFactor: number,
  baseUnitBaseFactor: number,
): number | null {
  if (baseUnitBaseFactor === 0) return null
  return inventoryBaseFactor / baseUnitBaseFactor
}
