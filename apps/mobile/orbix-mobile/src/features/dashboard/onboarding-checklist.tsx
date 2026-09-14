/**
 * Los primeros pasos, en Inicio.
 *
 * Sustituye a la lista decorativa que había: tres filas que se veían y no
 * llevaban a ningún lado, porque `ListRow` ya aceptaba `onPress` y la pantalla
 * no lo pasaba.
 *
 * Se descuelga solo cuando los pasos están hechos — ver `useOnboardingChecklist`,
 * que los deriva del estado real en vez de guardar banderas.
 */
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OrbixCard, OrbixSkeleton, OrbixText } from '@/components';
import { CheckIcon, ChevronRightIcon } from '@/components/ui/icons';
import { Ripple, useRipple } from '@/components/animations/ripple';
import { useTheme } from '@/hooks/use-theme';

import { useOnboardingChecklist, type ChecklistStep } from './use-onboarding-checklist';

function StepRow({ step, isLast }: { step: ChecklistStep; isLast: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const ripple = useRipple();

  return (
    <Pressable
      // Un paso hecho no lleva a ningún sitio: ya cumplió su función.
      onPress={step.done ? undefined : () => router.push(step.route)}
      onPressIn={(event) => {
        if (step.done) return;
        ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      disabled={step.done}
      accessibilityRole="button"
      accessibilityLabel={t(`home.checklist.${step.id}`)}
      accessibilityState={{ checked: step.done, disabled: step.done }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: step.done ? theme.colors.successBg : theme.colors.muted,
          borderWidth: step.done ? 0 : 1.5,
          borderColor: theme.colors.border,
        }}
      >
        {step.done ? <CheckIcon size={13} color={theme.colors.successFg} /> : null}
      </View>

      <OrbixText
        size="sm"
        weight={step.done ? 'regular' : 'medium'}
        tone={step.done ? 'mutedForeground' : 'foreground'}
        numberOfLines={1}
        style={[
          { flex: 1 },
          step.done ? { textDecorationLine: 'line-through' as const } : null,
        ]}
      >
        {t(`home.checklist.${step.id}`)}
      </OrbixText>

      {!step.done ? (
        <ChevronRightIcon size={15} color={theme.colors.mutedForeground} />
      ) : null}

      <Ripple {...ripple} color={theme.colors.brandBlue300} borderRadius={0} />
    </Pressable>
  );
}

function OnboardingChecklistComponent() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { steps, completed, finished, isLoading } = useOnboardingChecklist();

  if (isLoading) {
    return <OrbixSkeleton height={140} radius={theme.radius.xl} />;
  }

  // Terminado, o nada que este usuario pueda hacer: el bloque desaparece.
  if (finished) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ letterSpacing: 0.5 }}>
          {t('home.firstSteps').toUpperCase()}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground" style={{ fontVariant: ['tabular-nums'] }}>
          {t('home.checklist.progress', { done: completed, total: steps.length })}
        </OrbixText>
      </View>

      <OrbixCard padded={false}>
        {steps.map((step, index) => (
          <StepRow key={step.id} step={step} isLast={index === steps.length - 1} />
        ))}
      </OrbixCard>
    </View>
  );
}

export const OnboardingChecklist = memo(OnboardingChecklistComponent);
