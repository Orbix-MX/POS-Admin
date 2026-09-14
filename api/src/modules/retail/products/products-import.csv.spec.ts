import { BadRequestException } from '@nestjs/common';

import { ProductsImportService, type ImportFormat } from './products-import.service';

/**
 * Importar desde CSV.
 *
 * El `.xlsx` es el formato bueno, pero exige Excel. El CSV existe porque es lo
 * que exporta el sistema del que el negocio viene huyendo, y porque se puede
 * abrir en cualquier cosa — y por eso llega sucio: con BOM, con punto y coma en
 * vez de coma, y con las tildes a medio romper. Estas pruebas cubren esa
 * suciedad, que es justo lo que hace que una importación "no funcione" sin que
 * nadie sepa por qué.
 */
describe('ProductsImportService — CSV', () => {
  const TENANT = 't1';

  function build() {
    const service = new ProductsImportService(
      {
        category: { findMany: () => Promise.resolve([{ id: 'c1', name: 'Panadería' }]) },
        product: { findMany: () => Promise.resolve([]) },
      } as never,
      { requireTenantId: () => TENANT, getBranchId: () => null } as never,
      {} as never,
    );

    /** `readSheet` es privado: es la frontera exacta que el CSV cambia. */
    const readSheet = (buffer: Buffer, format: ImportFormat) =>
      (
        service as unknown as {
          readSheet: (b: Buffer, f: ImportFormat) => Promise<{
            getRow: (n: number) => { values: unknown[] };
            rowCount: number;
          }>;
        }
      ).readSheet(buffer, format);

    return { service, readSheet };
  }

  /** Las cabeceras que la hoja leyó, en orden y sin el hueco inicial. */
  const headersOf = (sheet: { getRow: (n: number) => { values: unknown[] } }) =>
    (sheet.getRow(1).values as unknown[]).filter((v): v is string => typeof v === 'string');

  it('lee un CSV separado por comas', async () => {
    const { readSheet } = build();
    const csv = 'SKU,Nombre,Precio\nA-1,Concha,12\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toEqual(['SKU', 'Nombre', 'Precio']);
  });

  it('lee un CSV separado por punto y coma', async () => {
    // Excel usa el separador de listas del sistema: en España y buena parte de
    // Europa es `;`. Sin detectarlo, todo el archivo es UNA columna y el import
    // se queja de que falta "SKU" teniéndolo delante.
    const { readSheet } = build();
    const csv = 'SKU;Nombre;Precio\nA-1;Concha;12\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toEqual(['SKU', 'Nombre', 'Precio']);
  });

  it('lee un CSV separado por tabuladores', async () => {
    const { readSheet } = build();
    const csv = 'SKU\tNombre\tPrecio\nA-1\tConcha\t12\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toEqual(['SKU', 'Nombre', 'Precio']);
  });

  it('descarta el BOM que Excel pega a la primera cabecera', async () => {
    // Sin quitarlo, la primera columna llega como "﻿SKU" y la validación
    // de columnas obligatorias falla sobre una columna que está a la vista.
    const { readSheet } = build();
    const csv = '﻿SKU,Nombre,Precio\nA-1,Concha,12\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)[0]).toBe('SKU');
  });

  it('no confunde el separador con las comas de una descripción entrecomillada', async () => {
    // El delimitador se decide mirando SOLO la cabecera: si se contara todo el
    // archivo, una descripción con comas podría imponer `,` sobre un CSV de `;`.
    const { readSheet } = build();
    const csv = 'SKU;Nombre;Descripción\nA-1;Concha;"dulce, suave, de nata"\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toEqual(['SKU', 'Nombre', 'Descripción']);
    const row = (sheet.getRow(2).values as unknown[]).filter((v) => typeof v === 'string');
    expect(row).toContain('dulce, suave, de nata');
  });

  it('conserva las tildes de las cabeceras', async () => {
    const { readSheet } = build();
    const csv = '﻿SKU,Nombre,Descripción,Categoría\nA-1,Concha,Dulce,Panadería\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toContain('Descripción');
    expect(headersOf(sheet)).toContain('Categoría');
  });

  it('acepta finales de línea de Windows', async () => {
    const { readSheet } = build();
    const csv = 'SKU,Nombre,Precio\r\nA-1,Concha,12\r\n';
    const sheet = await readSheet(Buffer.from(csv, 'utf8'), 'csv');

    expect(headersOf(sheet)).toEqual(['SKU', 'Nombre', 'Precio']);
  });

  it('un archivo vacío no revienta: es un error de usuario, no una excepción sin mensaje', async () => {
    const { readSheet } = build();
    await expect(readSheet(Buffer.from('', 'utf8'), 'csv')).rejects.toThrow(BadRequestException);
  });

  describe('plantilla', () => {
    it('la de CSV lleva BOM, para que Excel no rompa las tildes', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate('csv');

      expect(buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const text = buffer.toString('utf8');
      expect(text).toContain('SKU');
      expect(text).toContain('Categoría');
    });

    it('la de CSV es texto, no un zip de Excel', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate('csv');

      // Un .xlsx empieza por "PK": si esto pasara, se estaría sirviendo un
      // Excel con extensión .csv y no lo abriría nada.
      expect(buffer.subarray(3, 5).toString('utf8')).not.toBe('PK');
    });

    it('la de xlsx sigue siendo un xlsx', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate('xlsx');

      expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
    });

    it('el formato por defecto es xlsx', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate();

      expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
    });
  });
});
