import { useEffect } from "react";
import { Stack } from "expo-router";
import { useNotificationResponseHandler } from "../../src/hooks/useNotificationResponseHandler";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { PurchaseManager } from "../../src/services/PurchaseManager";

export default function MainLayout() {
  useNotificationResponseHandler();
  const { userId } = useCurrentUser();

  useEffect(() => {
    if (!userId) return;
    PurchaseManager.initialize(userId).catch(() => {
      // RevenueCat no disponible (Expo Go, etc.)
    });
  }, [userId]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
