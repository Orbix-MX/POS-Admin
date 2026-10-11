import { Stack } from 'expo-router';

export default function CajaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="arqueo" />
      <Stack.Screen name="corte" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
