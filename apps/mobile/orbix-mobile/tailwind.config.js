/**
 * NativeWind theme.
 *
 * Every colour resolves to a CSS variable, never to a literal. The variables
 * are injected at runtime by `ThemeProvider` (see `src/providers/theme-provider.tsx`)
 * using NativeWind's `vars()` helper, so a tenant that ships its own palette
 * from the backend restyles the whole app without a rebuild.
 *
 * The default values live in `src/theme/tokens.ts` and mirror the Claude Design
 * prototype 1:1.
 */
const withVar = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: withVar('color-background'),
        foreground: withVar('color-foreground'),
        card: withVar('color-card'),
        'card-foreground': withVar('color-card-foreground'),
        popover: withVar('color-popover'),
        'popover-foreground': withVar('color-popover-foreground'),
        primary: withVar('color-primary'),
        'primary-foreground': withVar('color-primary-foreground'),
        secondary: withVar('color-secondary'),
        'secondary-foreground': withVar('color-secondary-foreground'),
        muted: withVar('color-muted'),
        'muted-foreground': withVar('color-muted-foreground'),
        accent: withVar('color-accent'),
        'accent-foreground': withVar('color-accent-foreground'),
        destructive: withVar('color-destructive'),
        'destructive-foreground': withVar('color-destructive-foreground'),
        border: withVar('color-border'),
        input: withVar('color-input'),
        ring: withVar('color-ring'),
        success: withVar('color-success'),
        'success-bg': withVar('color-success-bg'),
        warning: withVar('color-warning'),
        'warning-bg': withVar('color-warning-bg'),
        danger: withVar('color-danger'),
        'danger-bg': withVar('color-danger-bg'),
        info: withVar('color-info'),
        'info-bg': withVar('color-info-bg'),
      },
      fontFamily: {
        sans: ['DMSans_400Regular'],
        medium: ['DMSans_500Medium'],
        semibold: ['DMSans_600SemiBold'],
        bold: ['DMSans_700Bold'],
        extrabold: ['DMSans_800ExtraBold'],
      },
      borderRadius: {
        sm: withVar('radius-sm'),
        DEFAULT: withVar('radius-lg'),
        md: withVar('radius-md'),
        lg: withVar('radius-lg'),
        xl: withVar('radius-xl'),
        '2xl': withVar('radius-2xl'),
        '3xl': withVar('radius-3xl'),
      },
    },
  },
  plugins: [],
};
