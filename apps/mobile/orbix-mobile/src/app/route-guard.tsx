/**
 * Central route protection.
 *
 * One guard instead of per-screen redirects: with Expo Router, scattered
 * `<Redirect>`s race each other during the first navigation and produce
 * flicker. Here the rules are evaluated in one place, after the session has
 * settled.
 *
 * Rules, in order:
 *   • session still loading           → stay on the splash
 *   • never saw the carousel          → (onboarding)
 *   • not authenticated               → (auth)
 *   • authenticated, no tenant yet:
 *       - account owns exactly one company → auto-select it, land on (app)
 *         directly (the wizard is only for accounts that own nothing)
 *       - account owns several             → tenant picker
 *       - account owns none                → (wizard)
 *   • authenticated with a tenant     → (app)
 */
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { sessionStorage } from '@/services/auth/session-storage';

type Group = '(onboarding)' | '(auth)' | '(wizard)' | '(app)';

export function RouteGuard({ children }: { children: ReactNode }) {
  const { status, session, selectTenant } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Guards the auto-select below against firing twice while its request is
  // still in flight (effect re-runs on every segment change).
  const autoSelecting = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;

    const group = segments[0] as Group | undefined;

    if (!sessionStorage.hasCompletedOnboarding()) {
      if (group !== '(onboarding)') router.replace('/(onboarding)/welcome');
      return;
    }

    if (status === 'unauthenticated') {
      if (group !== '(auth)') router.replace('/(auth)/sign-in');
      return;
    }

    const hasTenant = Boolean(session?.tenant);
    const availableTenants = session?.availableTenants ?? [];

    if (!hasTenant) {
      if (availableTenants.length > 1) {
        if (group !== '(app)') router.replace('/(app)/select-tenant');
        return;
      }
      const onlyTenant = availableTenants.length === 1 ? availableTenants[0] : undefined;
      if (onlyTenant) {
        // The account already owns a company — skip the wizard and the picker,
        // go straight to it so the user lands on (app) directly.
        if (!autoSelecting.current) {
          autoSelecting.current = true;
          void selectTenant(onlyTenant)
            // A failed auto-select must not strand the user on a blank screen —
            // fall back to the manual picker, which they can retry from.
            .catch(() => router.replace('/(app)/select-tenant'))
            .finally(() => {
              autoSelecting.current = false;
            });
        }
        return;
      }
      // A brand-new account owns nothing yet: send it straight to the wizard.
      if (group !== '(wizard)') router.replace('/(wizard)/company-info');
      return;
    }

    // Finishing the wizard navigates on its own; don't yank the success screen
    // away from under the user.
    if (group === '(auth)' || group === '(onboarding)' || group === undefined) {
      router.replace('/(app)');
    }
  }, [status, session, segments, router, selectTenant]);

  return <>{children}</>;
}
