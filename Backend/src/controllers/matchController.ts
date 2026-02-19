import type { Request, Response } from "express";
import { prisma } from "../server.js";
import * as MatchService from "../services/MatchService.js";
import * as DuelService from "../services/DuelService.js";
import * as PredictionService from "../services/PredictionService.js";
import { sendNotification } from "../services/NotificationService.js";

export const createMatch = async (req: Request, res: Response) => {
  try {
    const { leagueId, location, dateTime, price, players } = req.body;
    const userId = (req as any).user?.userId;

    if (!leagueId || !location || !dateTime) {
      return res
        .status(400)
        .json({ error: "Faltan datos obligatorios (Liga, Lugar o Fecha)." });
    }

    const matchDate = new Date(dateTime);
    if (isNaN(matchDate.getTime())) {
      return res.status(400).json({ error: "Formato de fecha inválido." });
    }

    let finalPrice = 0;
    if (typeof price === "string") {
      finalPrice = parseFloat(price.replace(/\./g, "").replace(",", "."));
    } else {
      finalPrice = Number(price);
    }

    const league = await prisma.leagues.findUnique({ where: { id: leagueId } });
    if (!league || league.admin_id !== userId) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para crear partidos en esta liga." });
    }

    const result = await MatchService.createMatch({
      leagueId,
      adminId: userId,
      location,
      dateTime: matchDate,
      price: finalPrice,
      players,
    });

    res.status(201).json({
      message: "Partido creado exitosamente",
      match: result,
    });

    PredictionService.createMatchPredictionGroup(result.id).catch((err) => {
      console.error("[createMatch] Prediction group creation failed:", err);
    });

    // Notificaciones: convocatoria a cada jugador convocado
    if (players && Array.isArray(players) && players.length > 0) {
      const matchDateStr = matchDate.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const title = "Te convocaron";
      const body = `${location} – ${matchDateStr}. Confirmá tu asistencia.`;
      const data = { matchId: result.id, leagueId };
      for (const p of players) {
        const uid = (p as { id: string }).id;
        if (uid) {
          sendNotification(uid, "MATCH_SUMMON", title, body, data).catch((err) =>
            console.error("[createMatch] MATCH_SUMMON failed for", uid, err),
          );
        }
      }
    }
  } catch (error) {
    console.error("Error creating match:", error);
    res.status(500).json({ error: "Error interno al crear el partido." });
  }
};

export const getNextMatch = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId; // Aquí userId es string | undefined

    // 1. VALIDACIÓN ESTRICTA (Soluciona el error 1 y 3)
    // Si no hay userId, detenemos todo. TypeScript ahora sabe que abajo userId es string.
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!leagueId) {
      return res.status(400).json({ error: "Falta leagueId" });
    }

    // 2. QUERY (Ahora segura)
    const nextMatch = await prisma.matches.findFirst({
      where: {
        league_id: leagueId,
        date_time: { gte: new Date() },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
      orderBy: { date_time: "asc" },
      include: {
        match_players: {
          // Como ya validamos arriba, aquí userId es definitivamente 'string'
          where: { user_id: userId },
        },
      },
    });

    if (!nextMatch) {
      return res.json(null);
    }

    // 3. LOGICA DE ESTADO (Soluciona el error 2)
    // TypeScript ahora sabe que nextMatch tiene match_players gracias al include de arriba
    const playerRecord = nextMatch.match_players[0];
    let userStatus = "NOT_CONVOKED";

    if (playerRecord) {
      userStatus = playerRecord.has_confirmed ? "CONFIRMED" : "PENDING";
    }

    // Devolvemos respuesta limpia
    const response = {
      ...nextMatch,
      user_status: userStatus,
      match_players: undefined,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching next match" });
  }
};

export const getAllMatches = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;

    // Traemos TODOS, ordenados por fecha (los más nuevos al final o al principio según prefieras)
    // Aquí ordenamos 'asc' (el más viejo primero) para ver el calendario cronológico
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { date_time: "asc" },
      include: {
        match_players: { select: { user_id: true, has_confirmed: true } },
      },
    });

    // Procesamos un poco la data para que el frontend reciba el formato que espera NextMatchCard
    // (Calculamos status de usuario como 'NOT_CONVOKED' porque al admin no le importa su propio status en la lista general)
    const formattedMatches = matches.map((match) => ({
      ...match,
      user_status: "NOT_CONVOKED", // Default para admin en vista de lista
    }));

    res.json(formattedMatches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching all matches" });
  }
};

export const confirmMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;

    // VALIDACIÓN ESTRICTA
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!matchId) {
      return res.status(400).json({ error: "Falta matchId" });
    }

    // UPDATE SEGURO
    const result = await prisma.match_players.updateMany({
      where: {
        match_id: matchId,
        user_id: userId,
        matches: { status: "OPEN" },
      },
      data: { has_confirmed: true },
    });

    if (result.count === 0) {
      return res
        .status(400)
        .json({ error: "No se puede confirmar (El partido no está abierto)" });
    }

    res.json({ message: "Asistencia confirmada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error confirmando asistencia" });
  }
};

export const unconfirmMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = (req as any).user?.userId;

    if (!userId) return res.status(401).json({ error: "No autorizado" });

    // 1. Buscamos el partido para ver su estado
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { status: true },
    });

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    // 2. Validación Específica con Mensaje Claro
    if (!match.status)
      return res.status(404).json({ error: "NO se encontro un status" });
    if (match.status !== "OPEN") {
      // TRADUCCIÓN DE ESTADOS PARA EL USUARIO
      const statusMap: any = {
        ACTIVE: "EN JUEGO",
        FINISHED: "FINALIZADO",
        COMPLETED: "CERRADO",
        CANCELLED: "CANCELADO",
      };
      const estadoLeible = statusMap[match.status] || match.status;

      return res.status(400).json({
        error: `No puedes cancelar ahora. El partido está ${estadoLeible}.`,
      });
    }

    // 3. Ejecutar Update
    const result = await prisma.match_players.updateMany({
      where: {
        match_id: matchId,
        user_id: userId,
      },
      data: { has_confirmed: false },
    });

    if (result.count === 0)
      return res
        .status(400)
        .json({ error: "No estabas confirmado en este partido" });

    res.json({ message: "Asistencia cancelada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error cancelando asistencia" });
  }
};

export const getMatchDetails = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          include: {
            users: {
              select: {
                id: true,
                full_name: true,
                username: true,
                profile_photo_url: true,
                avatar_frame: true,
                accent_color: true,
                league_members: {
                  select: {
                    league_id: true,
                    league_overall: true,
                    matches_played: true,
                  },
                },
              },
            },
          },
        },
        // Incluimos todos los campos de los votos para obtener los comentarios
        match_votes: true,
        // Incluimos los honores (MVP, Tronco, etc.)
        honors: true,
      },
    });

    if (!match) return res.status(404).json({ error: "Match not found" });

    const leagueId = match.league_id ?? undefined;

    // 1. Procesamos jugadores con has_voted, datos aplanados y TENDENCIA (vs promedio en la liga)
    const playersWithVoteStatus = match.match_players.map((p) => {
      const currentRating = Number(p.match_rating || 0);
      const leagueMember = leagueId
        ? (p.users as any).league_members?.find(
            (lm: { league_id: string }) => lm.league_id === leagueId,
          )
        : null;
      // Promedio ANTES de este partido (league_overall ya incluye este partido)
      let historicalAvg = 5.0;
      if (leagueMember?.league_overall != null && leagueMember?.matches_played != null) {
        const n = Number(leagueMember.matches_played) || 0;
        const currentAvg = Number(leagueMember.league_overall);
        if (n > 1) {
          historicalAvg =
            (currentAvg * n - currentRating) / (n - 1);
        } else if (n === 1) {
          historicalAvg = currentRating; // solo este partido, tendencia 0
        }
      }
      const trend = currentRating - historicalAvg;

      return {
        ...p,
        has_voted: match.match_votes.some((v) => v.voter_id === p.user_id),
        id: p.users.id,
        full_name: p.users.full_name,
        username: p.users.username,
        profile_photo_url: p.users.profile_photo_url,
        avatar_frame: p.users.avatar_frame,
        accent_color: p.users.accent_color,
        trend,
      };
    });

    // 2. Extraemos los comentarios de los votos (match_votes) para el "Informe Oficial"
    const comments = match.match_votes
      .filter((v) => v.comment && v.comment.trim() !== "")
      .map((v) => {
        // Buscamos el nombre del target_id entre los jugadores del match
        const target = match.match_players.find(
          (mp) => mp.user_id === v.target_id,
        );
        return {
          comment: v.comment,
          target_name: target?.users.full_name || "Jugador",
        };
      });

    // 3. Devolvemos la respuesta manteniendo la raíz del objeto match (...match)
    res.json({
      ...match,
      match_players: playersWithVoteStatus,
      // Agregamos estas propiedades extra que pide tu pantalla de resultados
      players: playersWithVoteStatus, // Alias para facilitar el map en el front
      comments: comments,
      honors: match.honors,
    });
  } catch (error) {
    console.error("Error fetching match details:", error);
    res.status(500).json({ error: "Error fetching match details" });
  }
};

export const updateMatchStatus = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const { status } = req.body;

    if (status === "COMPLETED") {
      await MatchService.closeMatch(matchId);
      return res.json({
        message: "Partido cerrado y procesado exitosamente (Admin force).",
      });
    }

    await prisma.matches.update({
      where: { id: matchId },
      data: { status },
    });

    if (status === "FINISHED") {
      const participants = await prisma.match_players.findMany({
        where: { match_id: matchId },
        select: { user_id: true },
      });
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        select: { location_name: true, league_id: true },
      });
      const location = match?.location_name ?? "Partido";
      const title = "Hora de votar";
      const body = `Terminó el partido en ${location}. Entrá a votar a tus compañeros.`;
      const data = { matchId, leagueId: match?.league_id };
      for (const { user_id } of participants) {
        if (user_id) {
          sendNotification(user_id, "MATCH_FINISHED_VOTE", title, body, data).catch((err) =>
            console.error("[updateMatchStatus] MATCH_FINISHED_VOTE failed for", user_id, err),
          );
        }
      }
    }

    res.json({ message: `Estado actualizado a ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando estado" });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;

    // 1. Recibimos teamAScore y teamBScore
    const { location, dateTime, price, players, teamAScore, teamBScore } =
      req.body;

    if (!matchId) return res.status(400).json({ error: "Falta matchId" });

    let dateObj: Date | undefined;
    if (dateTime) {
      dateObj = new Date(dateTime);
    }

    const cleanPrice =
      typeof price === "string" ? parseFloat(price.replace(/\./g, "")) : price;

    const currentMatch = await prisma.matches.findUnique({
      where: { id: matchId },
    });

    if (!currentMatch)
      return res.status(404).json({ error: "Partido no encontrado" });

    // --- CAMBIO IMPORTANTE ---
    // Eliminamos o comentamos esta restricción.
    // Necesitamos poder editar el partido (poner goles) aunque esté FINISHED o COMPLETED.
    /*
    if (currentMatch.status !== "OPEN") {
      return res.status(403).json({ error: "No se puede editar un partido finalizado o en juego" });
    }
    */

    await prisma.$transaction(async (tx) => {
      // 2. Actualizar Partido (Incluyendo Goles)
      await tx.matches.update({
        where: { id: matchId },
        data: {
          location_name: location,
          date_time: dateObj,
          price_per_player: cleanPrice,
          // Guardamos los goles si vienen en el request
          team_a_score:
            teamAScore !== undefined ? Number(teamAScore) : undefined,
          team_b_score:
            teamBScore !== undefined ? Number(teamBScore) : undefined,
        },
      });

      // 3. Actualizar Jugadores
      // El Frontend ahora envía: [{ user_id: "...", team: "A" }, { user_id: "...", team: "B" }]
      if (players && Array.isArray(players)) {
        // A. Obtener IDs activos para no borrarlos
        // Nota: El frontend ahora manda 'user_id', no 'id'
        const activeIds = players.map((p: any) => p.user_id);

        // B. BORRAR los que fueron desconvocados (no están en la nueva lista)
        await tx.match_players.deleteMany({
          where: {
            match_id: matchId,
            user_id: { notIn: activeIds },
          },
        });

        // C. UPSERT (Actualizar o Crear)
        for (const p of players) {
          const team = p.team; // "A" o "B" (Ya viene listo del front)
          const userId = p.user_id;

          // Buscamos si ya existe
          const existing = await tx.match_players.findUnique({
            where: { match_id_user_id: { match_id: matchId, user_id: userId } },
          });

          if (existing) {
            // Si existe y cambió de equipo, actualizamos
            if (existing.team !== team) {
              await tx.match_players.update({
                where: {
                  match_id_user_id: { match_id: matchId, user_id: userId },
                },
                data: { team },
              });
            }
          } else {
            // Si es nuevo convocado, lo creamos
            await tx.match_players.create({
              data: {
                match_id: matchId,
                user_id: userId,
                team,
                has_confirmed: false, // Por defecto false si lo agrega el admin manual
              },
            });
          }
        }
      }
    });

    res.json({ message: "Partido actualizado con éxito" });
  } catch (error) {
    console.error("Error updating match:", error);
    res.status(500).json({ error: "Error actualizando el partido" });
  }
};

export const getPendingVotes = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;

    // --- A. LÓGICA DE CIERRE AUTOMÁTICO (LAZY CLOSING) ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Buscamos partidos 'FINISHED' que ya vencieron
    const expiredMatches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "FINISHED",
        date_time: { lt: twentyFourHoursAgo }, // Menor que hace 24hs
      },
    });

    if (expiredMatches.length > 0) {
      await Promise.all(
        expiredMatches.map((match) => MatchService.closeMatch(match.id)),
      );
    }
    // -----------------------------------------------------

    // --- B. OBTENER LISTA LIMPIA ---
    // Ahora traemos solo los vigentes (los expirados ya pasaron a COMPLETED arriba)
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "FINISHED",
        match_players: {
          some: {
            user_id: userId,
            has_confirmed: true, // Solo si jugué
          },
        },
      },
      select: {
        id: true,
        location_name: true,
        date_time: true,
        status: true,
      },
    });

    res.json(matches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching voting matches" });
  }
};

export const getVoteList = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;

    // 1. Verificar si ya votó
    const existingVotes = await prisma.match_votes.findFirst({
      where: {
        match_id: matchId,
        voter_id: userId,
      },
    });

    // 2. Buscar partido y jugadores
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          where: { has_confirmed: true },
          include: {
            users: {
              select: {
                id: true,
                full_name: true,
                profile_photo_url: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    // 3. Validación de Tiempo
    const matchDate = new Date(match.date_time);
    const deadline = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > deadline) {
      return res.status(400).json({
        error: "TIMEOUT",
        message: "El tiempo de votación ha finalizado.",
      });
    }

    // RESPUESTA MODIFICADA: Ahora devolvemos un objeto con flag
    res.json({
      hasVoted: !!existingVotes, // true si ya votó
      players: match.match_players.map((p) => p.users),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno" });
  }
};

export const submitVotes = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const { votes } = req.body;
    const voterId = req.user?.userId;

    if (!voterId) return res.status(401).json({ error: "No autorizado" });

    // 1. VALIDACIÓN: ¿Ya votó?
    const alreadyVoted = await prisma.match_votes.findFirst({
      where: { match_id: matchId, voter_id: voterId },
    });

    if (alreadyVoted) {
      return res
        .status(400)
        .json({ error: "ALREADY_VOTED", message: "Ya has enviado tus votos." });
    }

    // 2. VALIDACIÓN: ¿Existe el partido y está a tiempo?
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { league_id: true, date_time: true },
    });

    if (!match) return res.status(404).json({ error: "Partido no encontrado" });

    const matchDate = new Date(match.date_time);
    const deadline = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > deadline) {
      await MatchService.closeMatch(matchId);
      return res
        .status(400)
        .json({ error: "TIMEOUT", message: "Tiempo finalizado." });
    }

    await MatchService.submitVotes(matchId, match.league_id, voterId, votes);

    res.json({ message: "Votos guardados correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno guardando votos" });
  }
};

export const getRecentCompletedMatches = async (
  req: Request,
  res: Response,
) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;

    // Lógica: Mostrar resultados de los últimos 3 días (72hs)
    // Esto cumple con tu requisito de que "no aparezca para siempre"
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "COMPLETED",
        date_time: {
          gte: oneDayAgo,
        },
        // Filtro opcional: Solo mostrar si el usuario jugó en ese partido
        match_players: {
          some: {
            user_id: userId,
            has_confirmed: true,
          },
        },
      },
      orderBy: {
        date_time: "desc",
      },
      select: {
        id: true,
        location_name: true,
        date_time: true,
        status: true,
      },
    });

    res.json(matches);
  } catch (error) {
    console.error("Error fetching recent results:", error);
    res.status(500).json({ error: "Error al obtener resultados recientes" });
  }
};

export const getMatchResults = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;

    // A. Datos del Partido
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        location_name: true,
        date_time: true,
        mvp_id: true,
        status: true,
        league_id: true,
      },
    });

    if (!match || !match.league_id) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }

    // B. Jugadores y sus Puntajes (Con promedio histórico para Tendencia)
    const players = await prisma.match_players.findMany({
      where: { match_id: matchId, has_confirmed: true },
      select: {
        match_rating: true,
        match_pace: true,
        match_physical: true,
        users: {
          select: {
            id: true,
            full_name: true,
            username: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
            // Buscamos su ficha en ESTA liga para saber su promedio histórico
            league_members: {
              where: { league_id: match.league_id },
              select: { league_overall: true },
            },
          },
        },
      },
      orderBy: { match_rating: "desc" },
    });

    // Formateamos y calculamos la TENDENCIA
    const formattedPlayers = players.map((p) => {
      const currentRating = Number(p.match_rating || 0);

      // Obtenemos promedio histórico.
      // league_members devuelve un array, tomamos el primero (debería ser único por liga/usuario)
      const historicalMember = p.users.league_members[0];
      const historicalAvg = historicalMember?.league_overall
        ? Number(historicalMember.league_overall)
        : 5.0; // Base por defecto

      // TENDENCIA: Diferencia entre cómo jugó HOY y su promedio GENERAL
      const trend = currentRating - historicalAvg;

      return {
        id: p.users.id,
        full_name: p.users.full_name,
        username: p.users.username,
        profile_photo_url: p.users.profile_photo_url,
        match_rating: currentRating,
        match_pace: Number(p.match_pace || 0),
        match_physical: Number(p.match_physical || 0),
        avatar_frame: p.users.avatar_frame,
        accent_color: p.users.accent_color,
        trend: trend, // Enviamos el valor calculado (+0.5, -1.2, etc.)
      };
    });

    // C. Comentarios (CORREGIDO)
    const comments = await prisma.match_votes.findMany({
      where: {
        match_id: matchId,
        comment: { not: null }, // Solo votos con comentario
      },
      select: {
        comment: true,
        // target_name: true, <--- ESTO ESTABA MAL, NO EXISTE EN LA TABLA
        target_user: {
          // <--- ASÍ SE ACCEDE AL NOMBRE
          select: { full_name: true },
        },
      },
    });

    const formattedComments = comments.map((c) => ({
      comment: c.comment,
      target_name: c.target_user?.full_name || "Desconocido", // Extraemos el nombre de la relación
    }));

    // D. Honores (Medallas)
    const honors = await prisma.honors.findMany({
      where: { match_id: matchId },
      select: { user_id: true, honor_type: true },
    });

    res.json({
      match,
      players: formattedPlayers,
      comments: formattedComments,
      honors,
    });
  } catch (error) {
    console.error("Error fetching match detail results:", error);
    res.status(500).json({ error: "Error al obtener detalle de resultados" });
  }
};

export const generateMatchDuel = async (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  if (!matchId) {
    return res.status(400).json({ error: "Falta matchId" });
  }

  try {
    const result = await DuelService.generateMatchDuel(matchId);
    const title = "Estás en el duelo";
    const body = `${result.details.challenger?.full_name ?? "Rival"} vs ${result.details.rival?.full_name ?? "Rival"}. Jugá bien.`;
    const data = { matchId, duelId: result.duel.id };
    sendNotification(result.duel.challenger_id, "DUEL_PARTICIPANT", title, body, data).catch(() => {});
    sendNotification(result.duel.rival_id, "DUEL_PARTICIPANT", title, body, data).catch(() => {});
    return res.status(201).json({
      message: "Duelo generado exitosamente",
      duel: result.duel,
      details: result.details,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PARTIDO_NO_ENCONTRADO")
      return res.status(404).json({ error: "Partido no encontrado" });
    if (msg === "YA_EXISTE_DUELO")
      return res
        .status(400)
        .json({ error: "Ya existe un duelo generado para este partido." });
    if (msg === "SE_NECESITAN_2_JUGADORES_CONFIRMADOS")
      return res.status(400).json({
        error:
          "Se necesitan al menos 2 jugadores confirmados para crear un duelo.",
      });
    if (msg === "PARTIDO_SIN_LIGA")
      return res.status(400).json({ error: "Partido sin liga asociada." });
    if (msg === "DATOS_INSUFICIENTES_MIEMBROS")
      return res.status(400).json({
        error: "No se encontraron datos suficientes de los miembros.",
      });
    if (msg === "NO_PAREJAS_COMPATIBLES")
      return res
        .status(400)
        .json({ error: "No se pudieron generar parejas compatibles." });
    if (msg === "ERROR_SELECCION_PAREJA")
      return res.status(500).json({ error: "Error al seleccionar la pareja." });
    console.error("Error generando duelo:", error);
    return res.status(500).json({ error: "Error interno al generar duelo" });
  }
};

export const getMatchDuel = async (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  try {
    const duel = await prisma.duels.findFirst({
      where: { match_id: matchId },
      include: {
        matches: { select: { league_id: true } }, // Necesitamos saber la liga
        winner: { select: { id: true, full_name: true } },
        // No traemos usuarios aquí directamente para poder buscar sus stats abajo de forma más limpia
      },
    });

    if (!duel || !duel.matches?.league_id) {
      return res.json(null);
    }

    const leagueId = duel.matches.league_id;

    // Función auxiliar para obtener data completa de un jugador (Perfil + Stats + Equipo)
    const getPlayerData = async (userId: string) => {
      // 1. Perfil básico
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          full_name: true,
          profile_photo_url: true,
          avatar_frame: true, // <--- EL MARCO
          username: true,
        },
      });

      // 2. Stats de la liga (Promedio / Racha simulada o MVPs)
      const stats = await prisma.league_members.findUnique({
        where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
        select: {
          league_overall: true, // <--- PROMEDIO
          honors_mvp: true,
        },
      });

      // 3. Equipo en este partido
      const matchPlayer = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: matchId, user_id: userId } },
        select: { team: true }, // <--- EQUIPO (A o B)
      });

      return {
        ...user,
        stats: {
          overall: stats?.league_overall || 5.0,
          mvps: stats?.honors_mvp || 0,
        },
        team: matchPlayer?.team || "UNASSIGNED",
      };
    };

    // Obtenemos la data enriquecida de ambos
    const challengerData = await getPlayerData(duel.challenger_id);
    const rivalData = await getPlayerData(duel.rival_id);

    // Respondemos con la estructura unificada (winner_id explícito para que el cliente detecte duelo terminado)
    res.json({
      ...duel,
      winner_id: duel.winner_id ?? duel.winner?.id ?? null,
      challenger: challengerData,
      rival: rivalData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo duelo" });
  }
};

