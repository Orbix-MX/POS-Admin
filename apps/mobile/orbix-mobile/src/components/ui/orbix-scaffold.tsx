/**
 * Screen shell: background (solid or gradient wash), safe-area padding, status
 * bar style and keyboard avoidance.
 *
 * Every screen renders inside one, which is what keeps the 60 px top padding of
 * the prototype consistent without each screen re-deriving it from insets.
 */
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { useTheme } from '@/hooks/use-theme';

export interface OrbixScaffoldProps {
  children: ReactNode;
  /** `wash` reproduces `--grad-wash`; `splash` is the dark hero canvas. */
  background?: 'surface' | 'wash' | 'splash';
  scrollable?: boolean;
  /** Horizontal padding; the prototype uses 24 px on every screen. */
  horizontalPadding?: number;
  /** Extra top padding on top of the safe-area inset. */
  topPadding?: number;
  bottomPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Forces the status-bar style; defaults to the inverse of the background. */
  statusBarStyle?: 'light' | 'dark';
}

export function OrbixScaffold({
  children,
  background = 'surface',
  scrollable = false,
  horizontalPadding,
  topPadding = 0,
  bottomPadding,
  contentStyle,
  statusBarStyle,
}: OrbixScaffoldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const paddingHorizontal = horizontalPadding ?? theme.spacing['2xl'];
  const paddingTop = insets.top + topPadding;
  const paddingBottom = (bottomPadding ?? theme.spacing['3xl']) + insets.bottom;

  const inner: StyleProp<ViewStyle> = [
    { paddingHorizontal, paddingTop, paddingBottom },
    scrollable ? { flexGrow: 1 } : { flex: 1 },
    contentStyle,
  ];

  const body = scrollable ? (
    <ScrollView
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={inner}>{children}</View>
  );

  const content = (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // Android resizes the window itself; `padding` on iOS keeps the submit
      // button visible above the keyboard in the wizard's tall forms.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );

  const resolvedStatusBar =
    statusBarStyle ?? (background === 'splash' || theme.scheme === 'dark' ? 'light' : 'dark');

  if (background === 'surface') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar style={resolvedStatusBar} hidden />
        {content}
      </View>
    );
  }

  return (
    <OrbixGradient variant={background === 'splash' ? 'splash' : 'wash'} style={{ flex: 1 }}>
      <StatusBar style={resolvedStatusBar} />
      {content}
    </OrbixGradient>
  );
}
