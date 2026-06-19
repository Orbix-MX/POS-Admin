/**
 * Centralized, typed access to public runtime configuration.
 * Expo inlines any `EXPO_PUBLIC_*` variable into the bundle at build time.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const Env = {
  /** Base URL of the NestJS API, including the `/api` global prefix. */
  apiUrl: API_URL,
} as const;
