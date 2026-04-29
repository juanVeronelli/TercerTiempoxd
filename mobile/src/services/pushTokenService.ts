import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import apiClient from "../api/apiClient";
import * as SecureStore from "expo-secure-store";

// Comportamiento en primer plano: mostrar alerta y sonido (también aplica si usas usePushNotifications)
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
 * Pide permisos, obtiene el Expo Push Token y lo envía al backend.
 * Debe llamarse cuando el usuario ya está logueado (ej. al entrar a (main)).
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenRes?.data;
    if (!token) return;

    const authToken = await SecureStore.getItemAsync("userToken");
    if (!authToken) return;

    await apiClient.put("/auth/update-profile", { expoPushToken: token });
  } catch {
  }
}
