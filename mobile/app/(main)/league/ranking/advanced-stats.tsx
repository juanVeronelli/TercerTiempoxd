import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import apiClient from "../../../../src/api/apiClient";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";

export default function AdvancedStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (leagueId) fetchAdvancedStats();
    else setLoading(false);
  }, [leagueId]);

  const fetchAdvancedStats = async () => {
    if (!leagueId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/leagues/${leagueId}/stats/advanced`,
      );
      setStats(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const RenderStatCard = ({
    title,
    description,
    data,
    type,
    percentLabel,
    unitLabel = "partidos",
  }: {
    title: string;
    description: string;
    data: any;
    type: "win" | "loss";
    percentLabel: string;
    unitLabel?: string;
  }) => {
    if (!data) return null;

    const total = data.matches ?? data.duelsPlayed ?? 0;
    const wins = data.wins ?? 0;
    const losses = data.losses ?? total - wins;
    const winRate = data.winRate ?? data.winRateAgainst ?? (total ? Math.round((wins / total) * 100) : 0);
    const displayPercent = type === "win" ? winRate : 100 - winRate;
    const accentColor = type === "win" ? "#10B981" : "#EF4444";
    const iconName =
      title.includes("VÍCTIMA") || title.includes("RIVAL") || title.includes("DUELO")
        ? "sword-cross"
        : "handshake";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name={iconName}
              size={14}
              color={accentColor}
            />
            <Text style={[styles.cardTag, { color: accentColor }]}>
              {title}
            </Text>
          </View>
          <Text style={styles.matchCount}>{total} {unitLabel}</Text>
        </View>

        <Text style={styles.cardDescription}>{description}</Text>

        <View style={styles.playerRow}>
          <UserAvatar
            imageUrl={data.photo}
            name={data.name}
            size={50}
          />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{data.name.toUpperCase()}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniText, { color: "#10B981" }]}>
                  {wins} ganados
                </Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniText, { color: "#EF4444" }]}>
                  {losses} perdidos
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.rateContainer}>
            <Text style={[styles.rateValue, { color: accentColor }]}>
              {displayPercent}%
            </Text>
            <Text style={styles.rateLabel}>{percentLabel}</Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${displayPercent}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ANÁLISIS AVANZADO</Text>
        <MaterialCommunityIcons name="crown" size={18} color="#F59E0B" />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SOCIOS EN CANCHA</Text>
          <Text style={styles.sectionSub}>
            Compañeros con los que más partidos jugaste en el mismo equipo. Por
            cantidad de victorias o derrotas juntos.
          </Text>
        </View>

        <RenderStatCard
          title="CON QUIÉN MÁS GANASTE"
          description="El compañero con el que más veces jugaste en tu equipo y ganaste."
          data={stats?.bestPartner}
          type="win"
          percentLabel="Victorias juntos"
        />
        <RenderStatCard
          title="CON QUIÉN MÁS PERDISTE"
          description="El compañero con el que más veces jugaste en tu equipo y perdiste."
          data={stats?.worstPartner}
          type="loss"
          percentLabel="Derrotas juntos"
        />

        <View style={[styles.sectionHeader, { marginTop: 25 }]}>
          <Text style={styles.sectionTitle}>RIVALES EN CANCHA</Text>
          <Text style={styles.sectionSub}>
            Jugadores que van en el equipo contrario. El % es de partidos que
            ganás vos cuando se enfrentan.
          </Text>
        </View>

        <RenderStatCard
          title="TU VÍCTIMA"
          description="El rival al que más le ganás cuando juega contra vos."
          data={stats?.easyTarget}
          type="win"
          percentLabel="Vos ganás"
        />
        <RenderStatCard
          title="TU RIVAL DIRECTO"
          description="El rival que más te gana cuando juega contra vos."
          data={
            stats?.biggestRival &&
            stats?.easyTarget &&
            stats.biggestRival.userId !== stats.easyTarget.userId &&
            stats.biggestRival.name !== stats.easyTarget.name
              ? stats.biggestRival
              : null
          }
          type="loss"
          percentLabel="Él te gana"
        />
        {(!stats?.biggestRival || (stats?.easyTarget && stats?.biggestRival?.userId === stats?.easyTarget?.userId)) && stats?.easyTarget && (
          <Text style={styles.hint}>
            Jugá contra más rivales distintos para desbloquear «Tu rival directo».
          </Text>
        )}

        <View style={[styles.sectionHeader, { marginTop: 25 }]}>
          <Text style={styles.sectionTitle}>DUELOS 1v1</Text>
          <Text style={styles.sectionSub}>
            Rivales en duelos directos. El % es de duelos ganados por cada uno.
          </Text>
        </View>

        <RenderStatCard
          title="DUELO: TU VÍCTIMA"
          description="Con quien más duelos jugaste y más ganaste."
          data={stats?.duelVictim}
          type="win"
          percentLabel="Vos ganás"
          unitLabel="duelos"
        />
        <RenderStatCard
          title="DUELO: TU NEMESIS"
          description="Con quien más duelos jugaste y más perdiste."
          data={stats?.duelNemesis}
          type="loss"
          percentLabel="Él te gana"
          unitLabel="duelos"
        />
        {!stats?.duelVictim && !stats?.duelNemesis && (
          <Text style={styles.hint}>
            Jugá duelos 1v1 en partidos de la liga para desbloquear estas métricas.
          </Text>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 10 },
  headerTitle: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  backBtn: { marginRight: 5 },
  content: { paddingHorizontal: 20 },

  sectionHeader: { marginBottom: 15 },
  sectionTitle: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionSub: { color: "#6B7280", fontSize: 11, lineHeight: 15 },
  hint: {
    color: "#64748B",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // CARD
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTag: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  cardDescription: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 15,
    fontStyle: "italic",
  },
  matchCount: { color: "#6B7280", fontSize: 9, fontWeight: "700" },

  playerRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  playerInfo: { flex: 1, marginLeft: 12 },
  playerName: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },

  statsRow: { flexDirection: "row", gap: 8 },
  statMiniText: { fontSize: 9, fontWeight: "800" },

  rateContainer: { alignItems: "flex-end" },
  rateValue: { fontSize: 20, fontWeight: "900" },
  rateLabel: { color: "#6B7280", fontSize: 8, fontWeight: "700" },

  progressBg: {
    height: 4,
    backgroundColor: "#111827",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
});
