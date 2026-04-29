type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getEnvLogLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL ?? "").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[getEnvLogLevel()];
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { name?: unknown; message?: unknown; stack?: unknown; code?: unknown };
    return {
      name: typeof anyErr.name === "string" ? anyErr.name : "Error",
      message: typeof anyErr.message === "string" ? anyErr.message : JSON.stringify(err),
      stack: typeof anyErr.stack === "string" ? anyErr.stack : undefined,
      code: anyErr.code,
    };
  }
  return { name: "Error", message: String(err) };
}

function emit(level: LogLevel, payload: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload,
  });
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export function createLogger(scope: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      emit("debug", { scope, message, ...(meta ?? {}) });
    },
    info(message: string, meta?: Record<string, unknown>) {
      emit("info", { scope, message, ...(meta ?? {}) });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      emit("warn", { scope, message, ...(meta ?? {}) });
    },
    error(message: string, meta?: Record<string, unknown>) {
      emit("error", { scope, message, ...(meta ?? {}) });
    },
    errorWithErr(message: string, err: unknown, meta?: Record<string, unknown>) {
      emit("error", { scope, message, err: serializeError(err), ...(meta ?? {}) });
    },
  };
}

