/**
 * Vitrina de Trofeos (Trophy Case) - Widget compacto para ProfileScreen
 * Estilo Hero: fondo y marcas de agua derivados del color de acento del usuario.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Colors } from "../../constants/Colors";

// Deriva fondo y borde oscuros desde cualquier color de acento
function getThemeFromAccent(accentHex: string): { bg: string; border: string } {
  const hex = (accentHex || Colors.primary).replace(/^#/, "");
  if (hex.length !== 6) return { bg: "#0f172a", border: "#334155" };

  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) * 0.12));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) * 0.12));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) * 0.12));
  const bg = `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;

  const br = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) * 0.4));
  const bgr = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) * 0.4));
  const bb = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) * 0.4));
  const border = `#${Math.round(br).toString(16).padStart(2, "0")}${Math.round(bgr).toString(16).padStart(2, "0")}${Math.round(bb).toString(16).padStart(2, "0")}`;

  return { bg, border };
}

const CARD_PADDING = 18;

// Colores por categoría (rareza)
const CATEGORY_COLORS: Record<string, string> = {
  MATCH: "#F59E0B",
  STREAK: "#F97316",
  SOCIAL: "#3B82F6",
  RANKING: "#8B5CF6",
};

const CATEGORY_ICONS: Record<
  string,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  MATCH: "trophy",
  STREAK: "fire",
  SOCIAL: "account-group",
  RANKING: "podium",
};

type Achievement = {
  id: string;
  title: string;
  category?: string;
  condition_value?: number;
  user_achievement?: {
    current_progress: number;
    is_completed: boolean;
    claimed_at: string | null;
  } | null;
};

type AchievementsWidgetProps = {
  achievements: Achievement[];
  accentColor?: string;
  onPress?: () => void;
};

function CircularProgress({
  percent,
  accent,
}: {
  percent: number;
  accent: string;
}) {
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View style={circularStyles.wrapper}>
      <Svg width={size} height={size} style={circularStyles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#374151"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={circularStyles.label}>{Math.round(percent)}%</Text>
    </View>
  );
}

const circularStyles = StyleSheet.create({
  wrapper: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: { position: "absolute" },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

export function AchievementsWidget({
  achievements,
  accentColor = Colors.primary,
  onPress,
}: AchievementsWidgetProps) {
  const router = useRouter();
  const theme = getThemeFromAccent(accentColor);
  const styles = useMemo(() => createStyles(theme), [theme.bg, theme.border]);

  const completed = achievements.filter(
    (a) => a.user_achievement?.is_completed,
  );
  const total = achievements.length || 1;
  const percentCompleted = Math.round((completed.length / total) * 100);

  // Últimos 3 desbloqueados (más recientes primero por claimed_at)
  const lastUnlocked = [...completed]
    .sort((a, b) => {
      const dateA = a.user_achievement?.claimed_at
        ? new Date(a.user_achievement.claimed_at).getTime()
        : 0;
      const dateB = b.user_achievement?.claimed_at
        ? new Date(b.user_achievement.claimed_at).getTime()
        : 0;
      return dateB - dateA;
    })
    .slice(0, 3);

  // Próximo: incompleto con mayor % de progreso
  const incomplete = achievements.filter(
    (a) => !a.user_achievement?.is_completed,
  );
  const nextAchievement =
    incomplete.length > 0
      ? incomplete.reduce((best, a) => {
          const target = Number(a.condition_value) || 1;
          const progress = a.user_achievement?.current_progress ?? 0;
          const pct = target > 0 ? (progress / target) * 100 : 0;
          const bestTarget = Number(best.condition_value) || 1;
          const bestProgress = best.user_achievement?.current_progress ?? 0;
          const bestPct =
            bestTarget > 0 ? (bestProgress / bestTarget) * 100 : 0;
          return pct > bestPct ? a : best;
        }, incomplete[0])
      : null;

  const nextTarget = nextAchievement
    ? Number(nextAchievement.condition_value) || 1
    : 1;
  const nextProgress = nextAchievement?.user_achievement?.current_progress ?? 0;
  const nextPct =
    nextTarget > 0 ? Math.min(100, (nextProgress / nextTarget) * 100) : 0;

  const handlePress = () => {
    if (onPress) onPress();
    else router.push("/(main)/league/profile/achievements");
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={handlePress}
    >
      {/* Marca de agua: trofeo grande */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <MaterialCommunityIcons
          name="trophy-variant"
          size={160}
          color={accentColor}
          style={styles.watermarkIcon}
        />
      </View>

      {/* Header + % arriba a la derecha */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Logros</Text>
        <CircularProgress percent={percentCompleted} accent={accentColor} />
      </View>

      {/* La Vitrina - 3 últimos desbloqueados o placeholders */}
      <View style={styles.showcase}>
        {[0, 1, 2].map((i) => {
          const a = lastUnlocked[i];
          const cat = a?.category || "MATCH";
          const color = CATEGORY_COLORS[cat] ?? "#F59E0B";
          const iconName = CATEGORY_ICONS[cat] ?? "trophy";

          return (
            <View
              key={a?.id ?? `placeholder-${i}`}
              style={[
                styles.trophyCircle,
                { borderColor: a ? color : "rgba(148, 163, 184, 0.2)" },
                !a && styles.trophyPlaceholder,
              ]}
            >
              <MaterialCommunityIcons
                name={a ? iconName : "trophy-outline"}
                size={a ? 18 : 14}
                color={a ? color : "rgba(148, 163, 184, 0.4)"}
              />
            </View>
          );
        })}
      </View>

      {/* Footer - Próximo logro */}
      <View style={styles.footer}>
        <Text style={styles.nextLabel} numberOfLines={1}>
          Próximo:{" "}
          {nextAchievement
            ? nextAchievement.title
            : "Completa misiones para desbloquear"}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${nextPct}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: { bg: string; border: string }) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.bg,
      borderRadius: 20,
      padding: CARD_PADDING,
      alignSelf: "stretch",
      borderWidth: 1,
      borderColor: theme.border,
    position: "relative",
    overflow: "hidden",
    shadowColor: theme.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  watermarkWrap: {
    position: "absolute",
    bottom: -50,
    right: -40,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  watermarkIcon: {
    opacity: 0.08,
    transform: [{ rotate: "12deg" }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    zIndex: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  showcase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
    zIndex: 2,
  },
  trophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  trophyPlaceholder: {
    opacity: 0.5,
  },
  footer: {
    gap: 6,
    zIndex: 2,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
