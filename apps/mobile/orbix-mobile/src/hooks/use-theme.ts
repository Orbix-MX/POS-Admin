import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from '@/providers/theme-provider';
import type { OrbixTheme } from '@/theme/types';

/** Full theme context, including the mode setters. */
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used inside <ThemeProvider>.');
  }
  return context;
}

/** The tokens themselves — what components need 95% of the time. */
export function useTheme(): OrbixTheme {
  return useThemeContext().theme;
}
