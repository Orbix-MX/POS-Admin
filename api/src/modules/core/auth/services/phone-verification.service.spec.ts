import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';

import { PhoneVerificationService } from './phone-verification.service';

/**
 * Verificación de teléfono por SMS.
 *
 * Seis dígitos son un millón de combinaciones: se agotan por fuerza bruta en
 * minutos si nadie cuenta los intentos. Estas pruebas cubren las tres defensas
 * —intentos, enfriamiento y tope por número— porque ninguna se ve en una prueba
 * manual: el flujo feliz funciona igual con todas desactivadas.
 */
describe('PhoneVerificationService', () => {
  const USER = 'u1';
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');

  interface Row {
    id: string;
    userId: string;
    phone: string;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    verifiedAt: Date | null;
    consumedAt: Date | null;
    createdAt: Date;
  }

  function build(rows: Row[] = [], smsConfigured = false) {
    const sent: { phone: string; message: string }[] = [];

    const prisma = {
      phoneVerification: {
        findFirst: ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) => {
          let found = rows.filter((r) =>
            Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
          );
          if (orderBy) found = [...found].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return Promise.resolve(found[0] ?? null);
        },
        count: ({ where }: { where: { phone: string; createdAt: { gte: Date } } }) =>
          Promise.resolve(
            rows.filter((r) => r.phone === where.phone && r.createdAt >= where.createdAt.gte).length,
          ),
        updateMany: ({ where, data }: { where: Record<string, unknown>; data: { consumedAt: Date } }) => {
          rows
            .filter((r) => r.userId === where.userId && r.verifiedAt === null && r.consumedAt === null)
            .forEach((r) => (r.consumedAt = data.consumedAt));
          return Promise.resolve({ count: 0 });
        },
        create: ({ data }: { data: Pick<Row, 'userId' | 'phone' | 'codeHash' | 'expiresAt'> }) => {
          // Los defaults van DESPUÉS del spread a propósito: `data` nunca los
          // trae —los pone la base— y ponerlos antes los dejaría pisados por
          // los `undefined` del objeto de entrada.
          const created: Row = {
            ...data,
            id: `v${rows.length + 1}`,
            attempts: 0,
            verifiedAt: null,
            consumedAt: null,
            createdAt: new Date(),
          };
          rows.push(created);
          return Promise.resolve({ id: created.id });
        },
        update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.find((r) => r.id === where.id)!;
          if ('attempts' in data) row.attempts += 1;
          if ('verifiedAt' in data) row.verifiedAt = data.verifiedAt as Date;
          return Promise.resolve(row);
        },
      },
    };

    const sms = {
      isConfigured: smsConfigured,
      send: (phone: string, message: string) => {
        sent.push({ phone, message });
        return Promise.resolve();
      },
    };

    const service = new PhoneVerificationService(prisma as never, sms as never);
    return { service, rows, sent };
  }

  const row = (over: Partial<Row> = {}): Row => ({
    id: 'v1',
    userId: USER,
    phone: '+525512345678',
    codeHash: sha('123456'),
    attempts: 0,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    verifiedAt: null,
    consumedAt: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    ...over,
  });

  describe('normalización del teléfono', () => {
    it('acepta E.164 y devuelve solo los dos últimos dígitos', async () => {
      const { service } = build();
      const out = await service.sendCode(USER, '+525512345678');

      expect(out.maskedPhone).toBe('••78');
      expect(out.resendAfterSeconds).toBe(60);
    });

    it('normaliza espacios y guiones al mismo número', async () => {
      // Si no se normalizara, `+52 55 1234 5678` y `+525512345678` contarían
      // como teléfonos distintos y el tope por número no serviría de nada.
      const { service, rows } = build();
      await service.sendCode(USER, '+52 55-1234 5678');

      expect(rows[0].phone).toBe('+525512345678');
    });

    it('rechaza algo que no es un teléfono', async () => {
      const { service } = build();
      await expect(service.sendCode(USER, 'no-soy-un-telefono')).rejects.toThrow(BadRequestException);
    });

    it('rechaza un número demasiado corto', async () => {
      const { service } = build();
      await expect(service.sendCode(USER, '+5255')).rejects.toThrow(BadRequestException);
    });
  });

  describe('envío', () => {
    it('nunca devuelve el código en la respuesta', async () => {
      // Devolverlo convertiría la verificación en un trámite que cualquiera se
      // salta leyendo la respuesta HTTP.
      const { service } = build();
      const out = await service.sendCode(USER, '+525512345678');

      expect(JSON.stringify(out)).not.toMatch(/\d{6}/);
    });

    it('guarda el hash, no el código', async () => {
      const { service, rows, sent } = build();
      await service.sendCode(USER, '+525512345678');

      const code = sent[0].message.match(/(\d{6})/)![1];
      expect(rows[0].codeHash).toBe(sha(code));
      expect(rows[0].codeHash).not.toBe(code);
    });

    it('manda un código de seis dígitos', async () => {
      const { service, sent } = build();
      await service.sendCode(USER, '+525512345678');

      expect(sent[0].message).toMatch(/\b\d{6}\b/);
    });

    it('invalida el código anterior al mandar uno nuevo', async () => {
      // Un SMS viejo en la bandeja no debe competir con el recién mandado.
      const viejo = row({ createdAt: new Date(Date.now() - 5 * 60 * 1000) });
      const { service, rows } = build([viejo]);
      await service.sendCode(USER, '+525512345678');

      expect(rows[0].consumedAt).not.toBeNull();
      expect(rows[1].consumedAt).toBeNull();
    });
  });

  describe('límites', () => {
    it('exige esperar entre envíos', async () => {
      const { service } = build([row({ createdAt: new Date() })]);

      await expect(service.sendCode(USER, '+525512345678')).rejects.toThrow(/Espera \d+ segundos/);
    });

    it('deja reenviar pasado el enfriamiento', async () => {
      const { service } = build([row({ createdAt: new Date(Date.now() - 61 * 1000) })]);

      await expect(service.sendCode(USER, '+525512345678')).resolves.toMatchObject({
        maskedPhone: '••78',
      });
    });

    it('corta al quinto código para el mismo número, aunque sean cuentas distintas', async () => {
      // Sin esto, registrar cuentas sería una forma gratuita de bombardear a
      // SMS a un desconocido.
      const recientes = Array.from({ length: 5 }, (_, i) =>
        row({
          id: `v${i}`,
          userId: `otro-${i}`,
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
        }),
      );
      const { service } = build(recientes);

      await expect(service.sendCode('usuario-nuevo', '+525512345678')).rejects.toThrow(
        /demasiados códigos/i,
      );
    });

    it('los códigos de hace más de una hora no cuentan para el tope', async () => {
      const viejos = Array.from({ length: 5 }, (_, i) =>
        row({
          id: `v${i}`,
          userId: `otro-${i}`,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
      );
      const { service } = build(viejos);

      await expect(service.sendCode('usuario-nuevo', '+525512345678')).resolves.toBeDefined();
    });
  });

  describe('verificación', () => {
    it('acepta el código correcto', async () => {
      const { service } = build([row()]);
      const out = await service.verifyCode(USER, 'v1', '123456');

      expect(out.verified).toBe(true);
      expect(out.verifiedAt).toBeDefined();
    });

    it('rechaza el código equivocado y cuenta el intento', async () => {
      const { service, rows } = build([row()]);

      await expect(service.verifyCode(USER, 'v1', '000000')).rejects.toThrow(BadRequestException);
      expect(rows[0].attempts).toBe(1);
    });

    it('cierra el código tras cinco fallos', async () => {
      const { service } = build([row({ attempts: 5 })]);

      // Ni siquiera con el código bueno: agotados los intentos, hay que pedir
      // uno nuevo — que cuesta un SMS y espera el enfriamiento.
      await expect(service.verifyCode(USER, 'v1', '123456')).rejects.toThrow(/Demasiados intentos/);
    });

    it('rechaza un código caducado', async () => {
      const { service } = build([row({ expiresAt: new Date(Date.now() - 1000) })]);

      await expect(service.verifyCode(USER, 'v1', '123456')).rejects.toThrow(/caducó/);
    });

    it('rechaza un código ya invalidado por uno más nuevo', async () => {
      const { service } = build([row({ consumedAt: new Date() })]);

      await expect(service.verifyCode(USER, 'v1', '123456')).rejects.toThrow(/ya no sirve/);
    });

    it('NO verifica con el id de otra cuenta', async () => {
      // El `userId` va en el WHERE: sin él, conocer un `verificationId` ajeno
      // bastaría para verificar el teléfono de otro.
      const { service } = build([row()]);

      await expect(service.verifyCode('otro-usuario', 'v1', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('un id inexistente es 404, no un 500', async () => {
      const { service } = build([]);

      await expect(service.verifyCode(USER, 'no-existe', '123456')).rejects.toThrow(NotFoundException);
    });

    it('repetir la verificación de algo ya verificado responde que sí', async () => {
      // Un reintento de red no debe dejar al usuario atascado en la pantalla.
      const verifiedAt = new Date();
      const { service } = build([row({ verifiedAt })]);
      const out = await service.verifyCode(USER, 'v1', '123456');

      expect(out).toEqual({ verified: true, verifiedAt: verifiedAt.toISOString() });
    });

    it('el código se compara recortado', async () => {
      const { service } = build([row()]);

      await expect(service.verifyCode(USER, 'v1', ' 123456 ')).resolves.toMatchObject({
        verified: true,
      });
    });
  });
});
