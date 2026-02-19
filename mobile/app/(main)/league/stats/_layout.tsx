import { Stack } from "expo-router";
import { Colors } from "../../../../src/constants/Colors";

export default function StatsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* La pantalla principal (index.tsx) */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Mi Rendimiento",
        }}
      />
    </Stack>
  );
}
