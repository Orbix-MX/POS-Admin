import { ProductDraftEval } from './product-draft.eval-schema';

export interface EvalCase {
  id: string;
  input: string;
  expected: Omit<ProductDraftEval, 'description'>;
  /** Por qué este caso está en el conjunto — qué falla si el modelo lo resuelve mal. */
  note: string;
}

/**
 * Conjunto de evaluación — Fase 0/2 del documento de arquitectura (§16, §20:
 * "sin esto, cambiar de modelo es a ciegas"). 30 entradas de español
 * mexicano de mostrador, con el `ProductDraft` esperado. `description` no
 * se puntúa (texto libre); todo lo demás sí.
 *
 * Fuente: redactadas a mano para este documento, no recolectadas de tenants
 * reales todavía — el checklist de la Fase 0 pide "revisadas por alguien de
 * negocio" antes de usarse como criterio de aceptación formal. Sirven ya
 * para comparar modelos entre sí.
 */
export const EVAL_DATASET: EvalCase[] = [
  {
    id: 'eval-01',
    input: 'Quiero agregar Coca-Cola de 600 ml, me cuesta 15 pesos y la vendo en 22.',
    expected: {
      name: 'Coca-Cola 600ml',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: 15,
      price: 22,
      taxCode: 'IVA_16',
    },
    note: 'Caso base: nombre, tamaño, costo y precio explícitos.',
  },
  {
    id: 'eval-02',
    input: 'Dame de alta una coca de 600, la doy en 22 con todo e impuestos.',
    expected: {
      name: 'Coca-Cola 600ml',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: null,
      price: 22,
      taxCode: 'IVA_16',
    },
    note: 'Jerga ("coca de 600") + precio con IVA incluido, sin costo mencionado — no debe inventar el costo.',
  },
  {
    id: 'eval-03',
    input: 'Registra una cagua de Pepsi de 2.5 litros, me sale en 28 y la vendo en 38.',
    expected: {
      name: 'Pepsi 2.5L',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: 28,
      price: 38,
      taxCode: 'IVA_16',
    },
    note: 'Jerga regional ("cagua" = envase grande retornable) — un modelo entrenado mayoritariamente en inglés suele fallar aquí.',
  },
  {
    id: 'eval-04',
    input: 'Alta de sabritas grandes, las compro en 14 y las vendo en 20.',
    expected: {
      name: 'Sabritas grande',
      categoryName: 'Botanas',
      unitName: 'Pieza',
      costPrice: 14,
      price: 20,
      taxCode: 'IVA_16',
    },
    note: 'Marca coloquial usada como genérico ("sabritas" = papas fritas).',
  },
  {
    id: 'eval-05',
    input: 'Quiero dar de alta una torta de jamón, cuesta hacerla 12 pesos y la vendo en 35.',
    expected: {
      name: 'Torta de jamón',
      categoryName: 'Preparados',
      unitName: 'Pieza',
      costPrice: 12,
      price: 35,
      taxCode: 'IVA_16',
    },
    note: 'Producto preparado, no empaquetado — categoría distinta a abarrotes.',
  },
  {
    id: 'eval-06',
    input: 'Agrega leche Lala de un litro, me cuesta 22 y la doy en 28.',
    expected: {
      name: 'Leche Lala 1L',
      categoryName: 'Lácteos',
      unitName: 'Litro',
      costPrice: 22,
      price: 28,
      taxCode: 'EXCENTO',
    },
    note: 'Alimento básico — régimen fiscal exento, no IVA_16 por defecto.',
  },
  {
    id: 'eval-07',
    input: 'Sube el kilo de tortilla, me sale en 16 el kilo y lo vendo en 22.',
    expected: {
      name: 'Tortilla',
      categoryName: 'Panadería',
      unitName: 'Kilogramo',
      costPrice: 16,
      price: 22,
      taxCode: 'EXCENTO',
    },
    note: 'Unidad por peso (kilogramo), no pieza — y alimento básico exento.',
  },
  {
    id: 'eval-08',
    input: 'Dame de alta cigarros Marlboro, me cuestan 48 y los doy en 60.',
    expected: {
      name: 'Cigarros Marlboro',
      categoryName: 'Cigarros y encendedores',
      unitName: 'Pieza',
      costPrice: 48,
      price: 60,
      taxCode: 'IVA_16',
    },
    note: 'Categoría específica del catálogo, no "abarrotes" genérico.',
  },
  {
    id: 'eval-09',
    input: 'Alta de jabón Zote, cuesta 8 pesos y se vende en 13.',
    expected: {
      name: 'Jabón Zote',
      categoryName: 'Limpieza',
      unitName: 'Pieza',
      costPrice: 8,
      price: 13,
      taxCode: 'IVA_16',
    },
    note: 'Caso limpio de control, sin ambigüedad — sirve de referencia.',
  },
  {
    id: 'eval-10',
    input: 'Quiero meter shampoo Sedal de 400ml, me cuesta 35 y lo doy en 52.',
    expected: {
      name: 'Shampoo Sedal 400ml',
      categoryName: 'Cuidado personal',
      unitName: 'Pieza',
      costPrice: 35,
      price: 52,
      taxCode: 'IVA_16',
    },
    note: 'Verbo coloquial ("meter" = dar de alta).',
  },
  {
    id: 'eval-11',
    input: 'Da de alta chicles Trident, me cuestan 6 y los doy en 10 cada uno.',
    expected: {
      name: 'Chicles Trident',
      categoryName: 'Dulcería',
      unitName: 'Pieza',
      costPrice: 6,
      price: 10,
      taxCode: 'IVA_16',
    },
    note: '"cada uno" como pista de unidad — debe resolver Pieza, no Paquete.',
  },
  {
    id: 'eval-12',
    input: 'Sube pan blanco Bimbo grande, me cuesta 38 y lo vendo en 48.',
    expected: {
      name: 'Pan Blanco Bimbo grande',
      categoryName: 'Panadería',
      unitName: 'Pieza',
      costPrice: 38,
      price: 48,
      taxCode: 'EXCENTO',
    },
    note: 'Pan empaquetado de marca — sigue siendo alimento básico exento, no IVA_16 solo por venir empaquetado.',
  },
  {
    id: 'eval-13',
    input: 'Nueva cerveza Corona lata 355ml, me cuesta 14 y la doy en 22.',
    expected: {
      name: 'Cerveza Corona lata 355ml',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: 14,
      price: 22,
      taxCode: 'IVA_16',
    },
    note: 'Bebida alcohólica — IVA_16 (el IEPS adicional no está en este schema, no debe inventarse).',
  },
  {
    id: 'eval-14',
    input: 'Alta de agua Bonafont de 1.5 litros, cuesta 12 y se vende en 18.',
    expected: {
      name: 'Agua Bonafont 1.5L',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: 12,
      price: 18,
      taxCode: 'EXCENTO',
    },
    note: 'Agua natural embotellada — exenta, distinto de un refresco de la misma categoría "Bebidas".',
  },
  {
    id: 'eval-15',
    input: 'Registra papel higiénico Pétalo de 4 rollos, me sale en 30 y lo doy en 45.',
    expected: {
      name: 'Papel Higiénico Pétalo 4 rollos',
      categoryName: 'Limpieza',
      unitName: 'Paquete',
      costPrice: 30,
      price: 45,
      taxCode: 'IVA_16',
    },
    note: 'Unidad Paquete (multi-pieza), no Pieza — a diferencia de eval-11.',
  },
  {
    id: 'eval-16',
    input: 'Mete unas galletas Marías, me cuestan 9 y las doy en 14 va.',
    expected: {
      name: 'Galletas Marías',
      categoryName: 'Dulcería',
      unitName: 'Pieza',
      costPrice: 9,
      price: 14,
      taxCode: 'IVA_16',
    },
    note: 'Muletilla informal final ("va") no debe colarse en ningún campo.',
  },
  {
    id: 'eval-17',
    input: 'Dame de alta gomitas a granel, salen en 90 el kilo y las vendo en 140 el kilo.',
    expected: {
      name: 'Gomitas a granel',
      categoryName: 'Dulcería',
      unitName: 'Kilogramo',
      costPrice: 90,
      price: 140,
      taxCode: 'IVA_16',
    },
    note: '"a granel" + precio por kilo — unidad Kilogramo, no Pieza ni Paquete.',
  },
  {
    id: 'eval-18',
    input: 'Sube jamón de pavo, me cuesta 85 el kilo y lo doy en 120 el kilo.',
    expected: {
      name: 'Jamón de pavo',
      categoryName: 'Lácteos',
      unitName: 'Kilogramo',
      costPrice: 85,
      price: 120,
      taxCode: 'IVA_16',
    },
    note: 'Embutido procesado por peso — IVA_16 (no es un lácteo exento como la leche).',
  },
  {
    id: 'eval-19',
    input: 'Alta de encendedores Bic, cuestan 8 y se venden en 15.',
    expected: {
      name: 'Encendedor Bic',
      categoryName: 'Cigarros y encendedores',
      unitName: 'Pieza',
      costPrice: 8,
      price: 15,
      taxCode: 'IVA_16',
    },
    note: 'Comparte categoría con cigarros pero es un producto distinto — no debe fusionarlos.',
  },
  {
    id: 'eval-20',
    input: 'Dame de alta un refresco de naranja Fanta de 600, sale en 15 y se da en 21.',
    expected: {
      name: 'Fanta Naranja 600ml',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: 15,
      price: 21,
      taxCode: 'IVA_16',
    },
    note: 'Mismo patrón que eval-01 pero con otra marca — control de consistencia.',
  },
  {
    id: 'eval-21',
    input: 'Registra desinfectante Pinol de 1 litro, me cuesta 24 y lo vendo en 34.',
    expected: {
      name: 'Pinol 1L',
      categoryName: 'Limpieza',
      unitName: 'Litro',
      costPrice: 24,
      price: 34,
      taxCode: 'IVA_16',
    },
    note: 'Líquido vendido por volumen unitario — unidad Litro, no Pieza (a diferencia de las bebidas embotelladas).',
  },
  {
    id: 'eval-22',
    input: 'Alta de paracetamol genérico caja de 10, cuesta 18 y se vende en 30.',
    expected: {
      name: 'Paracetamol genérico caja 10',
      categoryName: 'Cuidado personal',
      unitName: 'Caja',
      costPrice: 18,
      price: 30,
      taxCode: 'EXCENTO',
    },
    note: 'Medicamento — tasa exenta en México, y unidad Caja.',
  },
  {
    id: 'eval-23',
    input: 'Sube palomitas de microondas Act II, cuestan 11 y se dan en 17.',
    expected: {
      name: 'Palomitas Act II',
      categoryName: 'Botanas',
      unitName: 'Pieza',
      costPrice: 11,
      price: 17,
      taxCode: 'IVA_16',
    },
    note: 'Otra marca de botanas — control de consistencia con eval-04.',
  },
  {
    id: 'eval-24',
    input: 'Da de alta huevo blanco, cuesta 32 el kilo y se vende en 42 el kilo.',
    expected: {
      name: 'Huevo blanco',
      categoryName: 'Abarrotes',
      unitName: 'Kilogramo',
      costPrice: 32,
      price: 42,
      taxCode: 'EXCENTO',
    },
    note: 'Alimento básico sin marca — no debe inventar una marca que no está en la entrada.',
  },
  {
    id: 'eval-25',
    input: 'Mete el atún Dolores lata, me cuesta 16 y lo doy en 24.',
    expected: {
      name: 'Atún Dolores lata',
      categoryName: 'Abarrotes',
      unitName: 'Pieza',
      costPrice: 16,
      price: 24,
      taxCode: 'IVA_16',
    },
    note: 'Enlatado procesado — IVA_16, no exento pese a estar en Abarrotes.',
  },
  {
    id: 'eval-26',
    input: 'Alta de café soluble Nescafé frasco chico, cuesta 45 y se vende en 65.',
    expected: {
      name: 'Nescafé frasco chico',
      categoryName: 'Abarrotes',
      unitName: 'Pieza',
      costPrice: 45,
      price: 65,
      taxCode: 'IVA_16',
    },
    note: 'El adjetivo "chico" es parte del nombre, no debe interpretarse como un campo aparte.',
  },
  {
    id: 'eval-27',
    input: 'Registra concha de panadería, cuesta 6 y se vende en 12.',
    expected: {
      name: 'Concha',
      categoryName: 'Panadería',
      unitName: 'Pieza',
      costPrice: 6,
      price: 12,
      taxCode: 'EXCENTO',
    },
    note: 'Pan dulce no empaquetado — exento, mismo régimen que el pan básico.',
  },
  {
    id: 'eval-28',
    input: 'Dame de alta las papitas Ruffles queso, las compro en 13.50 y las doy en 19.',
    expected: {
      name: 'Ruffles queso',
      categoryName: 'Botanas',
      unitName: 'Pieza',
      costPrice: 13.5,
      price: 19,
      taxCode: 'IVA_16',
    },
    note: 'Precio con decimales explícitos — no debe redondear ni truncar.',
  },
  {
    id: 'eval-29',
    input: 'Sube servilletas Kleenex paquete de 100, cuestan 20 y se dan en 30.',
    expected: {
      name: 'Servilletas Kleenex paquete 100',
      categoryName: 'Limpieza',
      unitName: 'Paquete',
      costPrice: 20,
      price: 30,
      taxCode: 'IVA_16',
    },
    note: 'Otro caso de unidad Paquete — refuerza eval-15 con distinta categoría de producto.',
  },
  {
    id: 'eval-30',
    input: 'Alta rápida: coca 600, va en 22, gracias.',
    expected: {
      name: 'Coca-Cola 600ml',
      categoryName: 'Bebidas',
      unitName: 'Pieza',
      costPrice: null,
      price: 22,
      taxCode: 'IVA_16',
    },
    note: 'Entrada mínima, informal, sin costo — el caso más exigente de extracción con menos señal.',
  },
];
