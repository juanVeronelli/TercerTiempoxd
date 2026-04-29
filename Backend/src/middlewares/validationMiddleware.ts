import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { sendError } from "../utils/httpErrors.js";

type ValidationSchema = ZodTypeAny;

/**
 * Middleware genérico de validación basado en Zod.
 * - Recibe un esquema Zod.
 * - Valida `req.body`.
 * - Si falla, responde con 400 y detalles claros de los errores.
 * - Si pasa, reemplaza `req.body` por la versión parseada (tipada/normalizada).
 */
export const validateRequest =
  (schema: ValidationSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const body = req.body != null ? req.body : {};
    const result = schema.safeParse(body);

    if (result.success === false) {
      const err = result.error;
      const issues = (err as any).issues ?? (err as any).errors ?? [];
      const details = issues.map((issue: { path?: (string | number)[]; message?: string; code?: string }) => ({
        path: Array.isArray(issue.path) ? issue.path.join(".") : undefined,
        message: issue.message ?? "Validation failed",
        code: issue.code,
      }));

      const firstMessage = details[0]?.message ?? "Validation error";
      return sendError(res, 400, {
        error: "INVALID_BODY",
        message: firstMessage,
        details,
      });
    }

    req.body = result.data as any;
    return next();
  };

