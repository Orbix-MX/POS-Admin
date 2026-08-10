import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const ORDERABLE_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];

/**
 * Resolves which tenant a public storefront request belongs to, based on the
 * request's Origin (the e-commerce site's own domain) rather than a tenantId
 * supplied by the client. This lets the same e-commerce build run unmodified
 * on any number of tenant domains — onboarding a tenant is a `Domain` row +
 * DNS, never a code change.
 */
@Injectable()
export class DomainResolverService {
  constructor(private prisma: PrismaService) {}

  private extractHostname(origin?: string | null): string | null {
    if (!origin) return null;
    try {
      return new URL(origin).host; // includes port, e.g. "localhost:4321"
    } catch {
      return null;
    }
  }

  /** Tenant id for an Origin, or null if unknown/unverified/not orderable. */
  async resolveTenantIdByOrigin(origin?: string | null): Promise<string | null> {
    const hostname = this.extractHostname(origin);
    if (!hostname) return null;

    const domain = await this.prisma.domain.findUnique({
      where: { hostname },
      select: { verified: true, tenant: { select: { id: true, status: true } } },
    });

    if (!domain || !domain.verified) return null;
    if (!ORDERABLE_TENANT_STATUSES.includes(domain.tenant.status)) return null;

    return domain.tenant.id;
  }

  /** Whether an Origin maps to a known, verified tenant domain — used by CORS. */
  async isKnownStorefrontOrigin(origin: string): Promise<boolean> {
    const hostname = this.extractHostname(origin);
    if (!hostname) return false;

    const domain = await this.prisma.domain.findUnique({
      where: { hostname },
      select: { verified: true },
    });
    return domain?.verified ?? false;
  }
}
