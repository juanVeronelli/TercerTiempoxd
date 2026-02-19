import { z } from "zod";

/**
 * Esquema para enviar una predicción.
 * Valida que questionId y optionId existan (no vacíos).
 * La verificación de existencia real en base de datos se hace en el servicio.
 */
export const predictionSchema = z.object({
  questionId: z
    .string({ message: "questionId es requerido" })
    .min(1, "questionId no puede estar vacío"),
  optionId: z
    .string({ message: "optionId es requerido" })
    .min(1, "optionId no puede estar vacío"),
});

