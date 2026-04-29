import { z } from "zod";

const weekday = z
  .coerce
  .number()
  .int("Debe ser un entero")
  .min(0, "Día inválido (0..6)")
  .max(6, "Día inválido (0..6)");

const timeHHmm = z
  .string({ message: "Hora requerida" })
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:mm)");

const price = z
  .union([
    z.number(),
    z.string().transform((v) => parseFloat(v.replace(/\./g, "").replace(",", "."))),
  ])
  .transform((n) => Number(n))
  .refine((n) => Number.isFinite(n) && n >= 0, "Precio inválido");

const matchMode = z.enum(["INTERNAL", "EXTERNAL"] as const).optional();

export const createScheduledRuleSchema = z
  .object({
    createOnWeekday: weekday,
    targetWeekday: weekday,
    targetTime: timeHHmm,
    location: z.string().trim().max(255).optional().default(""),
    price,
    isOpenSignup: z.coerce.boolean().default(false),
    maxPlayers: z.coerce.number().int().min(2, "Cupos mínimo 2").optional(),
    matchMode,
    convokedUserIds: z.array(z.string().min(1)).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.isOpenSignup) {
      if (data.maxPlayers == null || !Number.isFinite(data.maxPlayers) || data.maxPlayers < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxPlayers"],
          message: "Debes definir cupos (mínimo 2) para anotación abierta.",
        });
      }
      return;
    }
    if (!Array.isArray(data.convokedUserIds) || data.convokedUserIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["convokedUserIds"],
        message: "Debes convocar al menos 1 jugador (o habilitar anotación abierta).",
      });
    }
  });

export const updateScheduledRuleSchema = z
  .object({
    isActive: z.coerce.boolean().optional(),
    createOnWeekday: weekday.optional(),
    targetWeekday: weekday.optional(),
    targetTime: timeHHmm.optional(),
    location: z.string().trim().max(255).optional(),
    price: price.optional(),
    isOpenSignup: z.coerce.boolean().optional(),
    maxPlayers: z.coerce.number().int().min(2, "Cupos mínimo 2").optional(),
    matchMode,
    convokedUserIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isOpenSignup === true) {
      if (data.maxPlayers == null || !Number.isFinite(data.maxPlayers) || data.maxPlayers < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxPlayers"],
          message: "Debes definir cupos (mínimo 2) para anotación abierta.",
        });
      }
    }
  });

