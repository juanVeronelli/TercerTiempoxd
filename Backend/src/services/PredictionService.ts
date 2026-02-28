import type { Prisma } from "../generated/client/index.js";
import { prisma } from "../server.js";

export type TxClient = Prisma.TransactionClient;

const MAX_PICKS_PER_GROUP = 5;
const SHOW_QUESTIONS_PER_MATCH = 10;
const SHOW_EASY = 4;
const SHOW_MEDIUM = 4;
const SHOW_HARD = 2;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function sampleByDifficulty<T extends { difficulty?: string | null }>(
  items: T[],
  easy: number,
  medium: number,
  hard: number,
): T[] {
  const e = shuffle(items.filter((x) => x.difficulty === "EASY"));
  const m = shuffle(items.filter((x) => x.difficulty === "MEDIUM"));
  const h = shuffle(items.filter((x) => x.difficulty === "HARD"));
  return [
    ...e.slice(0, easy),
    ...m.slice(0, medium),
    ...h.slice(0, hard),
  ];
}

// ---------------------------------------------------------------------------
// submitPrediction: valida cierre, máximo 5 por grupo, y guarda/actualiza
// ---------------------------------------------------------------------------
export async function submitPrediction(
  userId: string,
  questionId: string,
  optionId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  const question = await prisma.prediction_questions.findUnique({
    where: { id: questionId },
    include: {
      prediction_groups: true,
      prediction_options: { where: { id: optionId } },
    },
  });

  if (!question) {
    return { success: false, error: "Pregunta no encontrada." };
  }
  if (question.prediction_options.length === 0) {
    return { success: false, error: "Opción no válida para esta pregunta." };
  }
  if (question.prediction_groups.closes_at <= now) {
    return { success: false, error: "Las predicciones para este evento ya están cerradas." };
  }

  const group = question.prediction_groups;
  const groupId = group.id;
  if (group.match_id) {
    const isConvoked = await prisma.match_players.findUnique({
      where: {
        match_id_user_id: { match_id: group.match_id, user_id: userId },
      },
    });
    if (!isConvoked) {
      return {
        success: false,
        error: "Tenés que estar convocado al partido para votar en las predicciones.",
      };
    }
  }
  const existing = await prisma.user_predictions.findUnique({
    where: {
      user_id_question_id: { user_id: userId, question_id: questionId },
    },
  });

  if (!existing) {
    const countInGroup = await prisma.user_predictions.count({
      where: {
        user_id: userId,
        prediction_questions: { group_id: groupId },
      },
    });
    if (countInGroup >= MAX_PICKS_PER_GROUP) {
      return {
        success: false,
        error: `Solo podés elegir ${MAX_PICKS_PER_GROUP} predicciones por partido. Cambiá una que ya tengas si querés otra.`,
      };
    }
  }

  await prisma.user_predictions.upsert({
    where: {
      user_id_question_id: { user_id: userId, question_id: questionId },
    },
    create: { user_id: userId, question_id: questionId, option_id: optionId },
    update: { option_id: optionId },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// processMatchPredictions: ejecutar DENTRO de la transacción de cierre
// Compara predicciones con resultados reales, suma puntos, asigna ORACLE y bonus
// ---------------------------------------------------------------------------
export async function processMatchPredictions(
  matchId: string,
  tx: TxClient,
): Promise<void> {
  const match = await tx.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        select: {
          user_id: true,
          match_rating: true,
          match_technique: true,
          has_confirmed: true,
        },
      },
      duels: { where: { status: "COMPLETED" }, take: 1 },
    },
  });

  if (!match || !match.league_id) return;

  const group = await tx.prediction_groups.findFirst({
    where: { match_id: matchId, type: "MATCH" },
    include: {
      prediction_questions: {
        include: { prediction_options: true },
      },
    },
  });

  if (!group || group.prediction_questions.length === 0) return;

  const mvpId = match.mvp_id ?? null;
  const playersWithRating = match.match_players.filter(
    (p) => p.match_rating != null,
  );
  const troncoId =
    playersWithRating.length > 0
      ? playersWithRating.reduce((min, p) =>
          Number(p.match_rating) < Number(min.match_rating) ? p : min,
        ).user_id
      : null;
  const duel = match.duels[0];
  const duelWinnerId = duel?.winner_id ?? null;
  const resultKey =
    match.team_a_score != null && match.team_b_score != null
      ? match.team_a_score > match.team_b_score
        ? "A"
        : match.team_b_score > match.team_a_score
          ? "B"
          : "DRAW"
      : null;

  const totalGoals = (match.team_a_score ?? 0) + (match.team_b_score ?? 0);
  const goalsOverKey = totalGoals > 4 ? "YES" : "NO";
  const cleanSheetKey =
    match.team_a_score === 0 || match.team_b_score === 0 ? "YES" : "NO";

  const fantasmaHonor = await tx.honors.findFirst({
    where: { match_id: matchId, honor_type: "FANTASMA" },
  });
  const fantasmaId = fantasmaHonor?.user_id ?? null;

  const confirmedCount = match.match_players.filter((p) => p.has_confirmed).length;
  const confirmedBucket =
    confirmedCount <= 4 ? "0-4" : confirmedCount <= 8 ? "5-8" : confirmedCount <= 12 ? "9-12" : "13+";

  const ratings = playersWithRating.map((p) => Number(p.match_rating));
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const avgRatingOver7 = avgRating > 7 ? "YES" : "NO";
  const anyOver8 = ratings.some((r) => r > 8) ? "YES" : "NO";

  const mvpPlayer = mvpId ? playersWithRating.find((p) => p.user_id === mvpId) : null;
  const mvpOver8 = mvpPlayer && Number(mvpPlayer.match_rating) > 8 ? "YES" : "NO";

  const duelDraw = duel && !duelWinnerId ? "YES" : "NO";

  const techniques = match.match_players
    .map((p) => (p.match_technique != null ? Number(p.match_technique) : null))
    .filter((t): t is number => t != null);
  const avgTech = techniques.length ? techniques.reduce((a, b) => a + b, 0) / techniques.length : 0;
  const techRange =
    avgTech <= 6 ? "5-6" : avgTech <= 7 ? "6-7" : avgTech <= 8 ? "7-8" : avgTech <= 9 ? "8-9" : "9-10";

  const ratingByUser: Record<string, number> = {};
  match.match_players.forEach((p) => {
    if (p.match_rating != null) ratingByUser[p.user_id] = Number(p.match_rating);
  });

  const correctByQuestionKey: Record<string, string> = {};
  if (mvpId) correctByQuestionKey["MVP"] = mvpId;
  if (troncoId) correctByQuestionKey["TRONCO"] = troncoId;
  if (fantasmaId) correctByQuestionKey["FANTASMA"] = fantasmaId;
  if (duelWinnerId) correctByQuestionKey["DUEL_WINNER"] = duelWinnerId;
  else if (duel) correctByQuestionKey["DUEL_WINNER"] = "DRAW";
  if (resultKey) correctByQuestionKey["RESULT"] = resultKey;
  correctByQuestionKey["GOALS_OVER"] = goalsOverKey;
  correctByQuestionKey["CLEAN_SHEET"] = cleanSheetKey;
  correctByQuestionKey["CONFIRMED_COUNT"] = confirmedBucket;
  correctByQuestionKey["AVG_RATING_OVER_7"] = avgRatingOver7;
  correctByQuestionKey["ANY_RATING_OVER_8"] = anyOver8;
  correctByQuestionKey["MVP_OVER_8"] = mvpOver8;
  correctByQuestionKey["DUEL_DRAW"] = duelDraw;
  correctByQuestionKey["AVG_TECHNIQUE_RANGE"] = techRange;

  const userPoints: Record<string, number> = {};

  // Traemos TODAS las user_predictions del grupo en un solo query
  // para evitar hacer muchos findMany dentro de la transacción (timeout).
  const allUserPreds = await tx.user_predictions.findMany({
    where: {
      question_id: {
        in: group.prediction_questions.map((q) => q.id),
      },
    },
    select: { user_id: true, question_id: true, option_id: true },
  });

  for (const q of group.prediction_questions) {
    let correctKey: string | undefined = correctByQuestionKey[q.question_key];
    if (correctKey === undefined && q.question_key.includes("|")) {
      const [prefix, userId] = q.question_key.split("|");
      if (prefix === "RATING_OVER_7" && userId) {
        const r = ratingByUser[userId];
        correctKey = r != null ? (r > 7 ? "YES" : "NO") : undefined;
      } else if (prefix === "EXACT_RATING" && userId) {
        const r = ratingByUser[userId];
        if (r != null) {
          const rounded = Math.round(r * 2) / 2;
          correctKey = String(Math.min(10, Math.max(0, rounded)));
        }
      }
    }
    if (correctKey === undefined) continue;

    const correctOption = q.prediction_options.find(
      (o) => o.option_key === correctKey,
    );
    if (!correctOption) continue;

    const userPredsForQuestion = allUserPreds.filter(
      (up) => up.question_id === q.id && up.option_id === correctOption.id,
    );

    for (const up of userPredsForQuestion) {
      userPoints[up.user_id] =
        (userPoints[up.user_id] ?? 0) + q.points_reward;
    }
  }

  const leagueId = match.league_id;

  // Persistir prediction_points en cada match_player (evita recalcular siempre)
  const allMatchPlayers = await tx.match_players.findMany({
    where: { match_id: matchId },
    select: { user_id: true },
  });
  await Promise.all(
    allMatchPlayers.map((mp) => {
      const points = userPoints[mp.user_id] ?? 0;
      return tx.match_players.update({
        where: {
          match_id_user_id: { match_id: matchId, user_id: mp.user_id },
        },
        data: { prediction_points: points },
      });
    }),
  );

  // Acumular puntos de esta fecha en league_members (prode por liga, suma fecha tras fecha)
  if (leagueId) {
    await Promise.all(
      allMatchPlayers.map((mp) => {
        const points = userPoints[mp.user_id] ?? 0;
        return tx.league_members.updateMany({
          where: {
            league_id: leagueId,
            user_id: mp.user_id,
          },
          data: {
            prode_points_total: { increment: points },
          },
        });
      }),
    );
  }

  const entries = Object.entries(userPoints);
  if (entries.length === 0) return;

  const maxPoints = Math.max(...entries.map(([, p]) => p));
  const winners = entries.filter(([, p]) => p === maxPoints);
  const winnerUserIds = winners.map(([uid]) => uid);
  if (winnerUserIds.length === 0) return;

  // Premios: ORACLE y +0.5 match_rating para TODOS los empatados en primer lugar
  for (const oracleUserId of winnerUserIds) {
    await tx.honors.create({
      data: {
        match_id: matchId,
        user_id: oracleUserId,
        league_id: leagueId,
        honor_type: "ORACLE",
      },
    });

    const member = await tx.league_members.findUnique({
      where: {
        league_id_user_id: { league_id: leagueId, user_id: oracleUserId },
      },
    });
    if (member) {
      await tx.league_members.update({
        where: {
          league_id_user_id: { league_id: leagueId, user_id: oracleUserId },
        },
        data: { honors_prediction: { increment: 1 } },
      });
    }

    const mpRow = await tx.match_players.findUnique({
      where: {
        match_id_user_id: { match_id: matchId, user_id: oracleUserId },
      },
    });
    if (mpRow?.match_rating != null) {
      const newRating = Number(mpRow.match_rating) + 0.5;
      await tx.match_players.update({
        where: {
          match_id_user_id: { match_id: matchId, user_id: oracleUserId },
        },
        data: { match_rating: newRating },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Listar grupos activos por liga (para el front)
// Si las tablas no existen o hay error, devuelve listas vacías para no devolver 500
// ---------------------------------------------------------------------------
export async function getActiveGroupsByLeague(
  leagueId: string,
  userId: string,
): Promise<{
  match: Array<GroupWithQuestions>;
  monthly: Array<GroupWithQuestions>;
  season: Array<GroupWithQuestions>;
}> {
  const empty = {
    match: [] as Array<GroupWithQuestions>,
    monthly: [] as Array<GroupWithQuestions>,
    season: [] as Array<GroupWithQuestions>,
  };

  try {
    const now = new Date();
    const closesAtMin = new Date(now.getTime() - 30 * 60 * 1000);

    // Solo mostramos grupos cuyo partido esté OPEN (ni CANCELLED ni COMPLETED), o sin partido (mensual/anual).
    // Para partidos: mostramos si closes_at > now o si closes_at está dentro de los últimos 30 min (por timezone).
    let groups = await prisma.prediction_groups.findMany({
      where: {
        league_id: leagueId,
        OR: [
          { match_id: null, closes_at: { gt: now } },
          {
            match_id: { not: null },
            matches: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
            OR: [
              { closes_at: { gt: now } },
              { closes_at: { gte: closesAtMin } },
            ],
          },
        ],
      },
      orderBy: { closes_at: "asc" },
      include: {
        prediction_questions: {
          include: {
            prediction_options: true,
            user_predictions: { where: { user_id: userId }, take: 1 },
          },
        },
        matches: { select: { id: true, date_time: true, location_name: true } },
      },
    });

    // Si no hay predicciones por partido pero la liga tiene un próximo partido, crear el grupo
    // Solo partidos OPEN; ventana amplia (desde hace 24h) por timezone, luego tomamos el primero que no haya pasado
    const matchGroups = groups.filter((g) => g.type === "MATCH");
    if (matchGroups.length === 0) {
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const stillOpenCutoff = new Date(now.getTime() - 30 * 60 * 1000);
      const candidates = await prisma.matches.findMany({
        where: {
          league_id: leagueId,
          date_time: { gte: from },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
        orderBy: { date_time: "asc" },
      });
      const nextMatch = candidates.find((m) => new Date(m.date_time) >= stillOpenCutoff) ?? null;
      if (nextMatch) {
        await createMatchPredictionGroup(nextMatch.id);
        groups = await prisma.prediction_groups.findMany({
          where: {
            league_id: leagueId,
            OR: [
              { match_id: null, closes_at: { gt: now } },
              {
                match_id: { not: null },
                matches: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
                OR: [
                  { closes_at: { gt: now } },
                  { closes_at: { gte: closesAtMin } },
                ],
              },
            ],
          },
          orderBy: { closes_at: "asc" },
          include: {
            prediction_questions: {
              include: {
                prediction_options: true,
                user_predictions: { where: { user_id: userId }, take: 1 },
              },
            },
            matches: { select: { id: true, date_time: true, location_name: true } },
          },
        });
      }
    }

    const withUserChoice = (
      g: (typeof groups)[0],
    ): GroupWithQuestions => {
      const allQuestions = g.prediction_questions.map((q) => ({
        id: q.id,
        question_key: q.question_key,
        label: q.label,
        points_reward: q.points_reward,
        difficulty: q.difficulty ?? undefined,
        options: q.prediction_options.map((o) => ({
          id: o.id,
          option_key: o.option_key,
          label: o.label,
        })),
        user_option_id: q.user_predictions[0]?.option_id ?? null,
      }));
      let questions: typeof allQuestions;
      if (g.type === "MATCH" && Array.isArray(g.display_question_ids) && g.display_question_ids.length > 0) {
        const idSet = new Set(g.display_question_ids as string[]);
        const byId = new Map(allQuestions.map((q) => [q.id, q]));
        questions = (g.display_question_ids as string[])
          .filter((id) => byId.has(id))
          .map((id) => byId.get(id)!);
      } else if (g.type === "MATCH") {
        questions = sampleByDifficulty(
          allQuestions,
          SHOW_EASY,
          SHOW_MEDIUM,
          SHOW_HARD,
        );
      } else {
        questions = allQuestions;
      }
      return {
        id: g.id,
        type: g.type,
        period_key: g.period_key,
        closes_at: g.closes_at,
        match: g.matches
          ? {
              id: g.matches.id,
              date_time: g.matches.date_time,
              location_name: g.matches.location_name,
            }
          : null,
        questions,
      };
    };

    return {
      match: groups.filter((g) => g.type === "MATCH").map(withUserChoice),
      monthly: groups.filter((g) => g.type === "MONTHLY").map(withUserChoice),
      season: groups.filter((g) => g.type === "SEASON").map(withUserChoice),
    };
  } catch (err) {
    console.error("[PredictionService] getActiveGroupsByLeague:", err);
    return empty;
  }
}

export type GroupWithQuestions = {
  id: string;
  type: string;
  period_key: string | null;
  closes_at: Date;
  match: {
    id: string;
    date_time: Date;
    location_name: string | null;
  } | null;
  questions: Array<{
    id: string;
    question_key: string;
    label: string;
    points_reward: number;
    difficulty?: string;
    options: Array<{ id: string; option_key: string; label: string }>;
    user_option_id: string | null;
  }>;
};

// ---------------------------------------------------------------------------
// Pool de predicciones por partido: 40-50 preguntas, solo 10 mostradas (4-4-2)
// Todas comprobables por la app. question_key compuesto: "PREFIX|userId" para por jugador.
// ---------------------------------------------------------------------------
type QDef = {
  question_key: string;
  label: string;
  points_reward: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  options: Array<{ key: string; label: string }>;
};

const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => ({
  key: String(n),
  label: String(n),
}));
const TECH_RANGES = [
  { key: "5-6", label: "5.0 - 6.0" },
  { key: "6-7", label: "6.0 - 7.0" },
  { key: "7-8", label: "7.0 - 8.0" },
  { key: "8-9", label: "8.0 - 9.0" },
  { key: "9-10", label: "9.0 - 10.0" },
];

export async function createMatchPredictionGroup(
  matchId: string,
): Promise<{ groupId: string } | null> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        include: { users: { select: { id: true, full_name: true, username: true } } },
      },
    },
  });

  if (!match || !match.league_id) return null;

  const existing = await prisma.prediction_groups.findFirst({
    where: { match_id: matchId, type: "MATCH" },
  });
  if (existing) return { groupId: existing.id };

  const closesAt = match.date_time;
  const group = await prisma.prediction_groups.create({
    data: {
      league_id: match.league_id,
      match_id: matchId,
      type: "MATCH",
      period_key: null,
      closes_at: closesAt,
    },
  });

  const playerOptions = match.match_players.map((mp) => ({
    key: mp.user_id,
    label: mp.users?.full_name || mp.users?.username || "Jugador",
  }));

  const questionsToCreate: QDef[] = [
    { question_key: "MVP", label: "¿Quién será el MVP?", points_reward: 2, difficulty: "EASY", options: playerOptions },
    { question_key: "TRONCO", label: "¿Quién será el Tronco?", points_reward: 2, difficulty: "EASY", options: playerOptions },
    { question_key: "FANTASMA", label: "¿Quién será el Fantasma?", points_reward: 3, difficulty: "MEDIUM", options: playerOptions },
    { question_key: "RESULT", label: "¿Quién gana el partido?", points_reward: 2, difficulty: "EASY", options: [{ key: "A", label: "Gana equipo A" }, { key: "B", label: "Gana equipo B" }, { key: "DRAW", label: "Empate" }] },
    { question_key: "DUEL_WINNER", label: "¿Quién gana el duelo?", points_reward: 4, difficulty: "MEDIUM", options: [...playerOptions, { key: "DRAW", label: "Empate" }] },
    { question_key: "GOALS_OVER", label: "¿Habrá más de 4 goles en total?", points_reward: 3, difficulty: "EASY", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "CLEAN_SHEET", label: "¿Algún equipo se va en cero?", points_reward: 3, difficulty: "EASY", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "CONFIRMED_COUNT", label: "¿Cuántos confirmarán asistencia?", points_reward: 3, difficulty: "MEDIUM", options: [{ key: "0-4", label: "0 a 4" }, { key: "5-8", label: "5 a 8" }, { key: "9-12", label: "9 a 12" }, { key: "13+", label: "13 o más" }] },
    { question_key: "AVG_RATING_OVER_7", label: "¿El promedio de rating del partido será mayor a 7?", points_reward: 4, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "ANY_RATING_OVER_8", label: "¿Algún jugador sacará más de 8?", points_reward: 3, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "MVP_OVER_8", label: "¿El MVP sacará más de 8?", points_reward: 5, difficulty: "HARD", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "DUEL_DRAW", label: "¿El duelo terminará en empate?", points_reward: 4, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "AVG_TECHNIQUE_RANGE", label: "¿En qué rango quedará el promedio de técnica del partido?", points_reward: 6, difficulty: "HARD", options: TECH_RANGES },
  ];

  for (const mp of match.match_players) {
    const name = mp.users?.full_name || mp.users?.username || "Jugador";
    questionsToCreate.push({
      question_key: `RATING_OVER_7|${mp.user_id}`,
      label: `¿${name} sacará más de 7?`,
      points_reward: 4,
      difficulty: "MEDIUM",
      options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }],
    });
    questionsToCreate.push({
      question_key: `EXACT_RATING|${mp.user_id}`,
      label: `¿Qué rating sacará ${name}? (0 a 10)`,
      points_reward: 8,
      difficulty: "HARD",
      options: RATING_OPTIONS,
    });
  }

  const createdIdsByDifficulty: { id: string; difficulty: string }[] = [];
  for (const q of questionsToCreate) {
    const question = await prisma.prediction_questions.create({
      data: {
        group_id: group.id,
        question_key: q.question_key,
        label: q.label,
        points_reward: q.points_reward,
        difficulty: q.difficulty,
      },
    });
    createdIdsByDifficulty.push({
      id: question.id,
      difficulty: q.difficulty,
    });
    await prisma.prediction_options.createMany({
      data: q.options.map((o) => ({
        question_id: question.id,
        option_key: o.key,
        label: o.label,
      })),
    });
  }

  const sampled = sampleByDifficulty(
    createdIdsByDifficulty,
    SHOW_EASY,
    SHOW_MEDIUM,
    SHOW_HARD,
  );
  const displayIds = sampled.map((s) => s.id);
  await prisma.prediction_groups.update({
    where: { id: group.id },
    data: { display_question_ids: displayIds as unknown as Prisma.InputJsonValue },
  });

  return { groupId: group.id };
}
