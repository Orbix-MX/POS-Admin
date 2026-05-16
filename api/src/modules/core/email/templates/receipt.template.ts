import { Order, OrderItem, Customer, CustomerAddress, Payment } from '@prisma/client';

export interface ReceiptData {
  order: Order & {
    items: OrderItem[];
    customer: Customer;
    shippingAddress: CustomerAddress;
    payment: Payment | null;
  };
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
}

export function generateReceiptHTML(data: ReceiptData): string {
  const { order, storeName, storeAddress, storePhone, storeEmail } = data;

  const formatCurrency = (amount: number | string | any) => {
    return `$${Number(amount).toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      credit_card: 'Tarjeta de Crédito',
      debit_card: 'Tarjeta de Débito',
      transfer: 'Transferencia',
      other: 'Otro',
    };
    return labels[method] || method;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmada',
      PROCESSING: 'En Proceso',
      SHIPPED: 'Enviada',
      DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada',
      REFUNDED: 'Reembolsada',
    };
    return labels[status] || status;
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket de Compra - ${order.orderNumber}</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .receipt-container {
      background-color: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .store-name {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .store-info {
      font-size: 14px;
      color: #666;
      margin: 5px 0;
    }
    .order-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    .order-info div {
      flex: 1;
    }
    .label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .value {
      font-size: 16px;
      color: #333;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin: 30px 0 15px 0;
      color: #333;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
      font-size: 14px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
    }
    .text-right {
      text-align: right;
    }
    .totals {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #333;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
    }
    .total-row.grand-total {
      font-size: 20px;
      font-weight: bold;
      color: #2563eb;
      padding-top: 15px;
      border-top: 2px solid #e0e0e0;
      margin-top: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #666;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .customer-info {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-confirmed { background-color: #d1fae5; color: #065f46; }
    .status-pending { background-color: #fef3c7; color: #92400e; }
    .status-processing { background-color: #dbeafe; color: #1e40af; }
    .status-delivered { background-color: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="store-name">${storeName}</div>
      ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
      ${storePhone ? `<div class="store-info">Tel: ${storePhone}</div>` : ''}
      ${storeEmail ? `<div class="store-info">${storeEmail}</div>` : ''}
    </div>

    <div class="order-info">
      <div>
        <div class="label">Número de Orden</div>
        <div class="value">${order.orderNumber}</div>
      </div>
      <div>
        <div class="label">Fecha</div>
        <div class="value">${formatDate(order.createdAt)}</div>
      </div>
      <div>
        <div class="label">Estado</div>
        <div class="value">
          <span class="status-badge status-${order.status.toLowerCase()}">${getStatusLabel(order.status)}</span>
        </div>
      </div>
    </div>

    <div class="customer-info">
      <div class="label">Cliente</div>
      <div class="value">${order.customer.firstName} ${order.customer.lastName}</div>
      ${order.customer.email !== 'walkin@store.local' ? `<div style="margin-top: 5px; font-size: 14px;">${order.customer.email}</div>` : ''}
      ${order.customer.phone ? `<div style="margin-top: 5px; font-size: 14px;">Tel: ${order.customer.phone}</div>` : ''}
    </div>

    <h2 class="section-title">Productos</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>SKU</th>
          <th class="text-right">Cant.</th>
          <th class="text-right">Precio Unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${order.items
          .map(
            (item) => `
        <tr>
          <td>${item.name}</td>
          <td style="color: #666; font-size: 14px;">${item.sku ?? ''}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.price)}</td>
          <td class="text-right">${formatCurrency(item.total)}</td>
        </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(order.subtotal)}</span>
      </div>
      ${
        Number(order.discount) > 0
          ? `
      <div class="total-row" style="color: #059669;">
        <span>Descuento${order.couponCode ? ` (${order.couponCode})` : ''}:</span>
        <span>-${formatCurrency(order.discount)}</span>
      </div>
      `
          : ''
      }
      ${
        Number(order.tax) > 0
          ? `
      <div class="total-row">
        <span>Impuestos:</span>
        <span>${formatCurrency(order.tax)}</span>
      </div>
      `
          : ''
      }
      ${
        Number(order.shippingCost) > 0
          ? `
      <div class="total-row">
        <span>Envío:</span>
        <span>${formatCurrency(order.shippingCost)}</span>
      </div>
      `
          : ''
      }
      <div class="total-row grand-total">
        <span>TOTAL:</span>
        <span>${formatCurrency(order.total)}</span>
      </div>
    </div>

    ${
      order.payment
        ? `
    <h2 class="section-title">Información de Pago</h2>
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
      <div class="total-row" style="padding: 0;">
        <span>Método de Pago:</span>
        <span style="font-weight: 600;">${getPaymentMethodLabel(order.payment.paymentMethod)}</span>
      </div>
      <div class="total-row" style="padding: 0;">
        <span>Estado de Pago:</span>
        <span style="font-weight: 600; color: ${order.payment.status === 'PAID' ? '#059669' : '#d97706'};">
          ${order.payment.status === 'PAID' ? 'Pagado' : order.payment.status === 'PENDING' ? 'Pendiente' : 'Fallido'}
        </span>
      </div>
      ${
        order.payment.transactionId
          ? `
      <div class="total-row" style="padding: 0; font-size: 12px; color: #666;">
        <span>ID de Transacción:</span>
        <span>${order.payment.transactionId}</span>
      </div>
      `
          : ''
      }
    </div>
    `
        : ''
    }

    ${
      order.notes
        ? `
    <h2 class="section-title">Notas</h2>
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107;">
      ${order.notes}
    </div>
    `
        : ''
    }

    <div class="footer">
      <p><strong>¡Gracias por tu compra!</strong></p>
      <p>Este es un comprobante electrónico generado automáticamente.</p>
      <p style="margin-top: 20px; font-size: 10px; color: #999;">
        Si tienes alguna pregunta sobre tu pedido, por favor contáctanos.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
