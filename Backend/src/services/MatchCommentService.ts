import { prisma } from "../server.js";
import { DomainError } from "../utils/domainError.js";

export async function reactToComment(params: {
  matchId: string;
  voteId: string;
  userId: string;
  value: number; // 1, -1, 0
}): Promise<{ voteId: string; likes: number; dislikes: number; myReaction: number }> {
  const { matchId, voteId, userId, value } = params;

  if (![1, -1, 0].includes(value)) {
    throw new DomainError({
      status: 400,
      code: "INVALID_VALUE",
      message: "value debe ser 1, -1 o 0",
    });
  }

  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { league_id: true },
  });
  if (!match?.league_id) {
    throw new DomainError({ status: 404, code: "MATCH_NOT_FOUND", message: "Match not found" });
  }

  const isMember = await prisma.league_members.findUnique({
    where: { league_id_user_id: { league_id: match.league_id, user_id: userId } },
    select: { user_id: true },
  });
  if (!isMember) {
    throw new DomainError({
      status: 403,
      code: "FORBIDDEN",
      message: "No perteneces a la liga",
    });
  }

  const vote = await prisma.match_votes.findUnique({
    where: { id: voteId },
    select: { match_id: true, comment: true },
  });
  if (!vote || vote.match_id !== matchId || !vote.comment) {
    throw new DomainError({ status: 404, code: "COMMENT_NOT_FOUND" });
  }

  if (value === 0) {
    await prisma.match_vote_comment_reactions.deleteMany({
      where: { vote_id: voteId, user_id: userId },
    });
  } else {
    await prisma.match_vote_comment_reactions.upsert({
      where: { vote_id_user_id: { vote_id: voteId, user_id: userId } },
      create: { vote_id: voteId, user_id: userId, value },
      update: { value },
    });
  }

  const grouped = await prisma.match_vote_comment_reactions.groupBy({
    by: ["value"],
    where: { vote_id: voteId },
    _count: { value: true },
  });
  const likes = grouped.find((g) => (g as any).value === 1)?._count.value ?? 0;
  const dislikes = grouped.find((g) => (g as any).value === -1)?._count.value ?? 0;

  return { voteId, likes, dislikes, myReaction: value };
}

export async function replyToComment(params: {
  matchId: string;
  voteId: string;
  userId: string;
  reply: string;
}): Promise<{
  id: string;
  vote_id: string;
  reply: string;
  created_at: Date;
  author: {
    id: string | undefined;
    full_name: string | null | undefined;
    username: string | null | undefined;
    profile_photo_url: string | null | undefined;
    avatar_frame: string | null | undefined;
    accent_color: string | null | undefined;
  };
}> {
  const { matchId, voteId, userId, reply } = params;
  const text = String(reply ?? "").trim();
  if (!text) {
    throw new DomainError({ status: 400, code: "EMPTY_REPLY" });
  }
  if (text.length > 240) {
    throw new DomainError({ status: 400, code: "REPLY_TOO_LONG" });
  }

  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { league_id: true },
  });
  if (!match?.league_id) {
    throw new DomainError({ status: 404, code: "MATCH_NOT_FOUND", message: "Match not found" });
  }

  const isMember = await prisma.league_members.findUnique({
    where: { league_id_user_id: { league_id: match.league_id, user_id: userId } },
    select: { user_id: true },
  });
  if (!isMember) {
    throw new DomainError({
      status: 403,
      code: "FORBIDDEN",
      message: "No perteneces a la liga",
    });
  }

  const vote = await prisma.match_votes.findUnique({
    where: { id: voteId },
    select: { match_id: true, comment: true },
  });
  if (!vote || vote.match_id !== matchId || !vote.comment) {
    throw new DomainError({ status: 404, code: "COMMENT_NOT_FOUND" });
  }

  const created = await prisma.match_vote_comment_replies.create({
    data: { vote_id: voteId, user_id: userId, reply: text },
    select: {
      id: true,
      vote_id: true,
      reply: true,
      created_at: true,
      users: {
        select: {
          id: true,
          full_name: true,
          username: true,
          profile_photo_url: true,
          avatar_frame: true,
          accent_color: true,
        },
      },
    },
  });

  return {
    id: created.id,
    vote_id: created.vote_id,
    reply: created.reply,
    created_at: created.created_at,
    author: {
      id: created.users?.id,
      full_name: created.users?.full_name,
      username: created.users?.username,
      profile_photo_url: created.users?.profile_photo_url,
      avatar_frame: created.users?.avatar_frame,
      accent_color: created.users?.accent_color,
    },
  };
}

