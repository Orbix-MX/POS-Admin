import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { CustomersImportService } from './customers-import.service';

/**
 * Importar la cartera de clientes.
 *
 * Lo que se prueba no es el parseo —eso ya lo cubre el de productos— sino las
 * reglas que solo existen aquí: el correo como clave natural, y el crédito, que
 * es la única columna que puede costar dinero si se importa mal.
 */
describe('CustomersImportService', () => {
  const TENANT = 't1';

  function build(existing: { id: string; email: string }[] = []) {
    const created: Record<string, unknown>[] = [];
    const updated: { id: string; data: Record<string, unknown> }[] = [];

    const service = new CustomersImportService(
      {
        customer: {
          findMany: () => Promise.resolve(existing),
          create: ({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return Promise.resolve({ id: `new-${created.length}`, ...data });
          },
          update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            updated.push({ id: where.id, data });
            return Promise.resolve({ id: where.id, ...data });
          },
        },
      } as never,
      { requireTenantId: () => TENANT } as never,
    );

    return { service, created, updated };
  }

  /** Un CSV con las cabeceras reales de la plantilla. */
  function csv(rows: string[][]): Buffer {
    const header =
      'Correo,Nombre,Apellido,Teléfono,Empresa,Ciudad,Razón Social,Estado,Tiene Crédito,Límite de Crédito,Días de Crédito';
    return Buffer.from([header, ...rows.map((r) => r.join(','))].join('\n'), 'utf8');
  }

  const row = (over: Partial<Record<number, string>> = {}) => {
    const base = ['ana@x.com', 'Ana', 'López', '5512345678', '', 'CDMX', '', 'ACTIVE', 'NO', '', ''];
    Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v!));
    return base;
  };

  it('crea un cliente nuevo', async () => {
    const { service, created } = build();
    const result = await service.importFile(csv([row()]), 'csv');

    expect(result).toMatchObject({ totalRows: 1, created: 1, updated: 0 });
    expect(result.errors).toEqual([]);
    expect(created[0]).toMatchObject({
      email: 'ana@x.com',
      firstName: 'Ana',
      lastName: 'López',
      tenantId: TENANT,
    });
  });

  it('actualiza si el correo ya está en la cartera', async () => {
    const { service, updated, created } = build([{ id: 'c1', email: 'ana@x.com' }]);
    const result = await service.importFile(csv([row()]), 'csv');

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(updated[0].id).toBe('c1');
    expect(created).toEqual([]);
  });

  it('el correo no distingue mayúsculas: no duplica la cartera', async () => {
    // `Ana@X.com` y `ana@x.com` son la misma persona. Tratarlas como distintas
    // es cómo una cartera de 300 acaba con 600 registros.
    const { service, updated } = build([{ id: 'c1', email: 'ana@x.com' }]);
    const result = await service.importFile(csv([row({ 0: 'Ana@X.com' })]), 'csv');

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(updated[0].id).toBe('c1');
  });

  it('rechaza una fila sin correo, porque no hay con qué identificarla', async () => {
    const { service } = build();
    const result = await service.importFile(csv([row({ 0: '' })]), 'csv');

    expect(result.created).toBe(0);
    expect(result.errors[0]).toMatchObject({ row: 2, message: 'Falta el correo' });
  });

  it('rechaza un correo que no lo es', async () => {
    const { service } = build();
    const result = await service.importFile(csv([row({ 0: 'ana-arroba-x' })]), 'csv');

    expect(result.errors[0].message).toBe('Correo inválido');
  });

  it('detecta el correo repetido DENTRO del archivo', async () => {
    // La base no lo vería: cuando se procesa la segunda fila, la primera aún no
    // está escrita.
    const { service, created } = build();
    const result = await service.importFile(csv([row(), row({ 1: 'Ana María' })]), 'csv');

    expect(created).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      row: 3,
      message: 'El correo está repetido en el archivo',
    });
  });

  it('exige nombre y apellido', async () => {
    const { service } = build();
    const sinNombre = await service.importFile(csv([row({ 1: '' })]), 'csv');
    const sinApellido = await service.importFile(csv([row({ 2: '' })]), 'csv');

    expect(sinNombre.errors[0].message).toBe('Falta el nombre');
    expect(sinApellido.errors[0].message).toBe('Falta el apellido');
  });

  it('rechaza un estado que no existe', async () => {
    const { service } = build();
    const result = await service.importFile(csv([row({ 7: 'BORRADO' })]), 'csv');

    expect(result.errors[0].message).toContain('Estado inválido');
  });

  it('un estado vacío se toma como ACTIVE', async () => {
    const { service, created } = build();
    await service.importFile(csv([row({ 7: '' })]), 'csv');

    expect(created[0]).toMatchObject({ status: 'ACTIVE' });
  });

  describe('crédito', () => {
    it('rechaza fiar sin límite: el saldo crecería sin tope', async () => {
      const { service } = build();
      const result = await service.importFile(csv([row({ 8: 'SI', 9: '' })]), 'csv');

      expect(result.created).toBe(0);
      expect(result.errors[0].message).toContain('el límite debe ser mayor que cero');
    });

    it('rechaza un límite de cero con crédito activado', async () => {
      const { service } = build();
      const result = await service.importFile(csv([row({ 8: 'SI', 9: '0' })]), 'csv');

      expect(result.errors[0].message).toContain('el límite debe ser mayor que cero');
    });

    it('guarda el crédito cuando viene completo', async () => {
      const { service, created } = build();
      const result = await service.importFile(csv([row({ 8: 'SI', 9: '5000', 10: '30' })]), 'csv');

      expect(result.created).toBe(1);
      expect(created[0]).toMatchObject({ hasCredit: true, creditDays: 30 });
      expect(String(created[0].creditLimit)).toBe('5000');
    });

    it('sin crédito, el límite no se guarda aunque venga en el archivo', async () => {
      // Dejar un límite colgando en un cliente sin crédito es una bomba: basta
      // que alguien active la casilla más tarde para que quede fiando 9000.
      const { service, created } = build();
      await service.importFile(csv([row({ 8: 'NO', 9: '9000', 10: '60' })]), 'csv');

      expect(created[0]).toMatchObject({ hasCredit: false, creditLimit: null, creditDays: 0 });
    });

    it('rechaza un límite negativo', async () => {
      const { service } = build();
      const result = await service.importFile(csv([row({ 8: 'SI', 9: '-100' })]), 'csv');

      expect(result.errors[0].message).toBe('Límite de crédito inválido');
    });
  });

  it('una fila que falla al guardar no tumba el resto del archivo', async () => {
    const { service } = build();
    const spy = jest
      .spyOn(
        (service as unknown as { prisma: { customer: { create: unknown } } }).prisma.customer,
        'create' as never,
      )
      .mockImplementationOnce(() => Promise.reject(new Error('conexión perdida')) as never);

    const result = await service.importFile(
      csv([row(), row({ 0: 'beto@x.com', 1: 'Beto' })]),
      'csv',
    );

    expect(result.errors).toHaveLength(1);
    expect(result.created).toBe(1);
    spy.mockRestore();
  });

  it('las filas en blanco no cuentan como importadas', async () => {
    const { service } = build();
    const result = await service.importFile(csv([row(), [',,,,,,,,,,']]), 'csv');

    expect(result.totalRows).toBe(1);
  });

  it('exige las columnas obligatorias', async () => {
    const { service } = build();
    const sinCorreo = Buffer.from('Nombre,Apellido\nAna,López\n', 'utf8');

    await expect(service.importFile(sinCorreo, 'csv')).rejects.toThrow(BadRequestException);
  });

  describe('plantilla', () => {
    it('la de xlsx trae las columnas y la hoja de instrucciones', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate('xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as never);
      const sheet = workbook.getWorksheet('Clientes');

      expect(sheet).toBeDefined();
      const headers = (sheet!.getRow(1).values as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      );
      expect(headers).toEqual([
        'Correo',
        'Nombre',
        'Apellido',
        'Teléfono',
        'Empresa',
        'Ciudad',
        'Razón Social',
        'Estado',
        'Tiene Crédito',
        'Límite de Crédito',
        'Días de Crédito',
      ]);
      expect(workbook.getWorksheet('Instrucciones')).toBeDefined();
    });

    it('la de CSV lleva BOM y es texto plano', async () => {
      const { service } = build();
      const buffer = await service.buildTemplate('csv');

      expect(buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(buffer.toString('utf8')).toContain('Correo');
    });

    it('lo que genera la plantilla es lo que el import sabe leer', async () => {
      // El contrato que de verdad importa: si alguien cambia una cabecera en un
      // sitio y no en el otro, la plantilla oficial deja de importarse.
      const { service, created } = build();
      const template = await service.buildTemplate('csv');
      const result = await service.importFile(template, 'csv');

      expect(result.errors).toEqual([]);
      expect(result.created).toBe(1);
      expect(created[0]).toMatchObject({ email: 'cliente@ejemplo.com', firstName: 'María' });
    });
  });
});
