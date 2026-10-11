import { Stack } from 'expo-router';

import { WizardProvider } from '@/providers';

/**
 * The wizard's draft state must outlive individual steps, so the provider wraps
 * the whole group rather than each screen.
 */
export default function WizardLayout() {
  return (
    <WizardProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="success" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </WizardProvider>
  );
}
