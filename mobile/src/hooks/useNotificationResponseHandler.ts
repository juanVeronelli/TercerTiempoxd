import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

/**
 * Escucha taps en notificaciones push y navega según data.screen.
 * Soporta app en background y apertura desde estado cerrado.
 */
export function useNotificationResponseHandler(): void {
  const router = useRouter();
  const isSetup = useRef(false);

  useEffect(() => {
    if (Constants.appOwnership === "expo") return; // Expo Go no soporta push en Android
    if (isSetup.current) return;
    isSetup.current = true;

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;

      const screen = data.screen;
      if (screen === "profile") {
        router.push("/(main)/league/profile");
      }
    };

    // App abierta desde cerrado tocando la notificación
    Notifications.getLastNotificationResponseAsync().then(handleResponse);

    // App en foreground/background - usuario tocó la notificación
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [router]);
}
