/**
 * Supplies the active theme to the whole tree, in two forms:
 *   • `useTheme()` — typed tokens for StyleSheet / animated styles
 *   • CSS variables — so NativeWind classes (`bg-primary`) resolve dynamically
 *
 * Hydration is synchronous: the stored mode and the cached tenant branding are
 * read from MMKV during the first render, so the app never flashes the default
 * palette before switching to the tenant's.
 */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useDeviceColorScheme, View } from 'react-native';

import { themeService } from '@/services/theme/theme-service';
import { themeToVars } from '@/theme/css-vars';
import type { ColorSchemeName, OrbixTheme, TenantBranding, ThemeMode } from '@/theme/types';

export interface ThemeContextValue {
  theme: OrbixTheme;
  /** The user's preference; `system` follows the device. */
  mode: ThemeMode;
  /** The scheme actually in use after resolving `mode`. */
  scheme: ColorSchemeName;
  setMode: (mode: ThemeMode) => void;
  /** Applied when a tenant is selected or its branding is refetched. */
  setBranding: (branding: TenantBranding | null) => void;
  branding: TenantBranding | null;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Branding known before mount (e.g. restored session); optional. */
  initialBranding?: TenantBranding | null;
}

export function ThemeProvider({ children, initialBranding = null }: ThemeProviderProps) {
  const deviceScheme: ColorSchemeName = useDeviceColorScheme() === 'dark' ? 'dark' : 'light';

  const [mode, setModeState] = useState<ThemeMode>(() => themeService.getMode());
  const [branding, setBrandingState] = useState<TenantBranding | null>(initialBranding);

  const scheme = themeService.resolveScheme(mode, deviceScheme, branding);
  const theme = useMemo(() => themeService.buildTheme(scheme, branding), [scheme, branding]);

  const setMode = useCallback((next: ThemeMode) => {
    themeService.setMode(next);
    setModeState(next);
  }, []);

  const setBranding = useCallback((next: TenantBranding | null) => {
    setBrandingState(next);
  }, []);

  // A tenant may force a scheme; adopt it only while the user is on `system`.
  useEffect(() => {
    if (mode !== 'system') return;
    if (!branding?.defaultMode || branding.defaultMode === 'system') return;
    setModeState('system');
  }, [branding, mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, scheme, setMode, setBranding, branding }),
    [theme, mode, scheme, setMode, setBranding, branding],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: theme.colors.background }, themeToVars(theme)]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
