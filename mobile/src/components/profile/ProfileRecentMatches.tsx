import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmptyState } from "../ui/EmptyState";
import { PROFILE_THEME } from "./profileConstants";

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
    return "Hoy";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
    return "Ayer";
  return format(d, "dd/MM", { locale: es });
}

export type RecentMatchItem = {
  matchId: string;
  date: string;
  location?: string;
  leagueName?: string;
  rating?: number | string;
};

type ProfileRecentMatchesProps = {
  recentMatches: RecentMatchItem[];
  activeAccent: string;
  getRatingColor: (rating: number) => string;
};

export function ProfileRecentMatches({
  recentMatches,
  activeAccent,
  getRatingColor,
}: ProfileRecentMatchesProps) {
  return (
    <>
      <View style={[styles.sectionHeaderBox, { marginTop: 10 }]}>
        <Text style={styles.sectionHeader}>HISTORIAL RECIENTE</Text>
      </View>
      {recentMatches && recentMatches.length > 0 ? (
        recentMatches.map((match: RecentMatchItem) => {
          const rating = parseFloat(String(match.rating)) || 0;
          const dateLabel = getDateLabel(match.date);
          return (
            <View key={match.matchId} style={styles.matchRow}>
              <View style={[styles.matchAccent, { backgroundColor: activeAccent }]} />
              <View style={styles.matchBody}>
                <View style={styles.matchMain}>
                  <View style={styles.matchMeta}>
                    <Text style={styles.matchDate}>
                      {format(new Date(match.date), "dd MMM", { locale: es })}
                    </Text>
                    <View style={styles.matchPill}>
                      <Ionicons name="checkmark-circle" size={11} color={PROFILE_THEME.textSecondary} />
                      <Text style={styles.matchPillText}>
                        Jugado · {dateLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.matchLocation} numberOfLines={1}>
                    {match.location}
                  </Text>
                  {match.leagueName ? (
                    <Text style={[styles.matchLeague, { color: activeAccent }]} numberOfLines={1}>
                      {match.leagueName}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.ratingPill,
                    { backgroundColor: getRatingColor(rating) },
                  ]}
                >
                  <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          );
        })
      ) : (
        <EmptyState
          title="Sin historial"
          message="Aún no has participado en ningún partido."
          iconName="activity"
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeaderBox: { marginBottom: 5, marginTop: 10 },
  sectionHeader: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  matchRow: {
    backgroundColor: PROFILE_THEME.cardBg,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
    position: "relative",
    overflow: "hidden",
  },
  matchAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  matchBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 20,
  },
  matchMain: { flex: 1, minWidth: 0 },
  matchMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  matchDate: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PROFILE_THEME.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  matchPillText: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  matchLocation: {
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  matchLeague: { fontSize: 12, fontWeight: "600" },
  ratingPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  ratingValue: { color: "#111827", fontSize: 16, fontWeight: "900" },
});
