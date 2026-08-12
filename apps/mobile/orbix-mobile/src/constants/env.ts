/**
 * Typed, validated access to public runtime configuration.
 *
 * Expo inlines `EXPO_PUBLIC_*` at build time via a literal-only transform, so
 * each variable must be referenced as a full static property access —
 * `process.env[name]` would compile to `undefined`.
 *
 * Validation runs once at module load. A missing required variable fails loudly
 * at startup instead of surfacing as a confusing network error later.
 */
import { z } from 'zod';

const envSchema = z.object({
  apiUrl: z.url({ error: 'EXPO_PUBLIC_API_URL must be an absolute URL' }),
  apiTimeout: z.coerce.number().int().positive().default(15_000),
  defaultLocale: z.enum(['es', 'en', 'pt']).default('es'),
  google: z.object({
    clientId: z.string().optional(),
    androidClientId: z.string().optional(),
    iosClientId: z.string().optional(),
    webClientId: z.string().optional(),
  }),
});

export type Env = z.infer<typeof envSchema>;

/** Treats empty strings as absent — `.env` placeholders are committed empty. */
function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const raw = {
  apiUrl: optional(process.env.EXPO_PUBLIC_API_URL) ?? 'http://localhost:3001/api',
  apiTimeout: optional(process.env.EXPO_PUBLIC_API_TIMEOUT) ?? 15_000,
  defaultLocale: optional(process.env.EXPO_PUBLIC_DEFAULT_LOCALE) ?? 'es',
  google: {
    clientId: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID),
    androidClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    iosClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    webClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  },
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(
    `Invalid environment configuration.\n${issues}\n\n` +
      'Copy .env.example to .env and fill in the required values.',
  );
}

export const env: Env = parsed.data;

/**
 * Google sign-in is only offered when at least one client ID is configured, so
 * a fresh checkout without credentials still builds and runs.
 */
export const isGoogleAuthConfigured =
  Boolean(env.google.clientId) ||
  Boolean(env.google.androidClientId) ||
  Boolean(env.google.iosClientId) ||
  Boolean(env.google.webClientId);

export const isDev = __DEV__;
