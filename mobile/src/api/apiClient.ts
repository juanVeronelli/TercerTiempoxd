import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

const rawBaseUrl =
  (typeof Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL === "string" &&
    Constants.expoConfig.extra.EXPO_PUBLIC_API_URL) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://192.168.0.25:3000";

const apiBaseUrl = normalizeApiBaseUrl(rawBaseUrl);

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  // FormData: quitar Content-Type para que RN añada multipart/form-data con boundary
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }
  if (config.headers?.Authorization) {
    return config;
  }
  const token = await SecureStore.getItemAsync("userToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
