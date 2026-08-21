import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';

/** Lo mínimo de Prisma que necesita `consume`: sirve el cliente o una transacción. */
type PrismaLike = Pick<PrismaService, 'oAuthTicket'>;

/**
 * Tickets de un solo uso para cerrar el redirect de OAuth.
 *
 * El callback de Google no puede devolver el JWT en el body —termina en una
 * redirección del navegador—, y ponerlo en la URL lo deja en el historial, en
 * el `Referer` y en los logs de cualquier proxy. En su lugar el callback emite
 * un ticket opaco de vida corta y el frontend lo canjea por la sesión real.
 *
 * Igual que los refresh tokens: solo se guarda el SHA-256, el valor crudo se
 * entrega una vez. Canjearlo lo marca usado; un segundo canje falla.
 */
@Injectable()
export class OAuthTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Emite un ticket para un usuario ya autenticado por el proveedor. */
  async issue(userId: string): Promise<string> {
    const ttlSeconds = this.config.get<number>('googleOAuth.ticketTtlSeconds') ?? 120;
    const raw = randomBytes(32).toString('hex');

    await this.prisma.oAuthTicket.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    return raw;
  }

  /**
   * Canjea un ticket y devuelve el userId. Marca el ticket como usado dentro de
   * la misma actualización condicional, así dos canjes simultáneos no pueden
   * resolver ambos.
   *
   * Recibe el cliente a usar para poder correr dentro de la transacción del
   * llamador: marcar el ticket y construir la sesión tienen que caer juntos. Si
   * se marcaba aquí y algo fallaba después —Neon cerrando una conexión ociosa,
   * por ejemplo— el ticket quedaba quemado sin haber entregado sesión, y el
   * reintento del usuario solo veía 401.
   */
  async consume(raw: string, client: PrismaLike = this.prisma): Promise<string> {
    if (!raw) throw new UnauthorizedException('Ticket inválido o expirado');

    const tokenHash = this.hash(raw);
    const { count } = await client.oAuthTicket.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (count === 0) throw new UnauthorizedException('Ticket inválido o expirado');

    const ticket = await client.oAuthTicket.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });

    if (!ticket) throw new UnauthorizedException('Ticket inválido o expirado');
    return ticket.userId;
  }

  /** Limpia tickets vencidos o ya usados. Invocado desde el propio canje. */
  async purgeExpired(): Promise<void> {
    await this.prisma.oAuthTicket
      .deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
        },
      })
      .catch(() => undefined);
  }
}
