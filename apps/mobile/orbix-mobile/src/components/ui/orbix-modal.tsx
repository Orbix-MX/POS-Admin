/**
 * Centered dialog, matching the prototype's "¿Eliminar producto?" card:
 * popover surface, bordered footer, destructive action on the right.
 *
 * Uses the RN `Modal` (not a sheet) because a confirmation must interrupt.
 */
import { memo, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { OrbixButton } from '@/components/buttons/orbix-button';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface OrbixModalProps {
  visible: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm?: () => void;
  onDismiss: () => void;
}

function OrbixModalComponent({
  visible,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onDismiss,
}: OrbixModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing['2xl'],
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        {/* Tapping the scrim dismisses, as on both platforms' native dialogs. */}
        <Pressable
          style={{ position: 'absolute', inset: 0 }}
          onPress={onDismiss}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <Animated.View
          entering={ZoomIn.springify().damping(18)}
          exiting={ZoomOut.duration(140)}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            {
              width: '100%',
              maxWidth: 380,
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.popover,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            },
            theme.shadows.lg,
          ]}
        >
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <OrbixText size="md" weight="semibold" accessibilityRole="header">
              {title}
            </OrbixText>
            {description ? (
              <OrbixText size="sm" tone="mutedForeground">
                {description}
              </OrbixText>
            ) : null}
            {children}
          </View>

          {confirmLabel || cancelLabel ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              {cancelLabel ? (
                <OrbixButton
                  label={cancelLabel}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={onDismiss}
                />
              ) : null}
              {confirmLabel ? (
                <OrbixButton
                  label={confirmLabel}
                  variant={destructive ? 'destructive' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  loading={loading}
                  onPress={onConfirm}
                />
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export const OrbixModal = memo(OrbixModalComponent);
