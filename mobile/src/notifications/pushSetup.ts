import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerReady = false;

/**
 * Comportamiento en primer plano: el sistema puede mostrar banner / lista (iOS) y no solo in-app.
 */
export function configureNotificationBehavior(): void {
  if (handlerReady) return;
  handlerReady = true;
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
}

/**
 * Android: canal requerido para que las push aparezcan en el centro de notificaciones con prioridad correcta.
 * Mismo id que envía el backend en `channelId: "default"`.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

configureNotificationBehavior();
