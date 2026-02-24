/**
 * usePushNotifications — solicita permisos, obtiene el Expo Push Token y configura listeners.
 *
 * Dependencias: recuerda instalar con:
 *   npx expo install expo-notifications expo-device
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Configuración global: si la app está abierta, la notificación igual muestra alerta y sonido
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldAnnotatePresentedNotification: true,
  }),
});

/**
 * Hook que solicita permisos de push, obtiene el Expo Push Token y configura el canal en Android.
 * @returns expoPushToken — string del token para guardar en tu base de datos vinculado al usuario, o null si no está disponible
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

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        const tokenRes = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
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
