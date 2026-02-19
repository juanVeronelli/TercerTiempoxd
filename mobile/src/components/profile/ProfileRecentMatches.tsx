import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmptyState } from "../ui/EmptyState";
import { PROFILE_THEME } from "./profileConstants";

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
          return (
            <View key={match.matchId} style={styles.matchRow}>
              <View style={styles.matchLeft}>
                <View style={styles.leagueIcon}>
                  <Ionicons name="trophy-outline" size={16} color={PROFILE_THEME.textSecondary} />
                </View>
                <View>
                  <Text style={styles.matchLocation}>{match.location}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[styles.matchLeague, { color: activeAccent }]}>
                      {match.leagueName}
                    </Text>
                    <Text style={styles.matchDate}>
                      {" "}•{" "}
                      {format(new Date(match.date), "dd MMM", { locale: es })}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.matchRight}>
                <View
                  style={[
                    styles.ratingBox,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PROFILE_THEME.cardBg,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  matchLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  leagueIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: PROFILE_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  matchLocation: { color: "white", fontSize: 14, fontWeight: "bold" },
  matchLeague: { fontSize: 11, fontWeight: "700" },
  matchDate: { color: PROFILE_THEME.textSecondary, fontSize: 11 },
  matchRight: { alignItems: "flex-end" },
  ratingBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingValue: { color: "black", fontSize: 14, fontWeight: "900" },
});
