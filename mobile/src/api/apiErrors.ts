import axios from "axios";

export const USER_FACING_GENERIC_ERROR = "Algo salió mal. Intentá de nuevo.";

/**
 * Texto que no debería mostrarse en una alerta (stack, Axios, fetch interno, etc.).
 */
export function isTechnicalUserMessage(text: string): boolean {
  const s = text.trim();
  if (s.length === 0) return true;
  if (s.length > 480) return true;
  const lower = s.toLowerCase();

  if (lower.includes("axioserror")) return true;
  if (lower.includes("axios error")) return true;
  if (lower.includes("request failed with status code")) return true;
  if (/^network error$/i.test(s)) return true;
  if (lower.includes("err_network")) return true;
  if (lower.includes("err_canceled") || lower.includes("cancelederror")) return true;
  if (lower.includes("econnrefused")) return true;
  if (lower.includes("enetunreach")) return true;
  if (lower.includes("socket hang up")) return true;
  if (lower.includes("exceeded") && lower.includes("timeout")) return true;
  if (lower.includes("cannot read propert")) return true;
  if (lower.includes("undefined is not")) return true;
  if (lower.includes("is not a function")) return true;
  if (/\[native code\]/i.test(s)) return true;
  if (/ at .+ \(.+\.(tsx?|jsx?):\d+:\d+\)/.test(s)) return true;
  if (/^error\s+\d{3}$/i.test(s)) return true;

  return false;
}

export type AlertTone = "success" | "error" | "warning" | "info";

function inferToneFromTitle(title: string | undefined, declared: AlertTone): AlertTone {
  if (declared !== "info") return declared;
  const tl = (title ?? "").trim().toLowerCase();
  if (tl === "error") return "error";
  return declared;
}

/**
 * Limpia el cuerpo del modal de alerta antes de mostrarlo (última línea de defensa).
 */
export function sanitizeAlertBody(
  message: string | undefined,
  alertType: AlertTone,
  title?: string,
): string | undefined {
  if (message == null) return undefined;
  const raw = String(message).trim();
  if (!raw) return undefined;
  const tone = inferToneFromTitle(title, alertType);
  if (!isTechnicalUserMessage(raw)) return raw;
  switch (tone) {
    case "error":
      return USER_FACING_GENERIC_ERROR;
    case "warning":
      return "No se pudo completar la acción.";
    case "success":
      return "Listo.";
    case "info":
    default:
      return "Revisá los datos e intentá de nuevo.";
  }
}

function pickServerMessage(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") {
    const t = data.trim();
    return t.length ? t : null;
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const candidates = [o.error, o.message, (o as { detail?: unknown }).detail];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }
  return null;
}

/**
 * Mensaje user-friendly para fallos de red / timeout (pantallas pueden usar en catch).
 */
export function getNetworkErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  if (error.code === "ECONNABORTED") {
    return "La solicitud tardó demasiado. Revisá tu conexión.";
  }
  if (error.code === "ERR_CANCELED" || error.code === "CanceledError") {
    return null;
  }
  if (error.response == null && error.request != null) {
    return "No pudimos conectar con el servidor. Revisá tu red.";
  }
  return null;
}

/**
 * Construye un mensaje seguro a partir de un error de API (para usar en catch antes de showAlert).
 */
export function formatUserFacingError(error: unknown, fallback: string): string {
  const net = getNetworkErrorMessage(error);
  if (net) return net;

  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") {
      return "La operación fue cancelada.";
    }

    const server = pickServerMessage(error.response?.data);
    if (server && !isTechnicalUserMessage(server)) return server;

    const st = error.response?.status;
    if (st === 413) return "El archivo es demasiado grande.";
    if (st === 429) return "Demasiados intentos. Probá más tarde.";
    if (st === 502 || st === 503 || st === 504) {
      return "El servidor no está disponible. Probá más tarde.";
    }
    return fallback;
  }

  return fallback;
}
