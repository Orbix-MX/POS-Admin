import { Injectable } from '@nestjs/common';
import { AIProvider } from './ai-provider.port';

/**
 * id → instancia. Poblado explícitamente en `AiModule` (no por auto-discovery):
 * qué proveedores existen es una decisión de arranque, no un efecto de qué
 * clases estén decoradas. Ver ADR-0025.
 */
@Injectable()
export class AiProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  resolve(providerId: string): AIProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(
        `AiProviderRegistry: no hay un proveedor registrado con id "${providerId}"`,
      );
    }
    return provider;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /** Usado por el poller de salud (§12) — no por el gateway, que siempre resuelve por id. */
  list(): AIProvider[] {
    return [...this.providers.values()];
  }
}
