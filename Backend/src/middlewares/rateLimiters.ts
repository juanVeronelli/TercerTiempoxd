import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Limitador general:
 * - Producción: 1000 peticiones por 15 min por IP (navegación normal de la app).
 * - Desarrollo: 5000 por 15 min para no cortar al probar/navegar.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDev ? 5000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message:
      "Has enviado demasiadas peticiones. Por favor, inténtalo de nuevo más tarde.",
  },
});

/**
 * Limitador para autenticación (login):
 * - Máx 5 intentos por hora por IP.
 * - Protege contra fuerza bruta básica en /auth/login.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts",
    message:
      "Has superado el número de intentos de login permitidos. Intenta de nuevo más tarde.",
  },
});

/**
 * Limitador para creación de partidos:
 * - Máx 5 creaciones por hora por IP.
 * - Protege contra spam de creación de recursos.
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many create requests",
    message:
      "Has creado demasiados partidos en poco tiempo. Intenta de nuevo más tarde.",
  },
});

