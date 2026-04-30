import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import apiClient from "../api/apiClient";
import { ensureAndroidNotificationChannel } from "../notifications/pushSetup";

/**
 * Obtiene permisos, configura canal Android, obtiene Expo Push Token y lo guarda en el servidor.
 * Solo builds nativos / dev client; Expo Go no entrega push real.
 *
 * @returns true si se registró token en backend
 */
export async function registerExpoPushTokenWithBackend(): Promise<boolean> {
  if (Constants.appOwnership === "expo") {
    return false;
  }
  if (!Device.isDevice) {
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return false;
  }

  await ensureAndroidNotificationChannel();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  let token: string | undefined;
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = tokenRes?.data?.trim();
  } catch (e) {
    if (__DEV__) {
      console.warn("[registerExpoPush] getExpoPushTokenAsync:", e);
    }
    return false;
  }
  if (!token) {
    return false;
  }

  const authToken = await SecureStore.getItemAsync("userToken");
  if (!authToken) {
    return false;
  }

  try {
    await apiClient.put("/auth/push-token", { expoPushToken: token });
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn("[registerExpoPush] PUT /auth/push-token:", e);
    }
    return false;
  }
}
