import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CashSessionsService } from './cash-sessions.service';

/**
 * @odd aislamiento-de-cupones T-003 (A-2)
 * El autorizador de caja (correo + contraseña de un administrador) se busca por correo GLOBAL. Un cajero de una empresa
 * no debe poder bloquear la cuenta de un usuario de otra (contándole fallos de contraseña) ni usar la respuesta para
 * comprobar si una contraseña ajena es válida: todo lo que no sea un autorizador ACTIVO de esta empresa recibe el mismo
 * mensaje genérico, con la contraseña correcta o no, y sin tocar la cuenta.
 */

const TENANT = 'tenant-1';
const PASSWORD = 'contraseña-del-admin';
const GENERIC = 'Credenciales del autorizador incorrectas';

let hash: string;
beforeAll(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
});

function build(opts: { member?: 'ACTIVE' | 'INACTIVE' | null; role?: string; permissions?: string[]; noUser?: boolean } = {}) {
  const { member = 'ACTIVE', role = 'USER', permissions = [] } = opts;
  const user = {
    id: 'user-admin', email: 'admin@x.com', password: hash, status: 'ACTIVE', role,
    failedLoginAttempts: 0, lockedUntil: null as Date | null,
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(opts.noUser ? null : user),
      update: jest.fn().mockResolvedValue({}),
    },
    tenantMembership: { findFirst: jest.fn().mockResolvedValue(member ? { status: member } : null) },
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([{ role: { permissions: permissions.map((key) => ({ permission: { key } })) } }]),
    },
    userPermissionGrant: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new CashSessionsService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => null } as never,
    { getUserId: () => 'cajero' } as never,
    { log: jest.fn() } as never,
    {} as never,
    { get: () => 'irrelevante' } as never,
    { assertNotLocked: jest.fn(), registerFailure: jest.fn(), registerSuccess: jest.fn() } as never,
  );
  const verify = (authPassword: string) => service.verifyCloseAuth({ authEmail: 'admin@x.com', authPassword });
  return { verify, prisma };
}

const messageOf = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as Error).message;

describe('verifyAuthorizer — aislamiento entre empresas (A-2)', () => {
  it('una cuenta de OTRA empresa con la contraseña INCORRECTA: genérico y no se toca la cuenta (antes se le contaba el fallo)', async () => {
    const { verify, prisma } = build({ member: null });

    await expect(verify('mal')).rejects.toThrow(new ForbiddenException(GENERIC));

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('una cuenta de OTRA empresa con la contraseña CORRECTA: el MISMO mensaje genérico (antes revelaba que era válida)', async () => {
    const { verify, prisma } = build({ member: null });

    await expect(verify(PASSWORD)).rejects.toThrow(new ForbiddenException(GENERIC));

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('no distingue "no existe", "es de otra empresa" ni "membresía inactiva": el mensaje es idéntico', async () => {
    const missing = await messageOf(build({ noUser: true }).verify(PASSWORD));
    const foreign = await messageOf(build({ member: null }).verify(PASSWORD));
    const inactive = await messageOf(build({ member: 'INACTIVE' }).verify(PASSWORD));

    expect(foreign).toBe(missing);
    expect(inactive).toBe(missing);
  });

  it('una membresía INACTIVE tampoco cuenta fallos contra la cuenta', async () => {
    const { verify, prisma } = build({ member: 'INACTIVE' });

    await expect(verify('mal')).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('la pertenencia se consulta con el tenant de la sesión y el usuario encontrado', async () => {
    const { verify, prisma } = build({ member: null });

    await verify('mal').catch(() => undefined);

    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-admin', tenantId: TENANT } });
  });
});

describe('verifyAuthorizer — el autorizador legítimo de la empresa sigue como antes', () => {
  it('miembro activo con contraseña incorrecta: genérico y SÍ se cuenta el fallo (protege su contraseña)', async () => {
    const { verify, prisma } = build();

    await expect(verify('mal')).rejects.toThrow(new ForbiddenException(GENERIC));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-admin' },
      data: expect.objectContaining({ failedLoginAttempts: 1 }),
    });
  });

  it('miembro activo con la contraseña correcta pero sin el permiso: mensaje específico (solo alcanzable siendo de la empresa)', async () => {
    const { verify } = build({ permissions: [] });

    await expect(verify(PASSWORD)).rejects.toThrow('no tiene permiso para autorizar esta operación');
  });

  it('miembro activo con la contraseña y el permiso correctos: autoriza', async () => {
    const { verify } = build({ permissions: ['pos.cash:close'] });

    await expect(verify(PASSWORD)).resolves.toEqual({ email: 'admin@x.com' });
  });

  it('SUPER_ADMIN miembro de la empresa autoriza sin revisar permisos', async () => {
    const { verify, prisma } = build({ role: 'SUPER_ADMIN' });

    await expect(verify(PASSWORD)).resolves.toEqual({ email: 'admin@x.com' });

    expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
  });
});
