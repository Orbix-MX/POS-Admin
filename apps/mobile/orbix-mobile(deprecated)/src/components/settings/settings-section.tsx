/**
 * Uppercase section label + a bordered, unpadded `OrbixCard` grouping its
 * children — the same "flat rows inside a bordered surface" pattern
 * `settings.tsx` already used for Apariencia, generalised so every section in
 * the module looks identical.
 *
 * `tone="danger"` swaps the card to the danger tokens (`dangerBg`/`dangerFg`)
 * instead of the neutral surface — used exactly once, for "Borrar datos": a
 * destructive zone that only reads as one row inside an identical grey card
 * doesn't feel destructive. Still zero new colours; both tokens already exist
 * for this.
 *
 * Deliberately doesn't auto-stamp `isLast` on its children: a section mixes
 * `SettingsRow`, `SettingsOptionRow` and the occasional plain sub-header
 * `View`, and cloning an unknown prop onto that last one is a type error
 * waiting to happen. Callers pass `isLast` on the actual last row instead.
 */
import { memo, type ReactNode } from 'react';
import { View } from 'react-native';

import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface SettingsSectionProps {
  title?: string;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

function SettingsSectionComponent({ title, tone = 'default', children }: SettingsSectionProps) {
  const theme = useTheme();
  const danger = tone === 'danger';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title ? (
        <OrbixText
          size="xs"
          weight="semibold"
          tone={danger ? 'dangerFg' : 'mutedForeground'}
          style={{ marginLeft: theme.spacing.xs, letterSpacing: 0.5, textTransform: 'uppercase' }}
        >
          {title}
        </OrbixText>
      ) : null}
      <OrbixCard
        padded={false}
        elevation="none"
        style={danger ? { borderColor: theme.colors.dangerFg, borderWidth: 1.5 } : undefined}
      >
        {children}
      </OrbixCard>
    </View>
  );
}

export const SettingsSection = memo(SettingsSectionComponent);
