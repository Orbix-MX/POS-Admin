import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="select-tenant" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="products" />
      <Stack.Screen name="pos" />
    </Stack>
  );
}
