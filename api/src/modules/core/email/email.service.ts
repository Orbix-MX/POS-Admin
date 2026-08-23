import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Order, OrderItem, Customer, CustomerAddress, Payment } from '@prisma/client';
import { generateReceiptHTML } from './templates/receipt.template';
import { generateInvitationHTML } from './templates/invitation.template';
import { GmailApiService } from './gmail-api.service';

@Injectable()
export class EmailService {
  constructor(private readonly gmail: GmailApiService) {}

  private transporter: Transporter | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly logger = new Logger(EmailService.name);

  private async initializeTransporter() {
    if (this.transporter) return; // Ya inicializado

    if (this.initPromise) {
      // Ya se está inicializando, esperar a que termine
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        // Configuración personalizada desde variables de entorno
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        this.logger.log('Email transporter configured with custom SMTP');
      } else {
        // Modo desarrollo: crear cuenta de prueba en Ethereal
        try {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          this.logger.warn(
            `Email transporter configured with Ethereal test account: ${testAccount.user}`,
          );
          this.logger.warn(
            'To configure real email, set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
          );
        } catch (error) {
          this.logger.error('Failed to create test email account', error);
          // Fallback: configuración sin autenticación (solo para desarrollo local)
          this.transporter = nodemailer.createTransport({
            host: 'localhost',
            port: 1025,
            secure: false,
          });
        }
      }
    })();

    await this.initPromise;
  }

  /**
   * Invitación para unirse a una empresa.
   *
   * Si el envío falla se propaga el error: a diferencia de un recibo, aquí el
   * correo ES el flujo — dar la invitación por buena sin haberla enviado deja a
   * la persona esperando un mensaje que nunca llega.
   */
  async sendTenantInvitation(params: {
    to: string;
    tenantName: string;
    acceptUrl: string;
    expiresAt: Date;
  }): Promise<{ messageId: string; previewUrl?: string }> {
    const subject = `Te invitaron a ${params.tenantName} en Orbix ERP`;
    const html = generateInvitationHTML(params);

    // Gmail cuando hay credenciales; si no, el transporte de nodemailer, que en
    // desarrollo cae a Ethereal y permite leer el correo sin configurar nada.
    if (this.gmail.isConfigured()) {
      const { messageId } = await this.gmail.send({ to: params.to, subject, html });
      this.logger.log(`Invitación enviada por Gmail a ${params.to}`);
      return { messageId };
    }

    await this.initializeTransporter();

    const from = process.env.SMTP_FROM || `"Orbix ERP" <${process.env.SMTP_USER ?? 'no-reply@orbix.local'}>`;

    const info = await this.transporter!.sendMail({
      from,
      to: params.to,
      subject,
      html,
    });

    // Con Ethereal (dev) nodemailer da una URL para leer el correo enviado.
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      this.logger.log(`Invitación enviada (preview): ${previewUrl}`);
    }

    return { messageId: info.messageId, previewUrl: previewUrl as string | undefined };
  }

  async sendReceipt(
    email: string,
    order: Order & {
      items: OrderItem[];
      customer: Customer;
      shippingAddress: CustomerAddress;
      payment: Payment | null;
    },
  ): Promise<{ success: boolean; messageId?: string; previewUrl?: string }> {
    try {
      await this.initializeTransporter();

      const storeName = process.env.STORE_NAME || 'Mi Tienda';
      const storeAddress = process.env.STORE_ADDRESS;
      const storePhone = process.env.STORE_PHONE;
      const storeEmail = process.env.STORE_EMAIL || 'info@store.com';

      const html = generateReceiptHTML({
        order,
        storeName,
        storeAddress,
        storePhone,
        storeEmail,
      });

      const info = await this.transporter!.sendMail({
        from: `"${storeName}" <${storeEmail}>`,
        to: email,
        subject: `Ticket de Compra - ${order.orderNumber}`,
        html,
      });

      this.logger.log(`Receipt email sent to ${email}, messageId: ${info.messageId}`);

      // Si estamos usando Ethereal, generar URL de preview
      const previewUrl = nodemailer.getTestMessageUrl(info);

      if (previewUrl) {
        this.logger.log(`Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to send receipt email to ${email}`, error);
      return { success: false };
    }
  }

  async sendOrderConfirmation(
    email: string,
    order: Order & {
      items: OrderItem[];
      customer: Customer;
    },
  ): Promise<{ success: boolean }> {
    try {
      await this.initializeTransporter();

      const storeName = process.env.STORE_NAME || 'Mi Tienda';
      const storeEmail = process.env.STORE_EMAIL || 'info@store.com';

      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>¡Orden Confirmada!</h2>
            <p>Hola ${order.customer.firstName},</p>
            <p>Tu orden <strong>${order.orderNumber}</strong> ha sido confirmada.</p>
            <p>Total: $${Number(order.total).toFixed(2)}</p>
            <p>Te notificaremos cuando tu pedido sea enviado.</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Gracias por tu compra en ${storeName}</p>
          </body>
        </html>
      `;

      await this.transporter!.sendMail({
        from: `"${storeName}" <${storeEmail}>`,
        to: email,
        subject: `Orden Confirmada - ${order.orderNumber}`,
        html,
      });

      this.logger.log(`Order confirmation sent to ${email}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${email}`, error);
      return { success: false };
    }
  }

  async sendWelcomeEmail(email: string, customerName: string): Promise<{ success: boolean }> {
    try {
      await this.initializeTransporter();

      const storeName = process.env.STORE_NAME || 'Mi Tienda';
      const storeEmail = process.env.STORE_EMAIL || 'info@store.com';

      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>¡Bienvenido a ${storeName}!</h2>
            <p>Hola ${customerName},</p>
            <p>Gracias por registrarte en nuestra tienda.</p>
            <p>Estamos emocionados de tenerte como parte de nuestra comunidad.</p>
            <p>¡Felices compras!</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">${storeName}</p>
          </body>
        </html>
      `;

      await this.transporter!.sendMail({
        from: `"${storeName}" <${storeEmail}>`,
        to: email,
        subject: `Bienvenido a ${storeName}`,
        html,
      });

      this.logger.log(`Welcome email sent to ${email}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
      return { success: false };
    }
  }
}
