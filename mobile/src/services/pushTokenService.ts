import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import apiClient from "../api/apiClient";
import * as SecureStore from "expo-secure-store";

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
    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes?.data;
    if (!token) return;

    const authToken = await SecureStore.getItemAsync("userToken");
    if (!authToken) return;

    await apiClient.put("/auth/update-profile", { expoPushToken: token });
  } catch {
  }
}
