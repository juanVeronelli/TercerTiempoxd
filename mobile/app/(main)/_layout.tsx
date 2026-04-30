import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { useNotificationResponseHandler } from "../../src/hooks/useNotificationResponseHandler";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { PurchaseManager } from "../../src/services/PurchaseManager";
import { setOnSessionExpired } from "../../src/api/sessionExpiry";
import "../../src/notifications/pushSetup";
import { registerExpoPushTokenWithBackend } from "../../src/services/registerExpoPush";

export default function MainLayout() {
  const router = useRouter();
  useNotificationResponseHandler();
  const { userId, loading: userLoading } = useCurrentUser();
  const appStateRef = useRef(AppState.currentState);

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

  useEffect(() => {
    if (Constants.appOwnership === "expo") return;
    if (userLoading || !userId) return;

    void registerExpoPushTokenWithBackend();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === "active" &&
        userId
      ) {
        void registerExpoPushTokenWithBackend();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [userId, userLoading]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
