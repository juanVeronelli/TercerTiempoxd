/**
 * Compat: antes registraba vía update-profile. Ahora todo pasa por PUT /auth/push-token.
 */
export { registerExpoPushTokenWithBackend as registerPushToken } from "./registerExpoPush";
