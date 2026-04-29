/**
 * SubscriptionUI - Presenta Paywall y Customer Center de RevenueCat.
 * Requiere react-native-purchases-ui y que PurchaseManager esté inicializado.
 *
 * Nota: presentCustomerCenter() suele fallar si se llama mientras un RN Modal sigue
 * presentando (ve GitHub RevenueCat #1201). Usar openSubscriptionManagement() desde UI.
 *
 * Expo Go: no hay IAP reales ni SDK de tienda completo; openSubscriptionManagement abre
 * la página web de suscripciones Apple/Google sin exigir clave RevenueCat.
 */

import Constants from "expo-constants";
import { InteractionManager, Linking, Platform } from "react-native";
import RevenueCatUI, {
  PAYWALL_RESULT,
  type PresentPaywallParams,
  type PresentPaywallIfNeededParams,
  type PresentCustomerCenterParams,
} from "react-native-purchases-ui";
import type { CustomerInfo } from "react-native-purchases";
import {
  PurchaseManager,
  PRO_ENTITLEMENT_ID,
  hasRevenueCatApiKey,
} from "./PurchaseManager";

export { PAYWALL_RESULT, PRO_ENTITLEMENT_ID };

export type PaywallOutcome = "purchased" | "restored" | "cancelled" | "error" | "not_presented";

/** Offering ID configurado en RevenueCat (productos pro_monthly, pro_annual, entitlement tercer_tiempo_pro) */
export const PAYWALL_OFFERING_ID = "ofrng2d3866b1d2";

/**
 * Presenta el paywall de RevenueCat (usa PAYWALL_OFFERING_ID si se pasa offering).
 * @param options - offering, displayCloseButton, etc.
 * @returns Resultado: purchased | restored | cancelled | error | not_presented
 */
export async function presentPaywall(
  options?: PresentPaywallParams
): Promise<PaywallOutcome> {
  try {
    const result = await RevenueCatUI.presentPaywall({
      displayCloseButton: true,
      ...options,
    });
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return "purchased";
      case PAYWALL_RESULT.RESTORED:
        return "restored";
      case PAYWALL_RESULT.CANCELLED:
        return "cancelled";
      case PAYWALL_RESULT.ERROR:
        return "error";
      case PAYWALL_RESULT.NOT_PRESENTED:
      default:
        return "not_presented";
    }
  } catch (e) {
    console.error("[SubscriptionUI] presentPaywall error:", e);
    return "error";
  }
}

/**
 * Presenta el paywall solo si el usuario no tiene el entitlement "Tercer Tiempo Pro".
 * Útil para bloquear una pantalla hasta que compre o cierre.
 */
export async function presentPaywallIfNeeded(
  params?: Omit<PresentPaywallIfNeededParams, "requiredEntitlementIdentifier">
): Promise<PaywallOutcome> {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
      ...params,
    });
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return "purchased";
      case PAYWALL_RESULT.RESTORED:
        return "restored";
      case PAYWALL_RESULT.CANCELLED:
        return "cancelled";
      case PAYWALL_RESULT.ERROR:
        return "error";
      case PAYWALL_RESULT.NOT_PRESENTED:
      default:
        return "not_presented";
    }
  } catch (e) {
    console.error("[SubscriptionUI] presentPaywallIfNeeded error:", e);
    return "error";
  }
}

/**
 * Abre el Customer Center de RevenueCat (gestionar suscripción, restaurar, etc.).
 */
export async function presentCustomerCenter(
  params?: PresentCustomerCenterParams
): Promise<void> {
  try {
    await RevenueCatUI.presentCustomerCenter(params);
  } catch (e) {
    console.error("[SubscriptionUI] presentCustomerCenter error:", e);
    throw e;
  }
}

/** Cliente Expo Go (no incluye IAP nativas; solo útil para desarrollo rápido). */
export function isRunningInExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

function managementURLFromCustomerInfo(info: CustomerInfo | null): string | null {
  if (!info) return null;
  const url = (info as CustomerInfo & { managementURL?: string | null })
    .managementURL;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/**
 * Abre gestión de suscripción usando **solo URLs** (Safari/Chrome o redirección a tienda).
 * No dependemos de `presentCustomerCenter`: en muchos casos resuelve sin error y sin mostrar nada
 * si Customer Center no está bien configurado en RevenueCat.
 *
 * Orden: `managementURL` de RevenueCat → página oficial de suscripciones Apple/Google.
 */
export async function openSubscriptionManagement(
  _params?: PresentCustomerCenterParams,
): Promise<void> {
  const expoGo = isRunningInExpoGo();
  if (!hasRevenueCatApiKey() && !expoGo) {
    throw new Error(
      "Las suscripciones no están configuradas en esta build (falta clave de RevenueCat).",
    );
  }

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === "ios" ? 720 : 550);
    });
  });

  let rcUrl: string | null = null;
  if (hasRevenueCatApiKey()) {
    const info = await PurchaseManager.getCustomerInfo();
    rcUrl = managementURLFromCustomerInfo(info);
  }

  if (rcUrl) {
    try {
      await Linking.openURL(rcUrl);
      return;
    } catch (e) {
      console.warn("[SubscriptionUI] managementURL failed:", e);
    }
  }

  const fallbackSubsPage =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";

  try {
    await Linking.openURL(fallbackSubsPage);
    return;
  } catch (e) {
    console.warn("[SubscriptionUI] fallback subscriptions page:", e);
  }

  throw new Error(
    Platform.OS === "ios"
      ? "En el iPhone: Ajustes → tu nombre → Suscripciones."
      : "En Android: Google Play → Menú → Pagos y suscripciones.",
  );
}

/**
 * Comprueba si el usuario tiene Pro (delega a PurchaseManager).
 */
export async function isPro(): Promise<boolean> {
  return PurchaseManager.isPro();
}

/**
 * Obtiene la información del cliente (delega a PurchaseManager).
 */
export async function getCustomerInfo() {
  return PurchaseManager.getCustomerInfo();
}
