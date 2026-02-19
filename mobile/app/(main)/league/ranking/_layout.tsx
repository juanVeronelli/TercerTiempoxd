import { Stack } from "expo-router";

export default function RankingStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* La entrada principal (El Hub) */}
      <Stack.Screen name="index" />

      {/* Las sub-pantallas */}
      <Stack.Screen name="table" />
      <Stack.Screen name="honors" />
    </Stack>
  );
}
