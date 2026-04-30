/**
 * usePushNotifications — solicita permisos, obtiene el Expo Push Token (no lo envía al backend;
 * el registro unificado es registerExpoPushTokenWithBackend).
 */
import { useEffect, useState } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { ensureAndroidNotificationChannel } from "../notifications/pushSetup";

/**
 * @returns expoPushToken — o null si no aplica
 */
export function usePushNotifications(): string | null {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (!Device.isDevice) {
      return;
    }

    let isMounted = true;

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted" || !isMounted) return;

      await ensureAndroidNotificationChannel();

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        const tokenRes = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenRes?.data ?? null;
        if (isMounted && token) {
          setExpoPushToken(token);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("[usePushNotifications] Error obteniendo push token:", e);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return expoPushToken;
}
