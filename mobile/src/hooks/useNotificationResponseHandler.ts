import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

/**
 * Escucha taps en notificaciones push y navega según data.screen.
 * Soporta app en background y apertura desde estado cerrado.
 * En Expo Go no carga expo-notifications para evitar el warning de SDK 53+.
 */
export function useNotificationResponseHandler(): void {
  const router = useRouter();
  const isSetup = useRef(false);

  useEffect(() => {
    if (Constants.appOwnership === "expo") return; // Expo Go no soporta push; evitar cargar el módulo
    if (isSetup.current) return;
    isSetup.current = true;

    let sub: { remove: () => void } | null = null;

    import("expo-notifications").then((Notifications) => {
      const handleResponse = (response: { notification: { request: { content: { data?: unknown } } } } | null) => {
        if (!response) return;
        const data = response.notification?.request?.content?.data as Record<string, unknown> | null;
        if (!data || typeof data !== "object") return;

        const screen = data.screen;
        if (screen === "profile") {
          router.push("/(main)/league/profile");
        }
      };

      Notifications.getLastNotificationResponseAsync().then(handleResponse);
      sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    });

    return () => sub?.remove();
  }, [router]);
}
