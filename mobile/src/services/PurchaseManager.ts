/**
 * PurchaseManager - Singleton para manejar compras in-app con RevenueCat
 *
 * API Keys en .env (una o ambas opciones):
 *   - Una sola key para ambas plataformas (desarrollo/testing):
 *     EXPO_PUBLIC_REVENUECAT_API_KEY=test_xxxxx
 *   - Por plataforma (producción):
 *     EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=appl_xxxxx
 *     EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxx
 *
 * Entitlement: "Tercer Tiempo Pro" en el dashboard debe usar el identificador PRO_ENTITLEMENT_ID.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import apiClient from "../api/apiClient";

/** Identificador del entitlement "Tercer Tiempo Pro" en el dashboard de RevenueCat */
export const PRO_ENTITLEMENT_ID = "tercer_tiempo_pro";

/** Obtiene la API key: primero clave única, luego por plataforma (desde .env o app.config extra) */
function getRevenueCatApiKey(): string {
  const singleKey =
    (typeof process.env.EXPO_PUBLIC_REVENUECAT_API_KEY === "string"
      ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY.trim()
      : (
          Constants.expoConfig?.extra as Record<string, string> | undefined
        )?.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim()) || "";
  if (singleKey) return singleKey;

  const fromEnv =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
      : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  const fromExtra =
    Platform.OS === "ios"
      ? Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
      : Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  const key = (typeof fromEnv === "string" ? fromEnv : fromExtra)?.trim();
  if (!key) return "";
  return key;
}

/**
 * Llama al backend para actualizar el usuario a PRO.
 * El interceptor de apiClient inyecta el token; si no hay token, el backend devolverá 401.
 */
async function updateUserToProInBackend(): Promise<void> {
  const doPost = () => apiClient.post("/auth/iap-upgrade", {});

  try {
    await doPost();
  } catch {
    try {
      await doPost();
    } catch (e2: any) {
      console.error(
        "[PurchaseManager] Error actualizando backend:",
        e2?.response?.status,
        e2?.response?.data || e2?.message,
      );
      throw e2;
    }
  }
}

/**
 * Listener que se ejecuta cuando CustomerInfo se actualiza (compra exitosa, restore, etc.).
 * Si el usuario tiene el entitlement Tercer Tiempo Pro activo, actualiza el backend.
 */
function onCustomerInfoUpdated(customerInfo: CustomerInfo): void {
  const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  if (proEntitlement?.isActive) {
    updateUserToProInBackend().catch(() => {
      // El usuario ya tiene PRO en RevenueCat; el backend se puede actualizar después
      // (ej. al abrir /auth/me o en un retry)
    });
  }
}

class PurchaseManagerClass {
  private initialized = false;
  private customerInfoListener: ((info: CustomerInfo) => void) | null = null;

  /**
   * Inicializa el SDK de RevenueCat.
   * Llamar al arranque de la app, después de que el usuario haya iniciado sesión.
   * Si ya estaba inicializado (ej. tras logout + nuevo login), llama logIn para identificar al usuario.
   * @param appUserId ID del usuario en tu backend (ej. de JWT). RevenueCat lo usa para vincular compras.
   */
  async initialize(appUserId?: string | null): Promise<void> {
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) return;

    if (this.initialized) {
      if (appUserId) await Purchases.logIn(appUserId);
      return;
    }

    try {
      await Purchases.configure({
        apiKey,
        appUserID: appUserId ?? undefined,
      });

      this.customerInfoListener = onCustomerInfoUpdated;
      Purchases.addCustomerInfoUpdateListener(this.customerInfoListener);

      this.initialized = true;
    } catch (e) {
      console.error("[PurchaseManager] Error inicializando RevenueCat:", e);
      throw e;
    }
  }

  /**
   * Identifica al usuario en RevenueCat (llamar después del login).
   * Vincula las compras con el ID de tu backend.
   */
  async logIn(appUserId: string): Promise<void> {
    if (!this.initialized) await this.initialize(appUserId);
    else await Purchases.logIn(appUserId);
  }

  /**
   * Cierra sesión en RevenueCat (llamar en logout).
   */
  async logOut(): Promise<void> {
    if (!this.initialized) return;
    try {
      await Purchases.logOut();
    } catch {
    }
  }

  /**
   * Obtiene las ofertas (paywall) desde RevenueCat.
   * Usa el "Current" offering por defecto; en el dashboard puedes definir "default" o "paywall".
   */
  async fetchOfferings(): Promise<PurchasesOfferings | null> {
    if (!this.initialized) return null;
    try {
      return await Purchases.getOfferings();
    } catch (e) {
      console.error("[PurchaseManager] Error obteniendo offerings:", e);
      return null;
    }
  }

  /**
   * Lanza el flujo de compra nativo (Apple/Google).
   * @param pkg Paquete obtenido de fetchOfferings (ej. offerings.current?.monthly)
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    if (!this.initialized) {
      throw new Error(
        "PurchaseManager no inicializado. Llama a initialize() primero.",
      );
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  }

  /**
   * Restaura compras previas (obligatorio para Apple).
   * Útil cuando el usuario cambia de dispositivo o reinstala la app.
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.initialized) {
      throw new Error(
        "PurchaseManager no inicializado. Llama a initialize() primero.",
      );
    }
    return await Purchases.restorePurchases();
  }

  /**
   * Comprueba si el usuario tiene acceso PRO según RevenueCat (entitlement Tercer Tiempo Pro).
   */
  async isPro(): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const proEntitlement =
        customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
      return !!proEntitlement?.isActive;
    } catch {
      return false;
    }
  }

  /**
   * Sincroniza el estado PRO con el backend.
   * Llámalo tras una compra o restore exitoso para asegurar que el usuario quede como PRO.
   * @param force - Si true, llama al backend sin revalidar entitlement (útil justo tras compra/restore).
   */
  async syncProToBackend(force = false): Promise<void> {
    if (force) {
      await updateUserToProInBackend();
      return;
    }
    const info = await this.getCustomerInfo();
    if (!info) return;
    const proEntitlement = info.entitlements.active[PRO_ENTITLEMENT_ID];
    if (proEntitlement?.isActive) {
      await updateUserToProInBackend();
    }
  }

  /**
   * Obtiene la información del cliente desde RevenueCat (entitlements, active subscriptions, etc.).
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.initialized) return null;
    try {
      return await Purchases.getCustomerInfo();
    } catch (e) {
      console.error("[PurchaseManager] Error obteniendo customerInfo:", e);
      return null;
    }
  }

  /**
   * Limpia el listener. Llamar si desmontas el manager (poco habitual).
   */
  tearDown(): void {
    if (this.customerInfoListener) {
      Purchases.removeCustomerInfoUpdateListener(this.customerInfoListener);
      this.customerInfoListener = null;
    }
    this.initialized = false;
  }
}

export const PurchaseManager = new PurchaseManagerClass();
