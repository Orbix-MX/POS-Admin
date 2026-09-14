import { Injectable, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { CustomerStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const SHEET_CUSTOMERS = 'Clientes';

/**
 * Las columnas, en orden.
 *
 * Es el mínimo con el que un cliente sirve para vender: a quién le vendes, cómo
 * lo localizas, y si le fías. Todo lo demás —direcciones, historial, saldo— lo
 * produce el propio uso del sistema y no tiene sentido importarlo.
 */
const HEADERS = [
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
] as const;

const TEMPLATE_ROWS = 500;
const STATUS_VALUES: CustomerStatus[] = ['ACTIVE', 'INACTIVE'];

/** Ver `products-import.service.ts`: mismo criterio, mismas razones. */
export type ImportFormat = 'xlsx' | 'csv';
const CSV_DELIMITERS = [',', ';', '\t'] as const;

export interface ImportRowError {
  row: number;
  sku?: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

/**
 * Suficiente para descartar lo que claramente no es un correo, sin pretender
 * validar la RFC 5322 — que ni siquiera los servidores de correo aplican
 * entera. Lo que importa aquí es que la clave del upsert no sea basura.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Importación masiva de clientes.
 *
 * Calcado del de productos a propósito: mismo `ImportResult`, mismo tope, mismo
 * criterio de "una fila mala no tumba el archivo". Un negocio que ya importó su
 * catálogo no debería tener que aprender otra pantalla para su cartera.
 *
 * **La clave natural es el correo**, que ya es `@@unique([tenantId, email])`.
 * De ahí que sea obligatorio aunque en el alta manual no lo sea: sin él no hay
 * forma de saber si una fila crea un cliente nuevo o actualiza uno que ya
 * está, y una importación repetida duplicaría la cartera entera.
 */
@Injectable()
export class CustomersImportService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async buildTemplate(format: ImportFormat = 'xlsx'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Orbix';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(SHEET_CUSTOMERS);
    sheet.columns = HEADERS.map((header) => ({ header, key: header, width: 22 }));
    sheet.getRow(1).font = { bold: true };

    sheet.addRow({
      Correo: 'cliente@ejemplo.com',
      Nombre: 'María',
      Apellido: 'González',
      Teléfono: '5512345678',
      Empresa: '',
      Ciudad: 'Ciudad de México',
      'Razón Social': '',
      Estado: 'ACTIVE',
      'Tiene Crédito': 'NO',
      'Límite de Crédito': 0,
      'Días de Crédito': 0,
    });

    if (format === 'csv') {
      // El BOM es deliberado: sin él Excel abre el archivo en la codificación
      // del sistema y «Teléfono» o «Razón Social» llegan con la tilde rota.
      const csv = await workbook.csv.writeBuffer({ sheetName: SHEET_CUSTOMERS });
      return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(csv as ArrayBuffer)]);
    }

    for (let row = 2; row <= TEMPLATE_ROWS; row++) {
      sheet.getCell(`H${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${STATUS_VALUES.join(',')}"`],
      };
      sheet.getCell(`I${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"SI,NO"'],
      };
    }

    const instructions = workbook.addWorksheet('Instrucciones');
    instructions.getColumn(1).width = 92;
    [
      'Cómo llenar esta plantilla',
      '',
      '• Correo, Nombre y Apellido son obligatorios.',
      '• El correo identifica al cliente: si ya existe en tu cartera se actualiza, si no se crea.',
      '• Estado: ACTIVE o INACTIVE — vacío se toma como ACTIVE.',
      '• Tiene Crédito: SI o NO. Si pones SI, llena también el límite y los días.',
      '• Límite de Crédito y Días de Crédito solo aplican si Tiene Crédito es SI.',
      '• Los saldos y el historial de compras NO se importan: los va llevando el sistema.',
    ].forEach((line) => instructions.addRow([line]));

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Ver `ProductsImportService.readSheet`: mismo problema, misma solución. */
  private async readSheet(buffer: Buffer, format: ImportFormat): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();

    if (format === 'csv') {
      let text = buffer.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      if (!text.trim()) {
        throw new BadRequestException('El archivo está vacío');
      }

      const [firstLine = ''] = text.split(/\r?\n/, 1);
      const delimiter = CSV_DELIMITERS.reduce((best, candidate) =>
        firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
      );

      await workbook.csv.read(Readable.from([text]), { parserOptions: { delimiter } });
    } else {
      await workbook.xlsx.load(buffer as never);
    }

    const sheet = workbook.getWorksheet(SHEET_CUSTOMERS) ?? workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('El archivo no tiene hojas para leer');
    }
    return sheet;
  }

  async importFile(buffer: Buffer, format: ImportFormat = 'xlsx'): Promise<ImportResult> {
    const tenantId = this.tenantContext.requireTenantId();
    const sheet = await this.readSheet(buffer, format);

    const columnIndex = new Map<string, number>();
    (sheet.getRow(1).values as unknown[]).forEach((value, idx) => {
      if (typeof value === 'string') columnIndex.set(value.trim(), idx);
    });

    for (const col of ['Correo', 'Nombre', 'Apellido']) {
      if (!columnIndex.has(col)) {
        throw new BadRequestException(`Falta la columna requerida "${col}" en el archivo`);
      }
    }

    const existing = await this.prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, email: true },
    });
    // El correo se compara en minúsculas: `Ana@X.com` y `ana@x.com` son la
    // misma persona, y tratarlos como distintos duplicaría la cartera.
    const idByEmail = new Map(existing.map((c) => [c.email.toLowerCase(), c.id]));

    const cellText = (row: ExcelJS.Row, col: string): string => {
      const idx = columnIndex.get(col);
      if (!idx) return '';
      const val = row.getCell(idx).value as unknown;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        const obj = val as { text?: unknown; result?: unknown };
        // Un correo escrito en Excel se convierte en hipervínculo, y entonces
        // la celda es un objeto `{ text, hyperlink }` en vez de una cadena.
        if ('text' in obj) return String(obj.text ?? '').trim();
        if ('result' in obj) return String(obj.result ?? '').trim();
      }
      return String(val).trim();
    };

    const cellBoolean = (row: ExcelJS.Row, col: string, defaultValue: boolean): boolean => {
      const raw = cellText(row, col).toUpperCase();
      if (!raw) return defaultValue;
      return ['SI', 'SÍ', 'YES', 'TRUE', '1'].includes(raw);
    };

    const result: ImportResult = { totalRows: 0, created: 0, updated: 0, errors: [] };

    // Correos repetidos DENTRO del archivo: la base no los vería porque el
    // primero aún no está escrito cuando se procesa el segundo.
    const seen = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (row.actualCellCount === 0) continue;

      const email = cellText(row, 'Correo').toLowerCase();
      const firstName = cellText(row, 'Nombre');
      const lastName = cellText(row, 'Apellido');
      if (!email && !firstName && !lastName) continue;

      result.totalRows++;

      if (!email) {
        result.errors.push({ row: rowNumber, message: 'Falta el correo' });
        continue;
      }
      if (!EMAIL.test(email)) {
        result.errors.push({ row: rowNumber, sku: email, message: 'Correo inválido' });
        continue;
      }
      if (seen.has(email)) {
        result.errors.push({
          row: rowNumber,
          sku: email,
          message: 'El correo está repetido en el archivo',
        });
        continue;
      }
      if (!firstName) {
        result.errors.push({ row: rowNumber, sku: email, message: 'Falta el nombre' });
        continue;
      }
      if (!lastName) {
        result.errors.push({ row: rowNumber, sku: email, message: 'Falta el apellido' });
        continue;
      }

      const statusRaw = cellText(row, 'Estado').toUpperCase();
      if (statusRaw && !STATUS_VALUES.includes(statusRaw as CustomerStatus)) {
        result.errors.push({ row: rowNumber, sku: email, message: `Estado inválido: ${statusRaw}` });
        continue;
      }

      const hasCredit = cellBoolean(row, 'Tiene Crédito', false);
      const creditLimitRaw = cellText(row, 'Límite de Crédito');
      const creditDaysRaw = cellText(row, 'Días de Crédito');

      const creditLimit = creditLimitRaw ? Number(creditLimitRaw) : null;
      if (creditLimitRaw && (Number.isNaN(creditLimit) || (creditLimit ?? 0) < 0)) {
        result.errors.push({ row: rowNumber, sku: email, message: 'Límite de crédito inválido' });
        continue;
      }

      const creditDays = creditDaysRaw ? Number(creditDaysRaw) : 0;
      if (creditDaysRaw && (Number.isNaN(creditDays) || creditDays < 0)) {
        result.errors.push({ row: rowNumber, sku: email, message: 'Días de crédito inválidos' });
        continue;
      }

      // Fiar sin decir cuánto es una invitación a que el saldo crezca sin
      // tope, así que se rechaza la fila en vez de asumir un límite.
      if (hasCredit && (creditLimit === null || creditLimit <= 0)) {
        result.errors.push({
          row: rowNumber,
          sku: email,
          message: 'Si el cliente tiene crédito, el límite debe ser mayor que cero',
        });
        continue;
      }

      seen.add(email);

      const data = {
        email,
        firstName,
        lastName,
        phone: cellText(row, 'Teléfono') || null,
        company: cellText(row, 'Empresa') || null,
        city: cellText(row, 'Ciudad') || null,
        legalName: cellText(row, 'Razón Social') || null,
        status: (statusRaw || 'ACTIVE') as CustomerStatus,
        hasCredit,
        creditLimit: hasCredit ? new Prisma.Decimal(creditLimit ?? 0) : null,
        creditDays: hasCredit ? creditDays : 0,
      };

      try {
        const existingId = idByEmail.get(email);
        if (existingId) {
          await this.prisma.customer.update({ where: { id: existingId }, data });
          result.updated++;
        } else {
          const created = await this.prisma.customer.create({ data: { ...data, tenantId } });
          // Se recuerda para que una segunda fila con el mismo correo —ya
          // filtrada por `seen`— no pudiera crearlo dos veces.
          idByEmail.set(email, created.id);
          result.created++;
        }
      } catch (error) {
        // Una fila mala no tumba el archivo: se anota y se sigue. Importar 400
        // clientes y perderlos todos por el 137 sería el peor resultado
        // posible.
        result.errors.push({
          row: rowNumber,
          sku: email,
          message: error instanceof Error ? error.message : 'No se pudo guardar',
        });
      }
    }

    return result;
  }
}
