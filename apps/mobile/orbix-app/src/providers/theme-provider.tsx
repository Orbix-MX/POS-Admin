/**
 * ThemeProvider — resolves light/dark from the user's preference (AppStore) and
 * the OS scheme, loads the brand fonts, and exposes the active `Theme` via
 * `useTheme()`. Renders nothing until fonts are ready so the splash stays up.
 */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';

import { lightTheme, darkTheme, type Theme } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useAppStore((s) => s.colorScheme);
  const system = useColorScheme();

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  const resolved = preference === 'system' ? system ?? 'light' : preference;
  const theme = useMemo(() => (resolved === 'dark' ? darkTheme : lightTheme), [resolved]);

  if (!fontsLoaded) return null;

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
