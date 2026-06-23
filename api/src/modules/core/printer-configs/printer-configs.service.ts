import * as net from 'net';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { CreatePrinterConfigDto, UpdatePrinterConfigDto } from './dto/printer-config.dto';
import { OrderItem, Payment, PrinterConfig } from '@prisma/client';

@Injectable()
export class PrinterConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(): Promise<PrinterConfig[]> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.printerConfig.findMany({
      where: { tenantId },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreatePrinterConfigDto): Promise<PrinterConfig> {
    const tenantId = this.tenantContext.requireTenantId();

    if (dto.isDefault) {
      await this.clearDefaultFlag(tenantId, dto.branchId ?? null, null);
    }

    return this.prisma.printerConfig.create({
      data: {
        ...dto,
        tenantId,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdatePrinterConfigDto): Promise<PrinterConfig> {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.printerConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Printer config not found');

    if (dto.isDefault) {
      await this.clearDefaultFlag(tenantId, dto.branchId ?? existing.branchId, id);
    }

    return this.prisma.printerConfig.update({
      where: { id },
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.printerConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Printer config not found');

    await this.prisma.printerConfig.delete({ where: { id } });
  }

  async getReceiptData(
    orderId: string,
    printerType = 'SALE_TICKET',
  ): Promise<{
    bytes: number[];
    printerName: string | null;
    connectionType: string | null;
    printerFound: boolean;
  }> {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const [order, tenant] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    ]);

    if (!order) throw new NotFoundException('Orden no encontrada');

    const printer = await this.findPrinterForType(tenantId, branchId, printerType);
    const cols = (printer?.paperWidth ?? 80) <= 58 ? 32 : 48;
    const buffer = this.buildEscPosReceipt(
      order,
      tenant?.name ?? 'Tienda',
      cols,
    );

    return {
      bytes: Array.from(buffer),
      printerName: printer?.systemName ?? printer?.bluetoothAddress ?? null,
      connectionType: printer?.connectionType ?? null,
      printerFound: !!printer,
    };
  }

  async printReceipt(orderId: string, printerType = 'SALE_TICKET'): Promise<{ success: boolean; reason?: string }> {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const [order, tenant] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);

    if (!order) throw new NotFoundException('Orden no encontrada');

    const printer = await this.findPrinterForType(tenantId, branchId, printerType);
    if (!printer) {
      return { success: false, reason: `No hay impresora ${printerType} configurada` };
    }
    if (printer.connectionType !== 'NETWORK' || !printer.ipAddress) {
      return {
        success: false,
        reason: `Tipo de conexión '${printer.connectionType}' no soportado automáticamente`,
      };
    }

    const cols = (printer.paperWidth ?? 80) <= 58 ? 32 : 48;
    const data = this.buildEscPosReceipt(
      order,
      tenant?.name ?? 'Tienda',
      cols,
    );

    try {
      await this.sendViaTcp(printer.ipAddress, printer.port ?? 9100, data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, reason: msg };
    }

    return { success: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Finds the best matching printer for a given type using the following
   * priority order:
   *   1. isDefault=true, branchId matches, type matches
   *   2. isDefault=true, branchId=null,    type matches
   *   3. isActive=true,  branchId matches, type matches
   *   4. isActive=true,  branchId=null,    type matches
   */
  private async findPrinterForType(
    tenantId: string,
    branchId: string | null,
    type: string,
  ): Promise<PrinterConfig | null> {
    const candidates = await this.prisma.printerConfig.findMany({
      where: {
        tenantId,
        type: type as PrinterConfig['type'],
        isActive: true,
        OR: [{ branchId }, { branchId: null }],
      },
    });

    if (candidates.length === 0) return null;

    // Priority 1: default + matching branch
    const p1 = candidates.find((c) => c.isDefault && c.branchId === branchId);
    if (p1) return p1;

    // Priority 2: default + global (branchId=null)
    const p2 = candidates.find((c) => c.isDefault && c.branchId === null);
    if (p2) return p2;

    // Priority 3: active + matching branch
    const p3 = candidates.find((c) => c.isActive && c.branchId === branchId);
    if (p3) return p3;

    // Priority 4: active + global
    return candidates.find((c) => c.isActive && c.branchId === null) ?? null;
  }

  /**
   * Opens a TCP connection to the printer, sends `data`, then closes the
   * socket.  Rejects after 5 s if the printer does not respond.
   */
  private sendViaTcp(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port }, () => {
        socket.write(data);
        socket.end();
      });
      socket.setTimeout(5000);
      socket.on('finish', () => resolve());
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Printer timeout'));
      });
      socket.on('error', reject);
    });
  }

  /**
   * Builds a raw ESC/POS buffer for a sale receipt.
   * `cols` should be 48 for 80 mm paper, 32 for 58 mm paper.
   */
  private buildEscPosReceipt(
    order: {
      orderNumber: string;
      tableNumber: string | null;
      employeeNumber: string | null;
      subtotal: { toString(): string };
      discount: { toString(): string };
      total: { toString(): string };
      createdAt: Date;
      items: Pick<OrderItem, 'name' | 'quantity' | 'price' | 'total' | 'description'>[];
      payments: Pick<Payment, 'paymentMethod' | 'amount'>[];
    },
    storeName: string,
    cols: number,
  ): Buffer {
    // ── ESC/POS command bytes ────────────────────────────────────────────────
    const ESC_INIT       = Buffer.from([0x1b, 0x40]);
    const BOLD_ON        = Buffer.from([0x1b, 0x45, 0x01]);
    const BOLD_OFF       = Buffer.from([0x1b, 0x45, 0x00]);
    const ALIGN_CENTER   = Buffer.from([0x1b, 0x61, 0x01]);
    const ALIGN_LEFT     = Buffer.from([0x1b, 0x61, 0x00]);
    const FEED_5         = Buffer.from([0x1b, 0x64, 0x05]);
    const PARTIAL_CUT    = Buffer.from([0x1d, 0x56, 0x01]);
    const NL             = Buffer.from([0x0a]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const t = (text: string) => Buffer.from(text, 'latin1');

    const currency = (v: { toString(): string } | number) =>
      '$' + Number(v.toString()).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    const dated = new Date(order.createdAt).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'short',
      timeStyle: 'short',
    } as Intl.DateTimeFormatOptions);

    /** Right-aligns `right` inside `cols` characters, padded with spaces. */
    const twoCol = (left: string, right: string) =>
      t(left.padEnd(cols - right.length) + right);

    const divider    = (char: string) => t(char.repeat(cols));
    const subtotalN  = Number(order.subtotal.toString());
    const discountN  = Number(order.discount.toString());
    const totalN     = Number(order.total.toString());

    // ── Build parts ──────────────────────────────────────────────────────────
    const parts: Buffer[] = [
      ESC_INIT,
      ALIGN_CENTER, BOLD_ON, t(storeName), BOLD_OFF, NL,
      t(dated), NL,
      t(`Folio: ${order.orderNumber}`), NL,
    ];

    if (order.tableNumber) {
      parts.push(t(`Mesa: ${order.tableNumber}`), NL);
    }
    if (order.employeeNumber) {
      parts.push(t(`Empleado: ${order.employeeNumber}`), NL);
    }

    parts.push(ALIGN_LEFT, divider('-'), NL);

    for (const item of order.items) {
      const itemLabel = `${item.quantity}x ${item.name}`;
      const itemTotal = currency(item.total);
      parts.push(twoCol(itemLabel, itemTotal), NL);

      if (item.description) {
        parts.push(t(`  > ${item.description}`), NL);
      }
    }

    parts.push(divider('-'), NL);
    parts.push(twoCol('SUBTOTAL:', currency(subtotalN)), NL);

    if (discountN > 0) {
      parts.push(twoCol('DESCUENTO:', `-${currency(discountN)}`), NL);
    }

    parts.push(
      BOLD_ON,
      twoCol('TOTAL:', currency(totalN)),
      BOLD_OFF,
      NL,
      divider('='), NL,
    );

    for (const payment of order.payments) {
      const method = String(payment.paymentMethod).toUpperCase();
      parts.push(twoCol(`PAGO (${method}):`, currency(payment.amount)), NL);
    }

    parts.push(
      ALIGN_CENTER,
      NL,
      t('\xA1Gracias por su compra!'), NL,
      FEED_5,
      PARTIAL_CUT,
    );

    return Buffer.concat(parts);
  }

  /**
   * Unsets isDefault on all printer configs that share the same
   * (tenantId, branchId) scope, excluding the record being saved (excludeId).
   * branchId=null means the global/tenant-level scope (no branch).
   */
  private async clearDefaultFlag(
    tenantId: string,
    branchId: string | null,
    excludeId: string | null,
  ): Promise<void> {
    await this.prisma.printerConfig.updateMany({
      where: {
        tenantId,
        branchId: branchId ?? null,
        isDefault: true,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}
