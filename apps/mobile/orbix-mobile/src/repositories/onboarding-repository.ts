/**
 * Repository for the self-service onboarding endpoints.
 *
 * Todos apuntan ya a endpoints reales. El contrato completo sigue documentado
 * en `src/dto/onboarding.dto.ts`, que es donde se escribió antes de que el
 * backend existiera.
 *
 * **La verificación por SMS depende de que haya proveedor contratado.** Sin él,
 * el servidor responde 503 en producción y en desarrollo escribe el código en
 * su propio log — nunca en la respuesta. Así que un 503 aquí no es un fallo del
 * cliente: es la ausencia del proveedor, y el wizard deja continuar sin
 * verificar.
 */
import type {
  CreateTenantOnboardingRequestDto,
  CreateTenantOnboardingResponseDto,
  SendPhoneCodeRequestDto,
  SendPhoneCodeResponseDto,
  VerifyPhoneCodeRequestDto,
  VerifyPhoneCodeResponseDto,
} from '@/dto/onboarding.dto';
import { http } from '@/services/api';

/** Se enciende por endpoint conforme el backend los publica. */
export const ONBOARDING_ENDPOINTS_AVAILABLE = {
  phoneVerification: true,
  tenantOnboarding: true,
} as const;

export const onboardingRepository = {

  /**
   * `POST /api/auth/phone/send-code` (Bearer).
   *
   * El servidor impone un enfriamiento por usuario y un tope por número: el
   * contador de 60 s que pinta la UI es una cortesía, no la defensa. Un 400 de
   * «espera N segundos» es una respuesta esperable y hay que mostrarla, no
   * tratarla como avería.
   */
  async sendPhoneCode(request: SendPhoneCodeRequestDto): Promise<SendPhoneCodeResponseDto> {
    return http.post<SendPhoneCodeResponseDto>('/auth/phone/send-code', request);
  },

  /**
   * `POST /api/auth/phone/verify-code` (Bearer).
   *
   * Cinco intentos por código: al sexto hay que pedir uno nuevo.
   */
  async verifyPhoneCode(request: VerifyPhoneCodeRequestDto): Promise<VerifyPhoneCodeResponseDto> {
    return http.post<VerifyPhoneCodeResponseDto>('/auth/phone/verify-code', request);
  },

  /**
   * `POST /api/tenants/onboarding` (Bearer, any authenticated user without a
   * tenant yet). Provisions the company on the FREE plan with only the
   * essentials: name, vertical, main branch and Owner membership/role.
   *
   * Contract: {@link CreateTenantOnboardingRequestDto} →
   * {@link CreateTenantOnboardingResponseDto}
   */
  async createTenant(
    request: CreateTenantOnboardingRequestDto,
  ): Promise<CreateTenantOnboardingResponseDto> {
    return http.post<CreateTenantOnboardingResponseDto>('/tenants/onboarding', request);
  },
} as const;
