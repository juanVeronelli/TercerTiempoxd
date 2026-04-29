import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useNotificationResponseHandler } from "../../src/hooks/useNotificationResponseHandler";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { PurchaseManager } from "../../src/services/PurchaseManager";
import { setOnSessionExpired } from "../../src/api/sessionExpiry";

export default function MainLayout() {
  const router = useRouter();
  useNotificationResponseHandler();
  const { userId } = useCurrentUser();

  useEffect(() => {
    setOnSessionExpired(() => {
      router.replace("/(auth)/login");
    });
    return () => setOnSessionExpired(null);
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    PurchaseManager.initialize(userId).catch(() => {});
  }, [userId]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
