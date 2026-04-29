import * as SecureStore from "expo-secure-store";

type ExpiredHandler = () => void;

let onExpired: ExpiredHandler | null = null;
let expiryInFlight: Promise<void> | null = null;

export function setOnSessionExpired(handler: ExpiredHandler | null) {
  onExpired = handler;
}

/** Login/registro: un 401 es credencial inválida, no sesión global. */
function isAuthCredentialRequest(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("/auth/login") ||
    u.includes("/auth/register") ||
    u.includes("/auth/verify") ||
    u.includes("/auth/forgot-password") ||
    u.includes("/auth/reset-password")
  );
}

/** Si devuelve true, el 401 debe limpiar token y mandar al login. */
export function shouldClearSessionOn401(url: string | undefined): boolean {
  if (!url) return true;
  return !isAuthCredentialRequest(url);
}

/**
 * Limpia sesión y notifica una sola vez aunque lleguen varios 401 en paralelo.
 */
export function notifySessionExpired(): Promise<void> {
  if (expiryInFlight) return expiryInFlight;

  expiryInFlight = (async () => {
    try {
      const hadToken = await SecureStore.getItemAsync("userToken");
      try {
        await SecureStore.deleteItemAsync("userToken");
      } catch {
        /* SecureStore puede fallar en edge cases */
      }
      try {
        const { PurchaseManager } = await import("../services/PurchaseManager");
        await PurchaseManager.logOut();
      } catch {
        /* RevenueCat opcional */
      }
      if (hadToken) {
        try {
          onExpired?.();
        } catch {
          /* router no disponible */
        }
      }
    } finally {
      expiryInFlight = null;
    }
  })();

  return expiryInFlight;
}
