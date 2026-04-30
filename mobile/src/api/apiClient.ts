import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import {
  notifySessionExpired,
  shouldClearSessionOn401,
} from "./sessionExpiry";

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getAppEnv(): string {
  const e =
    (typeof Constants.expoConfig?.extra?.EXPO_PUBLIC_ENV === "string" &&
      Constants.expoConfig.extra.EXPO_PUBLIC_ENV) ||
    process.env.EXPO_PUBLIC_ENV ||
    "dev";
  return String(e).trim().toLowerCase();
}

const rawBaseUrl =
  (typeof Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL === "string" &&
    Constants.expoConfig.extra.EXPO_PUBLIC_API_URL) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "";

const env = getAppEnv();
if (!rawBaseUrl) {
  // Importante: NO tirar error en tiempo de import del módulo.
  // Si falta la URL en beta/prod, la app igual debe abrir (para no “crash on launch”);
  // las llamadas fallarán hasta que el build tenga EXPO_PUBLIC_API_URL en extra/env.
  if (env === "beta" || env === "prod" || env === "production") {
    console.error(
      "[apiClient] Missing EXPO_PUBLIC_API_URL in this build. Set it in EAS Secrets / eas.json env so it reaches Constants.expoConfig.extra.",
    );
  } else {
    console.warn("[apiClient] EXPO_PUBLIC_API_URL missing; API calls will fail until configured.");
  }
}

const apiBaseUrl = normalizeApiBaseUrl(rawBaseUrl);

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 25_000,
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url as string | undefined;
    if (status === 401 && shouldClearSessionOn401(url)) {
      await notifySessionExpired();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
