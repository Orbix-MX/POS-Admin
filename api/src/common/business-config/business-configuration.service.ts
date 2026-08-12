import { Injectable, NotFoundException, Scope } from '@nestjs/common';
import { BusinessProfile } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../context/tenant-context.service';
import {
  BusinessFeatures,
  buildFeaturesForProfile,
} from './business-features';
import { BusinessConfiguration } from './business-configuration.model';

/**
 * The ONLY authorised facade to read a tenant's business configuration.
 *
 * BP-02: modules outside Platform MUST NOT read `tenant.businessProfile`
 * directly. They go through this service so the verticals stay decoupled from
 * the data model — if the storage of the configuration changes later, no
 * vertical needs to be touched.
 *
 * BP-03: there is now a single unified object (BusinessConfiguration) built by
 * a single constructor. Every public accessor below is a thin wrapper over it
 * — no duplicated construction logic.
 *
 * BP-04: the service is REQUEST-scoped and memoises the configuration for the
 * lifetime of a single request. Nest creates a fresh instance per request, so
 * `cachedConfiguration` is naturally per-request and never survives across
 * requests (no global cache, no shared singleton state). The first accessor
 * builds it once; every subsequent accessor in the same request reuses the
 * exact same instance and hits the database zero additional times. Behaviour
 * is identical to BP-03; this is a performance-only change.
 */
@Injectable({ scope: Scope.REQUEST })
export class BusinessConfigurationService {
  /** Per-request memo. Undefined until the first getConfiguration() call. */
  private cachedConfiguration?: BusinessConfiguration;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * THE single entry point. Builds the configuration once per request and
   * caches it; later calls return the same instance. Every other method
   * reuses this — nothing else builds the configuration.
   */
  async getConfiguration(): Promise<BusinessConfiguration> {
    if (this.cachedConfiguration) return this.cachedConfiguration;
    this.cachedConfiguration = await this.buildConfiguration();
    return this.cachedConfiguration;
  }

  /**
   * Actual construction: resolve the current tenant from request context and
   * derive its feature set. Runs at most once per request via getConfiguration().
   */
  private async buildConfiguration(): Promise<BusinessConfiguration> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessProfile: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      profile: tenant.businessProfile,
      features: buildFeaturesForProfile(tenant.businessProfile),
    };
  }

  /** Current tenant's profile. */
  async getBusinessProfile(): Promise<BusinessProfile> {
    return (await this.getConfiguration()).profile;
  }

  /** Derived feature set for the current tenant's profile. */
  async getBusinessFeatures(): Promise<BusinessFeatures> {
    return (await this.getConfiguration()).features;
  }

  /** Whether a single feature is enabled for the current tenant. */
  async hasFeature(feature: keyof BusinessFeatures): Promise<boolean> {
    return (await this.getConfiguration()).features[feature];
  }

  // Profile predicates. Strict equality to the named profile — they answer
  // "is the tenant exactly this profile", not "does it behave like one".
  async isRetail(): Promise<boolean> {
    return (await this.getConfiguration()).profile === 'RETAIL';
  }

  async isRestaurant(): Promise<boolean> {
    return (await this.getConfiguration()).profile === 'RESTAURANT';
  }

  async isManufacturing(): Promise<boolean> {
    return (await this.getConfiguration()).profile === 'MANUFACTURING';
  }
}
