import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export type PinAttemptScopeName = 'DEVICE' | 'USER';

/** Fallos seguidos que disparan el primer bloqueo. */
export const PIN_LOCKOUT_THRESHOLD = 5;
/** Espera del primer bloqueo; se duplica cada `PIN_LOCKOUT_THRESHOLD` fallos más. */
export const PIN_LOCKOUT_BASE_MINUTES = 1;
export const PIN_LOCKOUT_MAX_MINUTES = 60;
/** Un último fallo más viejo que esto no cuenta: el contador vuelve a empezar. */
export const PIN_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Un acierto solo limpia el contador si el último fallo es más viejo que esto.
 *
 * Si acertar limpiara siempre, un cajero con su PIN propio podría alternar 4 intentos contra el PIN de un
 * supervisor y 1 acierto con el suyo, y no llegar nunca al umbral. Así, el ritmo sin bloqueo es de ~4
 * intentos por hora; un error de dedo suelto se olvida solo en el siguiente acierto tras una hora de calma.
 */
export const PIN_SUCCESS_RESET_AFTER_MS = 60 * 60 * 1000;

/** ¿El error es "la tabla pin_attempts no existe" (código desplegado antes que su migración)? */
export function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: string; message?: string; meta?: { code?: string } } | null;
  return (
    err?.code === 'P2021' ||
    (err?.code === 'P2010' && err.meta?.code === '42P01') ||
    /relation "?pin_attempts"? does not exist/i.test(err?.message ?? '')
  );
}

/**
 * Tope de intentos de PIN, por QUIEN los hace.
 *
 * El PIN identifica al empleado él solo, así que un intento fallido no tiene empleado al que contarle el
 * fallo: el contador cuelga del dispositivo (login por PIN) o de la sesión de usuario (operador,
 * verificación y autorizaciones de caja). El de usuario es el mismo para todas esas superficies, para que
 * cambiar de endpoint no multiplique el presupuesto. No se bloquea por empleado a propósito: cualquiera
 * podría bloquear a un supervisor probando PINs erróneos contra él.
 *
 * El estado vive en la base, no en memoria: el límite por IP del controlador es por instancia y no frena
 * un ataque repartido.
 *
 * Si la tabla no existe (el código llegó antes que la migración), el servicio NO tumba el login por PIN de
 * todos: deja pasar y registra un error por intento. Cualquier otro fallo de la base sí se propaga.
 *
 * @odd bloqueo-por-intentos-de-pin T-001
 */
@Injectable()
export class PinAttemptService {
  private readonly logger = new Logger(PinAttemptService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Minutos de espera tras `attempts` fallos seguidos (0 = todavía no bloquea). */
  static lockMinutes(attempts: number): number {
    if (attempts < PIN_LOCKOUT_THRESHOLD) return 0;
    const doublings = Math.floor((attempts - PIN_LOCKOUT_THRESHOLD) / PIN_LOCKOUT_THRESHOLD);
    return Math.min(PIN_LOCKOUT_BASE_MINUTES * 2 ** doublings, PIN_LOCKOUT_MAX_MINUTES);
  }

  /** Lanza 429 `PIN_LOCKED` si este principal está en espera. Va ANTES de evaluar el PIN. */
  async assertNotLocked(scope: PinAttemptScopeName, scopeKey: string): Promise<void> {
    const row = await this.degradeIfMissingTable(() =>
      this.prisma.pinAttempt.findUnique({
        where: { scope_scopeKey: { scope, scopeKey } },
        select: { lockedUntil: true },
      }),
    );
    if (row?.lockedUntil && row.lockedUntil > new Date()) {
      const retryAfterSeconds = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'PIN_LOCKED',
          message: 'Demasiados intentos de PIN. Espera un momento antes de volver a intentar.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Cuenta un fallo y, si toca, fija el bloqueo. El incremento es atómico en SQL (dos fallos simultáneos
   * cuentan dos): leer, sumar y escribir dejaría a un atacante en paralelo pasar de largo el umbral.
   */
  async registerFailure(scope: PinAttemptScopeName, scopeKey: string): Promise<void> {
    await this.degradeIfMissingTable(async () => {
      const staleBefore = new Date(Date.now() - PIN_ATTEMPT_WINDOW_MS);
      const rows = await this.prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO pin_attempts (id, scope, scope_key, attempts, last_failed_at, updated_at)
        VALUES (${randomUUID()}, ${scope}::"PinAttemptScope", ${scopeKey}, 1, NOW(), NOW())
        ON CONFLICT (scope, scope_key) DO UPDATE SET
          attempts = CASE WHEN pin_attempts.last_failed_at < ${staleBefore}
                          THEN 1 ELSE pin_attempts.attempts + 1 END,
          last_failed_at = NOW(),
          updated_at = NOW()
        RETURNING attempts`;

      const attempts = Number(rows[0].attempts);
      const minutes = PinAttemptService.lockMinutes(attempts);
      if (minutes > 0) {
        const until = new Date(Date.now() + minutes * 60_000);
        // GREATEST: si dos fallos concurrentes calculan esperas distintas, gana la mayor.
        await this.prisma.$executeRaw`
          UPDATE pin_attempts
             SET locked_until = GREATEST(COALESCE(locked_until, ${until}), ${until})
           WHERE scope = ${scope}::"PinAttemptScope" AND scope_key = ${scopeKey}`;
        // Como el bloqueo de contraseña: queda rastro para detectar un ataque en curso.
        this.logger.warn(
          `PIN bloqueado ${minutes} min tras ${attempts} fallos seguidos: ${scope} ${scopeKey.slice(0, 8)}…`,
        );
      }
    });
  }

  /**
   * Un PIN acertado limpia el contador, pero solo si el último fallo ya es viejo (ver
   * `PIN_SUCCESS_RESET_AFTER_MS`): acertar justo después de fallar no borra los fallos.
   */
  async registerSuccess(scope: PinAttemptScopeName, scopeKey: string): Promise<void> {
    await this.degradeIfMissingTable(() =>
      this.prisma.pinAttempt.updateMany({
        where: {
          scope,
          scopeKey,
          lastFailedAt: { lt: new Date(Date.now() - PIN_SUCCESS_RESET_AFTER_MS) },
          OR: [{ attempts: { gt: 0 } }, { lockedUntil: { not: null } }],
        },
        data: { attempts: 0, lockedUntil: null },
      }),
    );
  }

  /**
   * Despliegue en desorden (código antes que migración): el login por PIN de TODOS no puede caer por una
   * tabla ausente. Se deja pasar y se grita en el log; cualquier otro error de la base se propaga.
   */
  private async degradeIfMissingTable<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
      this.logger.error(
        'La tabla pin_attempts no existe: el tope de intentos de PIN está DESACTIVADO. Aplica `prisma migrate deploy`.',
      );
      return undefined;
    }
  }
}
