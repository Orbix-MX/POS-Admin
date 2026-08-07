/**
 * Themed wrapper over `@gorhom/bottom-sheet`.
 *
 * Centralises the backdrop, the handle and the safe-area padding so every sheet
 * in the app opens the same way, and so a tenant's radius/colour overrides
 * apply without touching call sites.
 */
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

export interface OrbixBottomSheetProps {
  title?: string;
  children: ReactNode;
  /** Snap points as percentages or pixels; defaults to content height. */
  snapPoints?: (string | number)[];
  onClose?: () => void;
}

export type OrbixBottomSheetRef = BottomSheet;

export const OrbixBottomSheet = forwardRef<BottomSheet, OrbixBottomSheetProps>(
  function OrbixBottomSheet({ title, children, snapPoints, onClose }, ref) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const resolvedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={resolvedSnapPoints}
        enableDynamicSizing={!resolvedSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onClose={onClose}
        backgroundStyle={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.radius['3xl'],
          borderTopRightRadius: theme.radius['3xl'],
        }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 36, height: 4 }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: theme.spacing['2xl'],
            paddingBottom: insets.bottom + theme.spacing.xl,
            gap: theme.spacing.md,
          }}
        >
          {title ? (
            <OrbixText size="md" weight="semibold" accessibilityRole="header">
              {title}
            </OrbixText>
          ) : null}
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
