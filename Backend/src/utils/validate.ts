import type { Request } from "express";
import type { z } from "zod";
import { ZodError } from "zod";
import type { ErrorDetail } from "./httpErrors.js";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; details: ErrorDetail[] };

function zodToDetails(err: ZodError): ErrorDetail[] {
  return err.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : undefined,
    message: i.message,
    code: i.code,
  }));
}

export function validateBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): ValidationResult<z.infer<TSchema>> {
  try {
    const data = schema.parse(req.body);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, details: zodToDetails(e) };
    return { ok: false, details: [{ message: "INVALID_BODY" }] };
  }
}

export function validateParams<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): ValidationResult<z.infer<TSchema>> {
  try {
    const data = schema.parse(req.params);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, details: zodToDetails(e) };
    return { ok: false, details: [{ message: "INVALID_PARAMS" }] };
  }
}

export function validateQuery<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): ValidationResult<z.infer<TSchema>> {
  try {
    const data = schema.parse(req.query);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, details: zodToDetails(e) };
    return { ok: false, details: [{ message: "INVALID_QUERY" }] };
  }
}

