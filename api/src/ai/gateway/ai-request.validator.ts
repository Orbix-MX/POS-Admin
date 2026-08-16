import { Injectable } from '@nestjs/common';
import { AiFeatureDef, getFeatureDef } from '../contracts/ai-feature.registry';
import { AiInvocation } from '../contracts/ai-invocation.types';
import { AiException } from '../contracts/ai-error';

/**
 * Primer paso del pipeline (§03): verifica que la feature exista antes de
 * gastar nada. En v1 no hay gating por plan todavía (Fase 3, con Product
 * Assistant) — una `featureKey` no registrada es indistinguible, desde el
 * llamador, de una feature apagada, así que ambas devuelven el mismo
 * código: `AI_FEATURE_DISABLED`.
 */
@Injectable()
export class AiRequestValidator {
  validate(invocation: AiInvocation): AiFeatureDef {
    const featureDef = getFeatureDef(invocation.featureKey);
    if (!featureDef) {
      throw new AiException(
        'AI_FEATURE_DISABLED',
        `La función de IA "${invocation.featureKey}" no está disponible.`,
      );
    }
    return featureDef;
  }
}
