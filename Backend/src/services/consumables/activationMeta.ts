import { z } from "zod";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(s: unknown): s is string {
  return typeof s === "string" && uuidRe.test(s.trim());
}

/** Body opcional al activar: canje con otro jugador del mismo partido. */
export const postActivateMetaSchema = z
  .object({
    swapWithUserId: z.string().uuid().optional(),
  })
  .strict();

export type PostActivateMeta = z.infer<typeof postActivateMetaSchema>;

export function parsePostActivateMeta(
  raw: Record<string, unknown> | null | undefined,
): { ok: true; value: PostActivateMeta } | { ok: false; error: "INVALID_META" } {
  if (raw == null || (typeof raw === "object" && Object.keys(raw).length === 0)) {
    return { ok: true, value: {} };
  }
  const r = postActivateMetaSchema.safeParse(raw);
  if (!r.success) {
    return { ok: false, error: "INVALID_META" };
  }
  return { ok: true, value: r.data };
}
