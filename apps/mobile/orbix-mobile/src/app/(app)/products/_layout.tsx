import { Stack } from 'expo-router';

export default function ProductsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
