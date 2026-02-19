import { Stack } from "expo-router";
import { Colors } from "../../../../src/constants/Colors";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ headerShown: false, title: "Mi Perfil" }}
      />
      <Stack.Screen
        name="achievements"
        options={{ headerShown: false, title: "Logros" }}
      />
    </Stack>
  );
}
