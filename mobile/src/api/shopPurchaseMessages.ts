import axios from "axios";
import { formatUserFacingError, getNetworkErrorMessage } from "./apiErrors";

type PurchaseCode = "ITEM_NOT_FOUND" | "INSUFFICIENT_TTP" | "ALREADY_OWNED" | "INVALID_ITEM";

const MESSAGES: Record<
  PurchaseCode,
  { title: string; body: string; toast?: string }
> = {
  ITEM_NOT_FOUND: {
    title: "Ítem no encontrado",
    body: "Este producto ya no está disponible en la tienda. Actualizá la pantalla.",
    toast: "Producto no disponible.",
  },
  INSUFFICIENT_TTP: {
    title: "TTP insuficientes",
    body: "No tenés saldo suficiente para esta compra. Podés cargar TTP en la pestaña correspondiente.",
    toast: "Te faltan TTP.",
  },
  ALREADY_OWNED: {
    title: "Ya lo tenés",
    body: "Este cosmético ya está en tu colección.",
    toast: "Ya tenés este cosmético.",
  },
  INVALID_ITEM: {
    title: "Compra inválida",
    body: "Este ítem no se puede comprar en este momento.",
    toast: "No se puede comprar este ítem.",
  },
};

function isPurchaseCode(s: unknown): s is PurchaseCode {
  return typeof s === "string" && s in MESSAGES;
}

export function resolveShopPurchaseFailure(error: unknown): {
  alertTitle: string;
  alertMessage: string;
  toastMessage?: string;
} {
  const net = getNetworkErrorMessage(error);
  if (net) {
    return { alertTitle: "Conexión", alertMessage: net, toastMessage: "Revisá tu red." };
  }
  if (axios.isAxiosError(error)) {
    const code =
      error.response?.data && typeof error.response.data === "object"
        ? (error.response.data as { error?: string }).error
        : undefined;
    if (isPurchaseCode(code)) {
      const m = MESSAGES[code];
      return { alertTitle: m.title, alertMessage: m.body, toastMessage: m.toast };
    }
    return {
      alertTitle: "No se pudo comprar",
      alertMessage: formatUserFacingError(error, "No se pudo completar la compra."),
      toastMessage: "Error en la compra.",
    };
  }
  return {
    alertTitle: "No se pudo comprar",
    alertMessage: formatUserFacingError(error, "No se pudo completar la compra."),
  };
}
