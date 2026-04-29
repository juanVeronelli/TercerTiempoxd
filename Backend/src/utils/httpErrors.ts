import type { Response } from "express";
import { isDomainError } from "./domainError.js";

export type ErrorDetail = {
  path?: string;
  message: string;
  code?: string;
};

/**
 * Respuesta de error estándar para toda la API.
 * Mantiene compatibilidad: `error` + `message` (string), y opcional `details`.
 */
export function sendError(
  res: Response,
  status: number,
  params: { error: string; message?: string; details?: ErrorDetail[]; extra?: Record<string, unknown> },
) {
  const payload: Record<string, unknown> = {
    error: params.error,
    message: params.message ?? params.error,
  };
  if (params.details && params.details.length > 0) payload.details = params.details;
  if (params.extra) Object.assign(payload, params.extra);
  return res.status(status).json(payload);
}

/**
 * Maneja un error capturado y responde con el formato estándar.
 * - Si es `DomainError`, usa su status/code/details/extra
 * - Si no, responde con el fallback (default 500)
 */
export function sendCaughtError(
  res: Response,
  err: unknown,
  fallback: { status?: number; error?: string; message?: string } = {},
) {
  if (isDomainError(err)) {
    return sendError(res, err.status, {
      error: err.code,
      message: err.message,
      details: err.details,
      extra: err.extra,
    });
  }
  return sendError(res, fallback.status ?? 500, {
    error: fallback.error ?? "INTERNAL_ERROR",
    message: fallback.message ?? "Internal server error",
  });
}

