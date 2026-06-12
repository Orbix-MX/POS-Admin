import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'activate' };

/** Public activation flow — device not yet registered. */
export default function ActivationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
