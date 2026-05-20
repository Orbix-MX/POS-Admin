import { Injectable, NotFoundException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const CURRENCY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmt = (n: number | string) => CURRENCY.format(Number(n));
const fmtDate = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  CONVERTED: 'Convertida',
};

@Injectable()
export class QuotePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async generate(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const tenantId = this.tenantContext.requireTenantId();

    const [quote, tenant] = await Promise.all([
      this.prisma.serviceQuote.findFirst({
        where: { id, tenantId },
        include: {
          customer: true,
          items: { include: { service: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    if (!quote) throw new NotFoundException('Cotización no encontrada');

    const html = this.buildHtml(quote, tenant);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        displayHeaderFooter: false,
      });
      return { buffer: Buffer.from(pdfUint8), filename: `${quote.quoteNumber}.pdf` };
    } finally {
      await browser.close();
    }
  }

  private buildHtml(quote: any, tenant: any): string {
    const s = (tenant?.settings ?? {}) as Record<string, string>;
    const businessName = s.businessName || tenant?.name || 'Mi Empresa';
    const legalName = s.legalName || '';
    const phone = s.phone || '';
    const email = s.email || '';
    const address = s.address || '';
    const taxId = s.taxId || '';

    const seller = quote.createdBy
      ? `${quote.createdBy.firstName} ${quote.createdBy.lastName}`
      : '—';

    const customer = quote.customer;
    const customerLines = [
      `${customer.firstName} ${customer.lastName}`,
      customer.company,
      customer.email,
      customer.phone,
    ]
      .filter(Boolean)
      .map((l) => `<div>${this.escape(l)}</div>`)
      .join('');

    const companyLines = [
      address,
      phone ? `Tel: ${phone}` : '',
      email,
      taxId ? `RFC: ${taxId}` : '',
    ]
      .filter(Boolean)
      .map((l) => `<div>${this.escape(l)}</div>`)
      .join('');

    const itemRows = (quote.items as any[])
      .map(
        (item, i) => `
      <tr class="${i % 2 === 1 ? 'alt' : ''}">
        <td class="tc">${item.quantity}</td>
        <td>${this.escape(item.description)}</td>
        <td class="tr">${fmt(item.unitPrice)}</td>
        <td class="tr">${fmt(item.total)}</td>
      </tr>`,
      )
      .join('');

    const subtotal = Number(quote.subtotal);
    const tax = Number(quote.tax);
    const total = Number(quote.total);

    const generatedDate = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #333;
    background: #fff;
    padding: 40px 48px 40px;
  }

  /* ── Title ── */
  .doc-title {
    font-size: 36px;
    font-weight: 700;
    color: #888;
    letter-spacing: -1px;
    margin-bottom: 20px;
  }

  /* ── Top section ── */
  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
  }
  .company-name { font-size: 18px; font-weight: 700; color: #222; margin-bottom: 2px; }
  .company-legal { font-size: 12px; color: #666; }
  .meta-table { text-align: right; }
  .meta-table tr td:first-child {
    font-weight: 600;
    color: #555;
    padding-right: 12px;
    white-space: nowrap;
  }
  .meta-table tr td:last-child { color: #222; }
  .meta-table td { padding: 2px 0; }

  /* ── Address section ── */
  .addr-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 40px;
  }
  .addr-block { flex: 1; }
  .addr-label {
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 5px;
  }
  .addr-block div { color: #444; line-height: 1.7; }

  /* ── Salesperson bar ── */
  .meta-bar {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    border: 1px solid #ccc;
  }
  .meta-bar th {
    background: #f5f5f5;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #555;
    padding: 8px 14px;
    border-right: 1px solid #ccc;
    text-align: left;
  }
  .meta-bar th:last-child { border-right: none; }
  .meta-bar td {
    padding: 8px 14px;
    border-right: 1px solid #ccc;
    color: #333;
  }
  .meta-bar td:last-child { border-right: none; }

  /* ── Items table ── */
  .items {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ccc;
    margin-bottom: 0;
  }
  .items thead tr { background: #f5f5f5; }
  .items th {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #555;
    padding: 9px 14px;
    border-right: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
  }
  .items th:last-child { border-right: none; }
  .items td {
    padding: 9px 14px;
    border-right: 1px solid #ddd;
    border-bottom: 1px solid #eee;
    color: #333;
    vertical-align: top;
  }
  .items td:last-child { border-right: none; }
  .items tr.alt td { background: #fafafa; }
  /* Empty filler rows */
  .items tr.filler td { height: 24px; border-bottom: 1px solid #eee; }

  /* ── Totals ── */
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ccc;
    border-top: none;
  }
  .totals-table td {
    padding: 8px 14px;
    border-left: 1px solid #ccc;
    border-bottom: 1px solid #ddd;
  }
  .totals-table tr:last-child td { border-bottom: none; font-weight: 700; }
  .totals-table .t-label { color: #555; font-weight: 600; }
  .totals-table .t-value { text-align: right; color: #222; }
  .totals-table .spacer { border-left: none; border-right: none; }
  .col-qty   { width: 70px; }
  .col-price { width: 110px; }
  .col-total { width: 110px; }
  .tc { text-align: center; }
  .tr { text-align: right; }

  /* ── Footer ── */
  .footer { margin-top: 28px; border-top: 1px solid #ddd; padding-top: 14px; }
  .footer-line { color: #666; margin-bottom: 6px; line-height: 1.6; }
  .footer-gen { color: #aaa; font-size: 10px; margin-top: 12px; }
</style>
</head>
<body>

  <div class="doc-title">Cotización</div>

  <!-- ── Top: company + meta ── -->
  <div class="top-row">
    <div>
      <div class="company-name">${this.escape(businessName)}</div>
      ${legalName ? `<div class="company-legal">${this.escape(legalName)}</div>` : ''}
    </div>
    <table class="meta-table">
      <tr>
        <td>Fecha :</td>
        <td>${fmtDate(quote.createdAt)}</td>
      </tr>
      <tr>
        <td>Folio :</td>
        <td>${this.escape(quote.quoteNumber)}</td>
      </tr>
      ${quote.estimatedDeliveryDate ? `
      <tr>
        <td>Entrega :</td>
        <td>${fmtDate(quote.estimatedDeliveryDate)}</td>
      </tr>` : ''}
      <tr>
        <td>Estado :</td>
        <td>${STATUS_LABEL[quote.status] ?? quote.status}</td>
      </tr>
    </table>
  </div>

  <!-- ── Address blocks ── -->
  <div class="addr-row">
    <div class="addr-block">
      <div class="addr-label">Dirección :</div>
      ${companyLines || `<div style="color:#aaa">—</div>`}
    </div>
    <div class="addr-block" style="text-align:right">
      <div class="addr-label">Para :</div>
      ${customerLines}
    </div>
  </div>

  <!-- ── Salesperson bar ── -->
  <table class="meta-bar">
    <thead>
      <tr>
        <th style="width:33%">Vendedor</th>
        <th style="width:33%">Notas</th>
        <th style="width:34%">Fecha de entrega</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${this.escape(seller)}</td>
        <td>${quote.notes ? this.escape(quote.notes) : ''}</td>
        <td>${fmtDate(quote.estimatedDeliveryDate)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ── Items table ── -->
  <table class="items">
    <thead>
      <tr>
        <th class="col-qty tc">Cantidad</th>
        <th>Descripción</th>
        <th class="col-price tr">Precio Unit.</th>
        <th class="col-total tr">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${Array.from({ length: Math.max(0, 4 - quote.items.length) })
        .map(() => '<tr class="filler"><td></td><td></td><td></td><td></td></tr>')
        .join('')}
    </tbody>
  </table>

  <!-- ── Totals ── -->
  <table class="totals-table">
    <tr>
      <td class="spacer" colspan="2" style="border-bottom:1px solid #ddd"></td>
      <td class="t-label" style="width:110px">Subtotal</td>
      <td class="t-value" style="width:110px">${fmt(subtotal)}</td>
    </tr>
    <tr>
      <td class="spacer" colspan="2" style="border-bottom:1px solid #ddd"></td>
      <td class="t-label">IVA</td>
      <td class="t-value">${fmt(tax)}</td>
    </tr>
    <tr>
      <td class="spacer" colspan="2"></td>
      <td class="t-label" style="font-weight:700;color:#222">Total</td>
      <td class="t-value" style="font-weight:700;font-size:13px;color:#222">${fmt(total)}</td>
    </tr>
  </table>

  <!-- ── Footer ── -->
  <div class="footer">
    <div class="footer-line">Cotización preparada por: <strong>${this.escape(seller)}</strong></div>
    <div class="footer-line">Cotización aceptada por: ___________________________________</div>
    <div class="footer-line">Para cualquier consulta, comuníquese con nosotros${email ? ` al correo <strong>${this.escape(email)}</strong>` : ''}.${phone ? ` Tel: <strong>${this.escape(phone)}</strong>` : ''}</div>
    <div class="footer-gen">Generado el ${generatedDate} — ${this.escape(businessName)}</div>
  </div>

</body>
</html>`;
  }

  private escape(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
