import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { Prisma } from "../generated/client/index.js";
import { sendError } from "../utils/httpErrors.js";
import { validateBody } from "../utils/validate.js";
import { z } from "zod";
import { isLeagueStaffRole } from "../constants/domain.js";
import { createLogger } from "../utils/logger.js";
import { ensureNextScheduledMatchForRule } from "../services/ScheduledMatchRuleService.js";

const log = createLogger("scheduledMatchRuleController");

async function isLeagueStaff(leagueId: string, userId: string): Promise<boolean> {
  const league = await prisma.leagues.findUnique({
    where: { id: leagueId },
    select: { admin_id: true },
  });
  if (league?.admin_id === userId) return true;

  const member = await prisma.league_members.findUnique({
    where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
    select: { role: true, is_banned: true },
  });
  if (!member || member.is_banned === true) return false;
  return isLeagueStaffRole(member.role);
}

const createScheduledRuleBodySchema = z.object({
  createOnWeekday: z.coerce.number().int().min(0).max(6),
  targetWeekday: z.coerce.number().int().min(0).max(6),
  targetTime: z.string().min(1).max(10),
  location: z.string().trim().min(1).max(120).optional().nullable(),
  price: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  isOpenSignup: z.boolean().optional().default(false),
  maxPlayers: z.coerce.number().int().min(2).max(60).optional().nullable(),
  matchMode: z.enum(["INTERNAL", "EXTERNAL"]).optional().default("INTERNAL"),
  convokedUserIds: z.array(z.string().uuid()).optional(),
});

export async function listScheduledRules(req: Request, res: Response) {
  try {
    const leagueId = String(req.params.leagueId ?? "");
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });
    if (!leagueId) return sendError(res, 400, { error: "Falta leagueId" });

    const isMember = await prisma.league_members.findUnique({
      where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
      select: { user_id: true, is_banned: true },
    });
    if (!isMember || isMember.is_banned === true) {
      return sendError(res, 403, { error: "FORBIDDEN", message: "No perteneces a la liga." });
    }

    const rules = await prisma.scheduled_match_rules.findMany({
      where: { league_id: leagueId },
      orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
      select: {
        id: true,
        league_id: true,
        created_by_user_id: true,
        is_active: true,
        create_on_weekday: true,
        target_weekday: true,
        target_time: true,
        location_name: true,
        price_per_player: true,
        is_open_signup: true,
        max_players: true,
        match_mode: true,
        convoked_user_ids: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.json(rules);
  } catch (err) {
    log.errorWithErr("listScheduledRules failed", err, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error listando reglas programadas" });
  }
}

export async function getScheduledRule(req: Request, res: Response) {
  try {
    const leagueId = String(req.params.leagueId ?? "");
    const ruleId = String(req.params.ruleId ?? "");
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });
    if (!leagueId || !ruleId) return sendError(res, 400, { error: "Faltan parámetros" });

    const isMember = await prisma.league_members.findUnique({
      where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
      select: { user_id: true, is_banned: true },
    });
    if (!isMember || isMember.is_banned === true) {
      return sendError(res, 403, { error: "FORBIDDEN", message: "No perteneces a la liga." });
    }

    const rule = await prisma.scheduled_match_rules.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        league_id: true,
        created_by_user_id: true,
        is_active: true,
        create_on_weekday: true,
        target_weekday: true,
        target_time: true,
        location_name: true,
        price_per_player: true,
        is_open_signup: true,
        max_players: true,
        match_mode: true,
        convoked_user_ids: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!rule || rule.league_id !== leagueId) {
      return sendError(res, 404, { error: "NOT_FOUND", message: "Regla no encontrada." });
    }

    return res.json(rule);
  } catch (err) {
    log.errorWithErr("getScheduledRule failed", err, { leagueId: req.params.leagueId, ruleId: req.params.ruleId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error obteniendo regla programada" });
  }
}

export async function createScheduledRule(req: Request, res: Response) {
  try {
    const leagueId = String(req.params.leagueId ?? "");
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });
    if (!leagueId) return sendError(res, 400, { error: "Falta leagueId" });

    const canManage = await isLeagueStaff(leagueId, userId);
    if (!canManage) {
      return sendError(res, 403, { error: "FORBIDDEN", message: "Sin permisos para gestionar reglas." });
    }

    const parsed = validateBody(req, createScheduledRuleBodySchema);
    if (!parsed.ok) {
      return sendError(res, 400, {
        error: "INVALID_BODY",
        details: parsed.details,
      });
    }
    const {
      createOnWeekday,
      targetWeekday,
      targetTime,
      location,
      price,
      isOpenSignup,
      maxPlayers,
      matchMode,
      convokedUserIds,
    } = parsed.data;

    const open = isOpenSignup === true;
    const priceNum = Number(price ?? 0);
    const max = open ? (maxPlayers == null ? null : Number(maxPlayers)) : null;
    const convoked = open ? [] : [...new Set((convokedUserIds ?? []).map(String))];

    const created = await prisma.scheduled_match_rules.create({
      data: {
        league_id: leagueId,
        created_by_user_id: userId,
        is_active: true,
        create_on_weekday: createOnWeekday,
        target_weekday: targetWeekday,
        target_time: targetTime.trim(),
        location_name: location ? String(location).trim() : null,
        price_per_player: priceNum,
        is_open_signup: open,
        max_players: open ? max : null,
        match_mode: matchMode,
        convoked_user_ids: open ? Prisma.DbNull : (convoked as any),
      },
    });

    // Catch-up inicial: si el próximo partido objetivo todavía no existe, crearlo ahora.
    // (Evita que el admin tenga que crear el primer match a mano.)
    try {
      await ensureNextScheduledMatchForRule(created.id, new Date());
    } catch (err) {
      log.errorWithErr("ensureNextScheduledMatchForRule failed", err, { leagueId, ruleId: created.id, userId });
    }

    return res.status(201).json({ message: "Regla creada", rule: created });
  } catch (err) {
    log.errorWithErr("createScheduledRule failed", err, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error creando regla programada" });
  }
}

export async function updateScheduledRule(req: Request, res: Response) {
  try {
    const leagueId = String(req.params.leagueId ?? "");
    const ruleId = String(req.params.ruleId ?? "");
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });
    if (!leagueId || !ruleId) return sendError(res, 400, { error: "Faltan parámetros" });

    const canManage = await isLeagueStaff(leagueId, userId);
    if (!canManage) {
      return sendError(res, 403, { error: "FORBIDDEN", message: "Sin permisos para gestionar reglas." });
    }

    const current = await prisma.scheduled_match_rules.findUnique({
      where: { id: ruleId },
      select: { id: true, league_id: true },
    });
    if (!current || current.league_id !== leagueId) {
      return sendError(res, 404, { error: "NOT_FOUND", message: "Regla no encontrada." });
    }

    const patch: any = {};
    const body = (req.body ?? {}) as any;

    if (body.isActive !== undefined) patch.is_active = body.isActive === true;
    if (body.createOnWeekday !== undefined) patch.create_on_weekday = Number(body.createOnWeekday);
    if (body.targetWeekday !== undefined) patch.target_weekday = Number(body.targetWeekday);
    if (body.targetTime !== undefined) patch.target_time = String(body.targetTime).trim();
    if (body.location !== undefined) patch.location_name = body.location ? String(body.location).trim() : null;
    if (body.price !== undefined) patch.price_per_player = Number(body.price);
    if (body.matchMode !== undefined) patch.match_mode = String(body.matchMode ?? "INTERNAL").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "INTERNAL";
    if (body.isOpenSignup !== undefined) patch.is_open_signup = body.isOpenSignup === true;
    if (body.maxPlayers !== undefined) patch.max_players = body.maxPlayers == null ? null : Number(body.maxPlayers);
    if (body.convokedUserIds !== undefined) {
      patch.convoked_user_ids = Array.isArray(body.convokedUserIds)
        ? [...new Set(body.convokedUserIds.map(String))].filter(Boolean)
        : Prisma.DbNull;
    }

    // Normalización: si queda open_signup true, no guardar convocados.
    if (patch.is_open_signup === true) {
      patch.convoked_user_ids = Prisma.DbNull;
    } else if (patch.is_open_signup === false) {
      patch.max_players = null;
    }

    const updated = await prisma.scheduled_match_rules.update({
      where: { id: ruleId },
      data: patch,
    });

    return res.json({ message: "Regla actualizada", rule: updated });
  } catch (err) {
    log.errorWithErr("updateScheduledRule failed", err, { leagueId: req.params.leagueId, ruleId: req.params.ruleId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error actualizando regla programada" });
  }
}

export async function deleteScheduledRule(req: Request, res: Response) {
  try {
    const leagueId = String(req.params.leagueId ?? "");
    const ruleId = String(req.params.ruleId ?? "");
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });
    if (!leagueId || !ruleId) return sendError(res, 400, { error: "Faltan parámetros" });

    const canManage = await isLeagueStaff(leagueId, userId);
    if (!canManage) {
      return sendError(res, 403, { error: "FORBIDDEN", message: "Sin permisos para gestionar reglas." });
    }

    const current = await prisma.scheduled_match_rules.findUnique({
      where: { id: ruleId },
      select: { id: true, league_id: true },
    });
    if (!current || current.league_id !== leagueId) {
      return sendError(res, 404, { error: "NOT_FOUND", message: "Regla no encontrada." });
    }

    await prisma.scheduled_match_rules.delete({ where: { id: ruleId } });
    return res.json({ message: "Regla eliminada" });
  } catch (err) {
    log.errorWithErr("deleteScheduledRule failed", err, { leagueId: req.params.leagueId, ruleId: req.params.ruleId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error eliminando regla programada" });
  }
}

