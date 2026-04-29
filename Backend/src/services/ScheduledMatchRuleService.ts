import { prisma } from "../server.js";
import { sendNotification } from "./NotificationService.js";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom ... 6=Sáb

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseTimeHHmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, m: mi };
}

function nextWeekdayDate(fromDate: Date, targetWeekday: Weekday): Date {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const todayW = from.getDay() as Weekday;
  let delta = (targetWeekday - todayW + 7) % 7;
  if (delta === 0) delta = 7; // "próximo" (no hoy)
  const d = new Date(from);
  d.setDate(d.getDate() + delta);
  return d;
}

function withLocalTime(dateOnly: Date, hhmm: string): Date | null {
  const t = parseTimeHHmm(hhmm);
  if (!t) return null;
  return new Date(
    dateOnly.getFullYear(),
    dateOnly.getMonth(),
    dateOnly.getDate(),
    t.h,
    t.m,
    0,
    0,
  );
}

async function getEligibleConvokedUserIds(leagueId: string, userIds: string[]): Promise<string[]> {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const uniqueIds = [...new Set(userIds.map(String))].filter(Boolean);
  if (uniqueIds.length === 0) return [];

  const rows = await prisma.league_members.findMany({
    where: {
      league_id: leagueId,
      user_id: { in: uniqueIds },
      is_banned: { not: true },
    },
    select: { user_id: true },
  });
  return rows.map((r) => r.user_id);
}

export async function runScheduledMatchRulesForToday(now = new Date()): Promise<void> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = today.getDay() as Weekday;

  const rules = await prisma.scheduled_match_rules.findMany({
    where: { is_active: true, create_on_weekday: weekday },
    select: {
      id: true,
      league_id: true,
      created_by_user_id: true,
      target_weekday: true,
      target_time: true,
      location_name: true,
      price_per_player: true,
      is_open_signup: true,
      max_players: true,
      match_mode: true,
      convoked_user_ids: true,
    },
  });

  for (const rule of rules as any[]) {
    const targetDay = nextWeekdayDate(today, Number(rule.target_weekday) as Weekday);
    const matchDateTime = withLocalTime(targetDay, String(rule.target_time));
    if (!matchDateTime) continue;

    const matchDayKey = toDateKey(targetDay);
    const occurrenceKey = `rule:${rule.id}:${matchDayKey}`;

    // Upsert ocurrencia para idempotencia, y si falta match, crearlo.
    const created = await prisma.$transaction(async (tx) => {
      const occDate = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate());

      const occ = await tx.scheduled_match_rule_occurrences.upsert({
        where: { rule_id_match_date: { rule_id: rule.id, match_date: occDate } },
        create: { rule_id: rule.id, match_date: occDate, match_id: null },
        update: {},
        select: { id: true, match_id: true },
      });

      if (occ.match_id) return { matchId: occ.match_id, createdNow: false as const };

      // Si ya existe un match con esta key, linkearlo y salir.
      const existingMatch = await tx.matches.findUnique({
        where: { scheduled_occurrence_key: occurrenceKey },
        select: { id: true },
      });
      if (existingMatch?.id) {
        await tx.scheduled_match_rule_occurrences.update({
          where: { id: occ.id },
          data: { match_id: existingMatch.id },
        });
        return { matchId: existingMatch.id, createdNow: false as const };
      }

      const isOpenSignup = rule.is_open_signup === true;
      const convokedIdsRaw = isOpenSignup ? [] : (Array.isArray(rule.convoked_user_ids) ? rule.convoked_user_ids : []);
      const convokedIds = isOpenSignup
        ? []
        : await getEligibleConvokedUserIds(rule.league_id, convokedIdsRaw as string[]);

      const players = isOpenSignup
        ? undefined
        : convokedIds.map((id) => ({
            id,
            team: String(rule.match_mode ?? "INTERNAL").toUpperCase() === "EXTERNAL" ? "A" : "UNASSIGNED",
          }));

      const match = await tx.matches.create({
        data: {
          league_id: rule.league_id,
          admin_id: rule.created_by_user_id,
          location_name: rule.location_name ?? null,
          date_time: matchDateTime,
          price_per_player: rule.price_per_player ?? null,
          status: "OPEN",
          is_open_signup: isOpenSignup,
          max_players: isOpenSignup ? (typeof rule.max_players === "number" ? rule.max_players : null) : null,
          match_mode: String(rule.match_mode ?? "INTERNAL").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "INTERNAL",
          team_a_score: 0,
          team_b_score: 0,
          scheduled_rule_id: rule.id,
          scheduled_occurrence_key: occurrenceKey,
          match_players: players
            ? {
                createMany: {
                  data: players.map((p) => ({
                    user_id: p.id,
                    team: p.team,
                    has_confirmed: false,
                    match_rating: 0,
                  })),
                },
              }
            : undefined,
        },
        select: { id: true, league_id: true, date_time: true, location_name: true },
      });

      await tx.scheduled_match_rule_occurrences.update({
        where: { id: occ.id },
        data: { match_id: match.id },
      });

      return { matchId: match.id, createdNow: true as const, convokedIds, match };
    });

    // Notificaciones fuera de la tx (fire-and-forget)
    if ((created as any).createdNow === true) {
      const convokedIds = (created as any).convokedIds as string[] | undefined;
      const match = (created as any).match as { id: string; league_id: string | null; date_time: Date; location_name: string | null } | undefined;
      if (match && convokedIds && convokedIds.length > 0) {
        const matchDateStr = match.date_time.toLocaleDateString("es-AR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const title = "Te convocaron";
        const body = `${match.location_name ?? "Partido"} – ${matchDateStr}. Confirmá tu asistencia.`;
        const data = { matchId: match.id, leagueId: match.league_id ?? undefined };
        for (const uid of convokedIds) {
          sendNotification(uid, "MATCH_SUMMON", title, body, data).catch(() => {});
        }
      }
    }
  }
}

