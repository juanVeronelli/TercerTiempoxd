import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter, useGlobalSearchParams, useFocusEffect } from "expo-router";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import apiClient from "../../../../src/api/apiClient";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { EmptyState } from "../../../../src/components/ui/EmptyState";

const FRAME_COLORS: Record<string, string> = {
  none: "transparent",
  simple: "#374151",
  gold: "#F59E0B",
  accent: Colors.primary,
  danger: "#EF4444",
};

type ProdeRow = {
  id: string;
  name: string;
  username?: string | null;
  photo: string | null;
  avatar_frame?: string | null;
  accent_color?: string | null;
  prode_points_total: number;
};

export default function ProdeTableScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProdeRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (leagueId) fetchProde();
    }, [leagueId]),
  );

  useEffect(() => {
    if (leagueId) fetchProde();
    else setLoading(false);
  }, [leagueId]);

  const fetchProde = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/leagues/${leagueId}/stats/prode-ranking`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerPress = (playerId: string) => {
    router.push({
      pathname: "/(main)/user/[id]",
      params: { id: playerId, leagueId: leagueId ?? undefined },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TABLA DEL PRODE</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ marginVertical: 8 }}>
            <Skeleton width="100%" height={280} borderRadius={12} />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sin datos del Prode"
            message="Los puntos se acumulan por fecha cuando se resuelven las predicciones de cada partido."
            iconName="trophy"
          />
        ) : (
          <>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons
                  name="crystal-ball"
                  size={14}
                  color="#22D3EE"
                />
                <Text style={styles.statCardTitle}>PUNTOS ACUMULADOS</Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>JUGADORES</Text>
                  <Text style={styles.statValueMain}>{rows.length}</Text>
                </View>
                <View style={styles.dividerVertical} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>LÍDER</Text>
                  <Text style={styles.statValueMain} numberOfLines={1}>
                    {rows[0]?.name?.split(" ")[0] ?? "-"}
                  </Text>
                </View>
                <View style={styles.dividerVertical} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>PTS</Text>
                  <Text style={styles.statValueMain}>
                    {rows[0]?.prode_points_total ?? 0}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionHeader}>POSICIONES</Text>
            </View>

            <View style={styles.rankingContainer}>
              <View style={styles.tableLabels}>
                <Text style={styles.labelColRank}>#</Text>
                <Text style={styles.labelColPlayer}>JUGADOR</Text>
                <Text style={styles.labelColPts}>PTS</Text>
              </View>
              {rows.map((player, index) => {
                const frameId = player.avatar_frame || "none";
                let finalBorderColor = FRAME_COLORS[frameId] || "transparent";
                if (frameId === "accent" && player.accent_color) {
                  finalBorderColor = player.accent_color;
                }
                const hasFrame = frameId !== "none";
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.playerRow}
                    activeOpacity={0.7}
                    onPress={() => handlePlayerPress(player.id)}
                  >
                    <View style={styles.colRank}>
                      <Text
                        style={[
                          styles.rankNumber,
                          index < 3 && { color: "#F59E0B" },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.avatarContainer,
                        hasFrame && {
                          borderColor: finalBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <UserAvatar
                        imageUrl={player.photo}
                        name={player.name}
                        size={40}
                      />
                    </View>
                    <View style={styles.colName}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      {player.username ? (
                        <Text style={styles.playerUsername} numberOfLines={1}>
                          @{player.username}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.colPts}>
                      <Text style={styles.ptsValue}>
                        {player.prode_points_total}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 15,
  },
  headerTitle: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  backBtn: { padding: 5 },

  statCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 6,
  },
  statCardTitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: {
    color: "#6B7280",
    fontSize: 10,
    marginBottom: 4,
    fontWeight: "600",
  },
  statValueMain: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  dividerVertical: { width: 1, height: 30, backgroundColor: "#374151" },

  sectionHeaderBox: { marginBottom: 12 },
  sectionHeader: {
    color: "#22D3EE",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  rankingContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#374151",
  },
  tableLabels: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  labelColRank: { width: 28, fontSize: 10, fontWeight: "900", color: "#6B7280" },
  labelColPlayer: { flex: 1, fontSize: 10, fontWeight: "900", color: "#6B7280" },
  labelColPts: { width: 50, textAlign: "right", fontSize: 10, fontWeight: "900", color: "#6B7280" },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  colRank: { width: 28, alignItems: "center" },
  rankNumber: { color: "#6B7280", fontSize: 12, fontWeight: "bold" },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  colName: { flex: 1 },
  playerName: { color: "white", fontSize: 13, fontWeight: "600" },
  playerUsername: { color: "#6B7280", fontSize: 11, marginTop: 1 },
  colPts: { width: 50, alignItems: "flex-end" },
  ptsValue: { color: "#22D3EE", fontSize: 14, fontWeight: "800" },
});
