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
 *   • authenticated, no tenant        → (wizard) — or the tenant picker when
 *                                       the account already belongs to several
 *   • authenticated with a tenant     → (app)
 */
import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { sessionStorage } from '@/services/auth/session-storage';

type Group = '(onboarding)' | '(auth)' | '(wizard)' | '(app)';

export function RouteGuard({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
    const hasSeveralTenants = (session?.availableTenants.length ?? 0) > 1;

    if (!hasTenant) {
      if (hasSeveralTenants) {
        if (group !== '(app)') router.replace('/(app)/select-tenant');
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
  }, [status, session, segments, router]);

  return <>{children}</>;
}
