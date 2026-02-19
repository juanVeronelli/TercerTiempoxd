import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import apiClient from "../api/apiClient";
import { Skeleton } from "./ui/Skeleton";
import { Colors } from "../constants/Colors";

interface MiniLeaderboardProps {
  leagueId: string;
}

export const MiniLeaderboard = ({ leagueId }: MiniLeaderboardProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"GENERAL" | "HONORS">("GENERAL");
  const [generalData, setGeneralData] = useState<any[]>([]);
  const [honorsData, setHonorsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Llamadas paralelas a tus endpoints existentes
        const [genRes, honRes] = await Promise.all([
          apiClient.get(
            `/leagues/${leagueId}/stats/general?period=total`,
          ),
          apiClient.get(`/leagues/${leagueId}/stats/honors`),
        ]);

        // Mapeo y recorte al TOP 3
        setGeneralData(genRes.data.slice(0, 3));
        setHonorsData(honRes.data.slice(0, 3));
      } catch {
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) fetchData();
  }, [leagueId]);

  const displayData = activeTab === "GENERAL" ? generalData : honorsData;

  // Rutas para "Ver tabla completa" (Ajusta si tus rutas de ranking cambian)
  const linkTo =
    activeTab === "GENERAL"
      ? "/(main)/league/ranking/table"
      : "/(main)/league/ranking/honors";

  const getRankColor = (index: number) => {
    if (index === 0) return Colors.podiumGold;
    if (index === 1) return Colors.podiumSilver;
    if (index === 2) return Colors.podiumBronze;
    return Colors.placeholder;
  };

  if (loading) {
    return (
      <View style={[styles.cardBase, styles.leaderboardCard]}>
        <Skeleton width="100%" height={200} borderRadius={20} style={{ alignSelf: "stretch" }} />
      </View>
    );
  }

  return (
    <View style={[styles.cardBase, styles.leaderboardCard]}>
      {/* HEADER CON TABS */}
      <View style={styles.lbHeader}>
        <TouchableOpacity
          style={[styles.lbTab, activeTab === "GENERAL" && styles.lbTabActive]}
          onPress={() => setActiveTab("GENERAL")}
        >
          <Text
            style={[
              styles.lbTabText,
              activeTab === "GENERAL" && { color: Colors.accentGold },
            ]}
          >
            GENERAL (PROM)
          </Text>
        </TouchableOpacity>

        <View style={styles.verticalSep} />

        <TouchableOpacity
          style={[styles.lbTab, activeTab === "HONORS" && styles.lbTabActive]}
          onPress={() => setActiveTab("HONORS")}
        >
          <Text
            style={[
              styles.lbTabText,
              activeTab === "HONORS" && { color: Colors.accentGold },
            ]}
          >
            HONORS (MVP)
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA TOP 3 */}
      <View style={styles.lbContent}>
        {displayData.length > 0 ? (
          displayData.map((item, index) => {
            // Lógica de visualización según el endpoint
            const name = item.name || "Jugador";
            const value =
              activeTab === "GENERAL"
                ? Number(item.average_rating || 0).toFixed(2) // Usamos average_rating
                : item.mvp_count || 0; // Usamos mvp_count
            const label = activeTab === "GENERAL" ? "PROM" : "MVPs";

            return (
              <View key={item.id || index} style={styles.lbRow}>
                {/* Posición / Medalla */}
                <View style={styles.rankBadge}>
                  <MaterialCommunityIcons
                    name="medal"
                    size={20}
                    color={getRankColor(index)}
                  />
                  <Text
                    style={[styles.rankNumber, { color: getRankColor(index) }]}
                  >
                    {index + 1}
                  </Text>
                </View>

                {/* Nombre */}
                <Text style={styles.lbName} numberOfLines={1}>
                  {name}
                </Text>

                {/* Valor */}
                <View style={styles.lbValueBox}>
                  <Text style={styles.lbValue}>{value}</Text>
                  <Text style={styles.lbLabel}>{label}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>Aún no hay datos suficientes.</Text>
        )}
      </View>

      {/* FOOTER LINK */}
      <TouchableOpacity
        style={styles.lbFooter}
        onPress={() =>
          router.push({ pathname: linkTo as any, params: { leagueId } })
        }
      >
        <Text style={styles.lbFooterText}>Ver tabla completa</Text>
        <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  leaderboardCard: { padding: 0 },
  lbHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  lbTab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  lbTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.accentGold },
  lbTabText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  verticalSep: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 10 },
  lbContent: { padding: 10 },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(55, 65, 81, 0.5)",
  },
  rankBadge: { flexDirection: "row", alignItems: "center", width: 45, gap: 5 },
  rankNumber: { fontSize: 14, fontWeight: "900" },
  lbName: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
    marginHorizontal: 10,
  },
  lbValueBox: { alignItems: "flex-end", width: 50 },
  lbValue: { color: Colors.white, fontSize: 16, fontWeight: "bold" },
  lbLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: "bold" },
  lbFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  lbFooterText: { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  emptyText: {
    color: Colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
});
