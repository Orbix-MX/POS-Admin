import { Stack } from 'expo-router';

/** Public routes: login + tenant/branch selection. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
