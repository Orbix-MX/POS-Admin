/**
 * The one row shape the whole Configuración module is built from: icon tile,
 * title, optional description, and a trailing slot that is either a value
 * ("MXN — $"), a "Nuevo"/"Próx." badge, a chevron, or any combination —
 * never a card. Divider lives on the row itself (`isLast`) so a `SettingsSection`
 * doesn't have to special-case its last child.
 *
 * Press feedback is the same `Ripple` every other tappable surface in the app
 * uses (`DrawerRow`, `OrbixButton`) — a flat colour swap on press would have
 * read as a different, less-finished control sitting inside the same shell.
 *
 * 56 px minimum height — above the 44 px accessibility floor with room to
 * spare for a tablet/thumb-first POS, matching the touch targets used
 * elsewhere in the app (`ListRow` is 48; this module wanted more air).
 */
import { memo, useCallback, type ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { ChevronRightIcon } from '@/components/ui/icons';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface SettingsRowProps {
  icon: ReactNode;
  /** Tint behind the icon; defaults to the brand wash used across the app. */
  iconTint?: string;
  title: string;
  description?: string;
  /** Current value, shown inline so the user never has to open the row to know what's set. */
  value?: string;
  badge?: string;
  /**
   * An interactive control (a switch, typically) that owns its own tap
   * target instead of the whole row. Suppresses the chevron — a row with its
   * own control isn't "open this to change it" anymore — and, when there's
   * no `onPress` either, the row itself renders inert (no ripple), so the
   * switch is the only thing that responds to touch.
   */
  trailing?: ReactNode;
  /** Selected state for a master-detail tablet layout — tonal background + accent bar, no chevron. */
  active?: boolean;
  showChevron?: boolean;
  disabled?: boolean;
  danger?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}

function SettingsRowComponent({
  icon,
  iconTint,
  title,
  description,
  value,
  badge,
  trailing,
  active = false,
  showChevron = true,
  disabled = false,
  danger = false,
  isLast = false,
  onPress,
}: SettingsRowProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const interactive = Boolean(onPress) && !disabled;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactive) return;
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [interactive, ripple],
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled, selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 56,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: active ? theme.colors.secondary : 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Selection is a colour + a bar, not just a colour — reads at a glance
          in the tablet master-detail list, where nothing else marks "current". */}
      <View style={{ width: active ? 3 : 0, backgroundColor: theme.colors.primary }} />

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: danger ? theme.colors.dangerBg : (iconTint ?? theme.colors.brandBlue50),
          }}
        >
          {icon}
        </View>

        <View style={{ flex: 1, gap: description ? 2 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <OrbixText
              size="base"
              weight="medium"
              tone={danger ? 'dangerFg' : disabled ? 'mutedForeground' : 'foreground'}
              numberOfLines={1}
            >
              {title}
            </OrbixText>
            {badge ? (
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 1,
                  borderRadius: theme.radius.full,
                  backgroundColor: disabled ? theme.colors.muted : theme.colors.successBg,
                }}
              >
                <OrbixText size="xs" weight="semibold" tone={disabled ? 'mutedForeground' : 'successFg'}>
                  {badge}
                </OrbixText>
              </View>
            ) : null}
          </View>
          {description ? (
            <OrbixText size="sm" tone="mutedForeground" numberOfLines={1}>
              {description}
            </OrbixText>
          ) : null}
        </View>

        {value ? (
          <OrbixText size="sm" weight="semibold" tone={disabled ? 'mutedForeground' : 'foreground'} numberOfLines={1} style={{ maxWidth: 140 }}>
            {value}
          </OrbixText>
        ) : null}

        {trailing}

        {!trailing && showChevron && onPress && !active ? (
          <ChevronRightIcon size={13} color={theme.colors.mutedForeground} />
        ) : null}
      </View>

      {interactive ? <Ripple {...ripple} color={theme.colors.brandBlue300} borderRadius={0} /> : null}
    </Pressable>
  );
}

export const SettingsRow = memo(SettingsRowComponent);
