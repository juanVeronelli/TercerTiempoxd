import axios from "axios";
import { formatUserFacingError, getNetworkErrorMessage } from "./apiErrors";

/** Códigos `error` del POST `/shop/activate` (backend). */
export type ShopActivateErrorCode =
  | "NOT_LEAGUE_MEMBER"
  | "ITEM_NOT_FOUND"
  | "NOT_CONSUMABLE"
  | "INSUFFICIENT_QUANTITY"
  | "NO_UPCOMING_MATCH"
  | "NO_COMPLETED_MATCH"
  | "TIMING_MISMATCH"
  | "INVALID_SWAP_TARGET"
  | "INVALID_META"
  | "HEIST_NO_PEER"
  | "HEIST_NOT_IN_MATCH";

export type ShopActivateFailure = {
  /** Título del modal */
  alertTitle: string;
  /** Texto completo */
  alertMessage: string;
  /** Línea corta para toast (opcional) */
  toastMessage?: string;
};

const MESSAGES: Record<ShopActivateErrorCode, ShopActivateFailure> = {
  NOT_LEAGUE_MEMBER: {
    alertTitle: "No estás en esta liga",
    alertMessage:
      "Tenés que ser miembro de la liga seleccionada para usar consumibles en su calendario. Elegí otra liga en el inicio o unite con el código de invitación.",
    toastMessage: "No sos miembro de esta liga.",
  },
  ITEM_NOT_FOUND: {
    alertTitle: "Ítem no disponible",
    alertMessage:
      "Este consumible no está en la tienda o fue desactivado. Actualizá la tienda o elegí otro ítem.",
    toastMessage: "Consumible no disponible.",
  },
  NOT_CONSUMABLE: {
    alertTitle: "No es un consumible",
    alertMessage: "El ítem seleccionado no se puede activar como consumible.",
    toastMessage: "Ítem inválido.",
  },
  INSUFFICIENT_QUANTITY: {
    alertTitle: "Sin stock",
    alertMessage: "No te queda ninguna unidad de este consumible. Comprá más en la Tienda.",
    toastMessage: "No tenés stock de este consumible.",
  },
  NO_UPCOMING_MATCH: {
    alertTitle: "No tenés partido para usar esto",
    alertMessage:
      "Los consumibles pre-partido necesitan un partido en esta liga en el que estés convocado como jugador o anotado como espectador (próximo o el último si ya pasó la fecha). Anotate a un partido o esperá a que haya uno programado.",
    toastMessage: "No hay partido en esta liga donde estés convocado o como espectador.",
  },
  NO_COMPLETED_MATCH: {
    alertTitle: "Todavía no jugaste en esta liga",
    alertMessage:
      "Los consumibles post-partido se aplican al último partido ya jugado y cerrado en esta liga en el que hayas participado. Cuando completes un partido con votación cerrada, vas a poder usarlos.",
    toastMessage: "No hay un partido cerrado tuyo en esta liga.",
  },
  TIMING_MISMATCH: {
    alertTitle: "Momento incorrecto",
    alertMessage: "Este consumible no corresponde al tipo de partido actual. Revisá si es pre o post-partido.",
    toastMessage: "El consumible no aplica en este momento.",
  },
  INVALID_SWAP_TARGET: {
    alertTitle: "Canje inválido",
    alertMessage:
      "Para «Robo de ranking» tenés que elegir a otro jugador que haya estado en ese mismo partido. Revisá el ID o elegí a alguien de la lista del partido.",
    toastMessage: "El jugador elegido no sirve para el canje.",
  },
  INVALID_META: {
    alertTitle: "Datos inválidos",
    alertMessage:
      "Los datos enviados no son válidos. Si usás canje con otro jugador, revisá que el identificador sea correcto.",
    toastMessage: "Revisá los datos del consumible.",
  },
  HEIST_NO_PEER: {
    alertTitle: "No hay con quién canjear",
    alertMessage:
      "«Robo de ranking» necesita al menos otro jugador en ese partido. Solo vos figurás en la planilla.",
    toastMessage: "Hace falta otro jugador en el partido.",
  },
  HEIST_NOT_IN_MATCH: {
    alertTitle: "No estabas en ese partido",
    alertMessage:
      "Para este efecto tenés que haber sido jugador en el partido (no alcanza con ser solo espectador en ese encuentro).",
    toastMessage: "Tenés que ser jugador en el partido.",
  },
};

function isShopActivateCode(s: unknown): s is ShopActivateErrorCode {
  return typeof s === "string" && s in MESSAGES;
}

/**
 * Presentación de error para activación de consumibles (modal + toast opcional).
 */
export function resolveShopActivateFailure(error: unknown): ShopActivateFailure {
  const net = getNetworkErrorMessage(error);
  if (net) {
    return {
      alertTitle: "Conexión",
      alertMessage: net,
      toastMessage: "Sin conexión o tiempo agotado.",
    };
  }

  if (axios.isAxiosError(error)) {
    const code = error.response?.data && typeof error.response.data === "object"
      ? (error.response.data as { error?: string }).error
      : undefined;
    if (isShopActivateCode(code)) {
      return MESSAGES[code];
    }
    const fallback = formatUserFacingError(error, "No se pudo activar el consumible.");
    return {
      alertTitle: "No se pudo activar",
      alertMessage: fallback,
      toastMessage: "No se pudo activar.",
    };
  }

  return {
    alertTitle: "No se pudo activar",
    alertMessage: formatUserFacingError(error, "No se pudo activar el consumible."),
    toastMessage: "Error al activar.",
  };
}
