import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';

const TTL_SECONDS = 300;

/**
 * Tickets de un solo uso que autorizan "vincular con Google" para un usuario
 * ya autenticado en Configuración → Mi cuenta.
 *
 * El redirect a Google es una navegación completa del navegador, no un fetch:
 * no hay forma de mandar el `Authorization: Bearer` de la sesión en ese viaje.
 * Este ticket es el puente — se emite mientras hay sesión, viaja opaco dentro
 * del `state` de OAuth, y el callback lo canjea para saber a qué usuario
 * atar la identidad de Google, en vez de tener que adivinarlo por correo como
 * hace el login público (`AuthService.resolveGoogleIdentity`).
 */
@Injectable()
export class GoogleLinkTicketService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issue(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');

    await this.prisma.googleLinkTicket.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
      },
    });

    return raw;
  }

  /** Canjea el ticket y devuelve el userId que pidió vincular. Un solo uso. */
  async consume(raw: string): Promise<string> {
    if (!raw) throw new UnauthorizedException('Enlace de vinculación inválido o expirado');

    const tokenHash = this.hash(raw);
    const { count } = await this.prisma.googleLinkTicket.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (count === 0) throw new UnauthorizedException('Enlace de vinculación inválido o expirado');

    const ticket = await this.prisma.googleLinkTicket.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });

    if (!ticket) throw new UnauthorizedException('Enlace de vinculación inválido o expirado');
    return ticket.userId;
  }

  async purgeExpired(): Promise<void> {
    await this.prisma.googleLinkTicket
      .deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
        },
      })
      .catch(() => undefined);
  }
}
