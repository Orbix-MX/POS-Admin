/**
 * Catálogo fijo de un tenant de referencia — el contexto que
 * `products.draft` recibiría en el prompt real (§06). Sin esto, el modelo
 * no tiene forma de elegir un `categoryName`/`unitName` que coincida con lo
 * esperado; con esto, la evaluación mide lo mismo que medirá la Fase 3.
 */
export const EVAL_CATEGORIES = [
  'Bebidas',
  'Botanas',
  'Lácteos',
  'Abarrotes',
  'Panadería',
  'Dulcería',
  'Cigarros y encendedores',
  'Cuidado personal',
  'Limpieza',
  'Preparados',
] as const;

export const EVAL_UNITS = ['Pieza', 'Kilogramo', 'Gramo', 'Litro', 'Mililitro', 'Paquete', 'Caja'] as const;

export const EVAL_TAX_CODES = ['IVA_16', 'IVA_11', 'IVA_8', 'EXCENTO'] as const;
