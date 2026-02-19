import { z } from "zod";

/**
 * Esquema para crear un partido.
 * Basado en el controlador `createMatch` y en `CreateMatchInput` de `MatchService`.
 */
export const createMatchSchema = z.object({
  leagueId: z
    .string({ message: "leagueId es requerido" })
    .min(1, "leagueId no puede estar vacío"),
  location: z
    .string({ message: "location es requerida" })
    .min(1, "location no puede estar vacía"),
  dateTime: z
    .string({ message: "dateTime es requerido" })
    .refine((value) => {
      const d = new Date(value);
      return !Number.isNaN(d.getTime());
    }, "Formato de fecha inválido"),
  // Permitimos tanto número como string formateado, pero siempre lo convertimos a number.
  price: z
    .union([
      z.number(),
      z
        .string()
        .transform((v) =>
          parseFloat(v.replace(/\./g, "").replace(",", ".")),
        ),
    ])
    .optional(),
  // Lista opcional de jugadores para el partido inicial.
  players: z
    .array(
      z.object({
        id: z
          .string({ message: "id de jugador requerido" })
          .min(1, "id de jugador no puede estar vacío"),
        team: z
          .string({ message: "team es requerido" })
          .min(1, "team no puede estar vacío"),
      }),
    )
    .optional(),
});

/**
 * Esquema para actualizar el estado de un partido.
 * Se restringe a los valores que usa la app a nivel de negocio.
 */
export const updateMatchStatusSchema = z.object({
  status: z
    .enum(["OPEN", "FINISHED", "COMPLETED", "CANCELLED", "ACTIVE"] as const, {
      message: "status debe ser OPEN, FINISHED, COMPLETED, CANCELLED o ACTIVE",
    })
    .describe("Estado al que se quiere mover el partido"),
});

/**
 * Esquema para actualizar datos de un partido (admin).
 * Alineado con el controlador `updateMatch`.
 */
export const updateMatchSchema = z.object({
  location: z.string().min(1, "location no puede estar vacía").optional(),
  dateTime: z
    .string()
    .refine(
      (value) => {
        const d = new Date(value);
        return !Number.isNaN(d.getTime());
      },
      { message: "Formato de fecha inválido" },
    )
    .optional(),
  price: z
    .union([
      z.number(),
      z
        .string()
        .transform((v) => parseFloat(v.replace(/\./g, "").replace(",", "."))),
    ])
    .optional(),
  players: z
    .array(
      z.object({
        user_id: z
          .string({ message: "user_id es requerido" })
          .min(1, "user_id no puede estar vacío"),
        team: z
          .string({ message: "team es requerido" })
          .min(1, "team no puede estar vacío"),
      }),
    )
    .optional(),
  teamAScore: z
    .coerce
    .number()
    .int("teamAScore debe ser un entero")
    .min(0, "teamAScore no puede ser negativo")
    .optional(),
  teamBScore: z
    .coerce
    .number()
    .int("teamBScore debe ser un entero")
    .min(0, "teamBScore no puede ser negativo")
    .optional(),
});

const rating = z
  .coerce
  .number({ message: "El puntaje debe ser numérico" })
  .int("El puntaje debe ser un entero")
  .min(1, "El puntaje mínimo es 1")
  .max(10, "El puntaje máximo es 10");

/** Opcional: 0 = no puntuado, 1-10 = puntaje (p. ej. voto propio sin sub-stats). */
const optionalRating = z
  .coerce
  .number()
  .int()
  .min(0, "El puntaje no puede ser negativo")
  .max(10, "El puntaje máximo es 10")
  .optional();

/**
 * Esquema para enviar votos de un partido.
 * overall obligatorio 1-10; technique/pace/defense/etc. opcionales (0 = no puntuado).
 */
export const submitVoteSchema = z.object({
  votes: z
    .array(
      z.object({
        voted_user_id: z
          .string({ message: "voted_user_id es requerido" })
          .min(1, "voted_user_id no puede estar vacío"),
        overall: rating,
        comment: z.string().max(500).optional(),
        technique: optionalRating,
        physical: optionalRating,
        pace: optionalRating,
        defense: optionalRating,
        attack: optionalRating,
      }),
    )
    .min(1, "Se requiere al menos un voto"),
});

