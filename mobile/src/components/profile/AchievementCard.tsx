/**
 * Tarjeta individual de logro.
 * Variantes: FREE (plana) vs PRO (degradado, borde dorado).
 * Estados: Bloqueado (opacidad 0.6) vs Desbloqueado (full color).
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const CONDITION_LABELS: Record<string, string> = {
  MATCHES_PLAYED: "partidos",
  MATCHES_WON: "victorias",
  WIN_STREAK: "victorias seguidas",
  MVP_COUNT: "MVPs",
  TRONCO_COUNT: "Troncos",
  FANTASMA_COUNT: "Fantasmas",
  DUEL_WINS: "duelos ganados",
  MATCHES_ORGANIZED: "partidos organizados",
  VOTES_CAST: "votos emitidos",
  PREDICTION_CORRECT: "predicciones acertadas",
  CLEAN_SHEET_COUNT: "vallas invictas",
  MATCHES_CONFIRMED: "asistencias confirmadas",
  ACHIEVEMENTS_UNLOCKED: "logros desbloqueados",
  COSMETIC_ACHIEVEMENTS_CLAIMED: "cosméticos reclamados",
  LEAGUE_RANK_REACHED: "posición en ranking",
  AVG_RATING_OVER_MATCHES: "promedio de rating",
  MATCHES_NO_FANTASMA_STREAK: "partidos sin fantasma",
  DEFENSE_SINGLE: "defensa",
  ATTACK_SINGLE: "ataque",
  PACE_SINGLE: "ritmo",
  TECHNIQUE_SINGLE: "técnica",
  PHYSICAL_SINGLE: "físico",
  OVERALL_SINGLE: "promedio",
  MULTI_STAT_8_SINGLE: "stats a 8+",
  COMEBACK_WIN: "remontadas",
  RANK_OVERTAKE: "superaciones",
};

const STAT_LABELS: Record<string, string> = {
  pace: "Ritmo",
  defense: "Defensa",
  attack: "Ataque",
  technique: "Técnica",
  physical: "Físico",
  league_overall: "Promedio",
};

function formatRewardLabel(
  rewardType: string,
  rewardValue: any,
  isProExclusive: boolean,
  isPro: boolean,
): string {
  if (rewardType === "STAT_BOOST") {
    const rv = rewardValue as Record<string, number>;
    const parts = Object.entries(rv || {}).map(
      ([k, v]) => `+${v} ${STAT_LABELS[k] || k}`,
    );
    return parts.join(", ") || "+1 Stat";
  }
  if (rewardType === "COSMETIC") {
    const key = rewardValue?.cosmetic_key || rewardValue;
    return typeof key === "string"
      ? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Cosmético";
  }
  return "Recompensa";
}

export type Achievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition_type: string;
  condition_value: number;
  reward_type: string;
  reward_value: any;
  is_pro_exclusive: boolean;
  user_achievement?: {
    current_progress: number;
    is_completed: boolean;
    claimed_at: string | null;
  } | null;
};

export type AchievementCardProps = {
  achievement: Achievement;
  isPro: boolean;
};

export function AchievementCard({ achievement, isPro }: AchievementCardProps) {
  const a = achievement;
  const ua = a.user_achievement;
  const completed = ua?.is_completed ?? false;
  const progress = ua?.current_progress ?? 0;
  const target = Number(a.condition_value) || 1;
  const progressPct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  const isProCard = a.is_pro_exclusive;
  const isLocked = isProCard && !isPro;
  const rewardLabel = formatRewardLabel(
    a.reward_type,
    a.reward_value,
    a.is_pro_exclusive,
    isPro,
  );
  const progressLabel = CONDITION_LABELS[a.condition_type] || a.condition_type;

  const cardContent = (
    <>
      {/* Badge PRO (esquina superior derecha) - solo en variante PRO */}
      {isProCard && (
        <View style={styles.proBadge}>
          <LinearGradient
            colors={["#FBBF24", "#D97706"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.proBadgeInner}
          >
            <Text style={styles.proBadgeText}>PRO</Text>
          </LinearGradient>
        </View>
      )}

      {/* Icono izquierda */}
      <View
        style={[
          styles.iconWrap,
          isLocked && styles.iconWrapLocked,
          completed && styles.iconWrapCompleted,
        ]}
      >
        <MaterialCommunityIcons
          name={completed ? "trophy" : "trophy-outline"}
          size={24}
          color={
            isLocked
              ? "#6B7280"
              : completed
                ? "#FBBF24"
                : isProCard
                  ? "#FBBF24"
                  : "#9CA3AF"
          }
        />
      </View>

      {/* Centro: título + descripción + progreso + recompensa */}
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            (!isLocked && completed) && styles.titleUnlocked,
          ]}
          numberOfLines={1}
        >
          {a.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {a.description}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: completed
                    ? "#FBBF24"
                    : isProCard
                      ? "#A78BFA"
                      : "#3B82F6",
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.min(progress, target)}/{target} {progressLabel}
          </Text>
        </View>
        <Text style={[styles.rewardText, isLocked && styles.rewardTextLocked]}>
          {isLocked ? "Desbloquea PRO" : `+ ${rewardLabel}`}
        </Text>
      </View>
    </>
  );

  const containerStyle = [
    styles.card,
    isProCard ? styles.cardPro : styles.cardFree,
    isLocked && styles.cardLocked,
  ];

  if (isProCard) {
    return (
      <View style={[styles.cardOuter, !isLocked && styles.cardProGlow]}>
        <LinearGradient
          colors={["#1a1a1f", "#16161a", "#12121a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[containerStyle, styles.cardProGradient]}
        >
          {cardContent}
        </LinearGradient>
      </View>
    );
  }

  return <View style={containerStyle}>{cardContent}</View>;
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 16,
  },
  cardProGlow: {
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 14,
    position: "relative",
  },
  cardFree: {
    backgroundColor: "#27272a",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardPro: {
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  cardProGradient: {
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  cardLocked: {
    opacity: 0.6,
  },
  proBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  proBadgeInner: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 0.5,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconWrapLocked: {
    backgroundColor: "rgba(107,114,128,0.2)",
  },
  iconWrapCompleted: {
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingRight: 50,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  titleUnlocked: {
    color: "#FFFFFF",
  },
  description: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 10,
  },
  progressRow: {
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  rewardText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  rewardTextLocked: {
    color: "#6B7280",
    fontStyle: "italic",
  },
});
