/**
 * SubscriptionUI - Presenta Paywall y Customer Center de RevenueCat.
 * Requiere react-native-purchases-ui y que PurchaseManager esté inicializado.
 */

import RevenueCatUI, {
  PAYWALL_RESULT,
  type PresentPaywallParams,
  type PresentPaywallIfNeededParams,
  type PresentCustomerCenterParams,
} from "react-native-purchases-ui";
import { PurchaseManager, PRO_ENTITLEMENT_ID } from "./PurchaseManager";

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
