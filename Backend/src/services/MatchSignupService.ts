import { prisma } from "../server.js";
import { DomainError } from "../utils/domainError.js";
import { MatchMode, MatchStatus, normalizeUpper } from "../constants/domain.js";
import { lockMatchRow } from "../utils/locks.js";

export async function signupToMatch(params: { matchId: string; userId: string }): Promise<{
  joined: true;
  team: "A" | "B" | null;
}> {
  const { matchId, userId } = params;

  return prisma.$transaction(async (tx) => {
    // Lock de partido para evitar carreras en cupos / asignación de equipos.
    // Sin esto, 2 requests concurrentes pueden "pasar" el count antes de insertar.
    await lockMatchRow(tx, matchId);

    const match = await tx.matches.findUnique({
      where: { id: matchId },
      select: { league_id: true, status: true, is_open_signup: true, max_players: true, match_mode: true },
    });

    if (!match?.league_id) {
      throw new DomainError({ status: 404, code: "MATCH_NOT_FOUND", message: "Partido no encontrado" });
    }
    if (match.is_open_signup !== true) {
      throw new DomainError({
        status: 400,
        code: "NOT_OPEN_SIGNUP",
        message: "Este partido no es de anotación abierta.",
      });
    }
    if (normalizeUpper(match.status) !== MatchStatus.OPEN) {
      throw new DomainError({
        status: 400,
        code: "NOT_OPEN",
        message: "La anotación solo está disponible mientras está en inscripciones.",
      });
    }

    const member = await tx.league_members.findUnique({
      where: { league_id_user_id: { league_id: match.league_id, user_id: userId } },
      select: { user_id: true, is_banned: true },
    });
    if (!member || member.is_banned === true) {
      throw new DomainError({
        status: 403,
        code: "FORBIDDEN",
        message: "Debes ser miembro activo de la liga.",
      });
    }

    const already = await tx.match_players.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { user_id: true },
    });
    if (already) return { joined: true as const, team: null };

    const max = match.max_players ?? null;
    if (typeof max === "number") {
      const current = await tx.match_players.count({ where: { match_id: matchId } });
      if (current >= max) {
        throw new DomainError({ status: 400, code: "FULL", message: "Se agotaron los cupos." });
      }
    }

    const isExternal =
      normalizeUpper(match.match_mode ?? MatchMode.INTERNAL) === MatchMode.EXTERNAL;

    let team: "A" | "B" = "A";
    if (!isExternal) {
      const [aCount, bCount] = await Promise.all([
        tx.match_players.count({ where: { match_id: matchId, team: "A" } }),
        tx.match_players.count({ where: { match_id: matchId, team: "B" } }),
      ]);
      team = aCount <= bCount ? "A" : "B";
    }

    await tx.match_players.create({
      data: {
        match_id: matchId,
        user_id: userId,
        team,
        has_confirmed: true,
        confirmed_at: new Date(),
        match_rating: 0,
      },
    });

    return { joined: true as const, team };
  });
}

export async function unsignupFromMatch(params: { matchId: string; userId: string }): Promise<{
  removed: true;
}> {
  const { matchId, userId } = params;

  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { is_open_signup: true, status: true },
  });
  if (!match) {
    throw new DomainError({ status: 404, code: "MATCH_NOT_FOUND", message: "Partido no encontrado" });
  }
  if (match.is_open_signup !== true) {
    throw new DomainError({
      status: 400,
      code: "NOT_OPEN_SIGNUP",
      message: "Este partido no es de anotación abierta.",
    });
  }
  if (normalizeUpper(match.status) !== MatchStatus.OPEN) {
    throw new DomainError({
      status: 400,
      code: "NOT_OPEN",
      message: "Ya no puedes desanotarte en esta fase.",
    });
  }

  const result = await prisma.match_players.deleteMany({
    where: { match_id: matchId, user_id: userId },
  });
  if (result.count === 0) {
    throw new DomainError({
      status: 400,
      code: "NOT_SIGNED",
      message: "No estabas anotado.",
    });
  }
  return { removed: true as const };
}

