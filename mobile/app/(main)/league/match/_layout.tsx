import { Stack } from "expo-router";

export default function MatchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* El índice (la lista de partidos o la tarjeta de admin) */}
      <Stack.Screen name="index" />

      {/* La pantalla de crear, oculta y sin header */}
      <Stack.Screen name="create" />
    </Stack>
  );
}
