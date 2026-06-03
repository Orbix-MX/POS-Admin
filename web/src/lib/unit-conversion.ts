export type UnitCategory = 'WEIGHT' | 'VOLUME' | 'COUNT'

interface UnitDef {
  category: UnitCategory
  factor: number
}

const UNIT_DEFS: Record<string, UnitDef> = {
  kg:    { category: 'WEIGHT', factor: 1000 },
  kilo:  { category: 'WEIGHT', factor: 1000 },
  g:     { category: 'WEIGHT', factor: 1 },
  gr:    { category: 'WEIGHT', factor: 1 },
  lt:    { category: 'VOLUME', factor: 1000 },
  l:     { category: 'VOLUME', factor: 1000 },
  litro: { category: 'VOLUME', factor: 1000 },
  ml:    { category: 'VOLUME', factor: 1 },
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

export function areUnitsCompatible(fromUnit: string, toUnit: string): boolean {
  const a = norm(fromUnit)
  const b = norm(toUnit)
  if (a === b) return true
  const da = UNIT_DEFS[a]
  const db = UNIT_DEFS[b]
  if (!da || !db) return false
  return da.category === db.category && da.category !== 'COUNT'
}

/** Returns null if conversion is impossible */
export function getConversionFactor(fromUnit: string, toUnit: string): number | null {
  if (!areUnitsCompatible(fromUnit, toUnit)) return null
  const da = UNIT_DEFS[norm(fromUnit)]
  const db = UNIT_DEFS[norm(toUnit)]
  if (!da || !db) return null
  return da.factor / db.factor
}

/** Returns null if conversion is impossible */
export function convertUnits(quantity: number, fromUnit: string, toUnit: string): number | null {
  const factor = getConversionFactor(fromUnit, toUnit)
  if (factor === null) return null
  return quantity * factor
}

/** Units compatible with the given unit (same category, excludes itself) */
export function getCompatibleUnits(unit: string, allUnits: string[]): string[] {
  return allUnits.filter((u) => u !== unit && areUnitsCompatible(unit, u))
}

export function formatQuantity(quantity: number, unit: string): string {
  const n = norm(unit)
  const wholePreferred = ['gr', 'g', 'ml', 'pieza', 'pza', 'unidad'].includes(n)
  return `${Number(quantity).toLocaleString('es-MX', { maximumFractionDigits: wholePreferred ? 0 : 3 })} ${unit}`
}
