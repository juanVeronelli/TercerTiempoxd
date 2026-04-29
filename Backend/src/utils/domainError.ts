import type { ErrorDetail } from "./httpErrors.js";

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
  readonly extra?: Record<string, unknown>;

  constructor(params: {
    status: number;
    code: string;
    message?: string;
    details?: ErrorDetail[];
    extra?: Record<string, unknown>;
  }) {
    super(params.message ?? params.code);
    this.name = "DomainError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.extra = params.extra;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "DomainError" &&
    typeof (err as { status?: unknown }).status === "number" &&
    typeof (err as { code?: unknown }).code === "string"
  );
}

