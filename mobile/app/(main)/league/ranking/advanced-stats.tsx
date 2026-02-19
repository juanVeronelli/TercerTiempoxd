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
  }: {
    title: string;
    description: string;
    data: any;
    type: "win" | "loss";
  }) => {
    if (!data) return null;

    // Cálculo de efectividad según el contexto
    const isRivalry = title.includes("VÍCTIMA") || title.includes("RIVAL");
    const winRate =
      type === "win"
        ? data.winRate || data.winRateAgainst
        : 100 - (data.winRate || 0);
    const total = data.matches;
    const wins = Math.round((winRate / 100) * total);
    const losses = total - wins;

    const accentColor = type === "win" ? "#10B981" : "#EF4444";
    const iconName = isRivalry ? "sword-cross" : "handshake";

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
          <Text style={styles.matchCount}>{total} PARTIDOS</Text>
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
                  {wins} GANADOS
                </Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniText, { color: "#EF4444" }]}>
                  {losses} PERDIDOS
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.rateContainer}>
            <Text style={[styles.rateValue, { color: accentColor }]}>
              {winRate}%
            </Text>
            <Text style={styles.rateLabel}>
              {isRivalry ? "TU DOMINIO" : "ÉXITO"}
            </Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${winRate}%`, backgroundColor: accentColor },
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
        {/* EXPLICACIÓN DE SECCIÓN 1 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SOCIOS EN CANCHA</Text>
          <Text style={styles.sectionSub}>
            Analiza tu rendimiento cuando juegas en el mismo equipo que estos
            jugadores.
          </Text>
        </View>

        <RenderStatCard
          title="MEJOR SOCIO"
          description="El jugador con el que más partidos has ganado compartiendo equipo."
          data={stats?.bestPartner}
          type="win"
        />
        <RenderStatCard
          title="QUÍMICA NEGATIVA"
          description="Cuando juegan juntos, el porcentaje de derrota es el más alto de tu historial."
          data={stats?.worstPartner}
          type="loss"
        />

        {/* EXPLICACIÓN DE SECCIÓN 2 */}
        <View style={[styles.sectionHeader, { marginTop: 25 }]}>
          <Text style={styles.sectionTitle}>DUELOS PERSONALES</Text>
          <Text style={styles.sectionSub}>
            Estadísticas cara a cara cuando se encuentran en equipos contrarios.
          </Text>
        </View>

        <RenderStatCard
          title="TU VÍCTIMA"
          description="El rival al que más veces has derrotado cuando te lo cruzas enfrente."
          data={stats?.easyTarget}
          type="win"
        />
        <RenderStatCard
          title="TU RIVAL DIRECTO"
          description="Tu verdugo. El jugador que más veces te ha ganado estando en el otro equipo."
          data={stats?.biggestRival}
          type="loss"
        />

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

  // CARD REDISEÑADA
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
