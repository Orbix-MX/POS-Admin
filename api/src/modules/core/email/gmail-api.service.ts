import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/** Margen antes de que caduque el access token, para no usarlo justo en el filo. */
const EXPIRY_MARGIN_MS = 60_000;

interface SendParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío por la API de Gmail con OAuth2.
 *
 * Frente a SMTP con App Password: no hay una contraseña permanente de la cuenta
 * en el `.env`, el acceso se revoca desde la propia cuenta de Google, y el
 * permiso concedido es solo `gmail.send` — enviar. El scope clásico
 * `https://mail.google.com/` habría dado también lectura y borrado de todo el
 * buzón, que es mucho más de lo que hace falta.
 *
 * Reutiliza el cliente OAuth que ya existe para el login con Google; lo único
 * propio es el refresh token de la cuenta remitente.
 */
@Injectable()
export class GmailApiService {
  private readonly logger = new Logger(GmailApiService.name);

  /** Los access token duran ~1h; se cachea para no pedir uno por correo. */
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  /** True cuando hay credenciales suficientes para enviar por Gmail. */
  isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN &&
        process.env.GMAIL_SENDER,
    );
  }

  /**
   * Canjea el refresh token por un access token, reutilizando el vigente.
   *
   * El refresh token es la credencial de larga vida: nunca se registra ni se
   * expone en errores.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      // El cuerpo de Google trae `error_description`, útil y sin secretos.
      const detail = await response.text().catch(() => '');
      this.logger.error(`No se pudo renovar el token de Gmail: ${response.status} ${detail}`);
      throw new InternalServerErrorException(
        'No se pudo autenticar contra Gmail para enviar el correo.',
      );
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  /**
   * Codifica el mensaje como MIME en base64url, que es lo que espera la API.
   *
   * El asunto va en base64 (RFC 2047) para que los acentos no lleguen rotos.
   */
  private buildRawMessage({ to, subject, html }: SendParams): string {
    const from = process.env.GMAIL_SENDER!;
    const fromName = process.env.GMAIL_SENDER_NAME ?? 'Orbix ERP';
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

    const mime = [
      `From: ${fromName} <${from}>`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
    ].join('\r\n');

    return Buffer.from(mime, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async send(params: SendParams): Promise<{ messageId: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: this.buildRawMessage(params) }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Gmail rechazó el envío: ${response.status} ${detail}`);
      throw new InternalServerErrorException('No se pudo enviar el correo.');
    }

    const data = (await response.json()) as { id: string };
    return { messageId: data.id };
  }
}
