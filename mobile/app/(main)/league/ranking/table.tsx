import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useGlobalSearchParams, useFocusEffect } from "expo-router";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { EmptyState } from "../../../../src/components/ui/EmptyState";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import apiClient from "../../../../src/api/apiClient";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareableRankingTableCard } from "../../../../src/components/share/ShareableRankingTableCard";
import { ShareButton } from "../../../../src/components/share/ShareButton";
import { useCoachmark, useCoachmarkReady } from "../../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../../src/constants/CoachmarkKeys";
import { CoachmarkModal } from "../../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../../src/components/coachmark/CoachmarkHighlight";

// --- CONSTANTES ---

// Colores base para los marcos (Fallback)
const FRAME_COLORS: Record<string, string> = {
  none: "transparent",
  simple: "#374151",
  gold: "#F59E0B",
  accent: Colors.primary, // Color por defecto si el usuario no tiene uno definido
  danger: "#EF4444",
};

type PlayerStats = {
  id: string;
  name: string;
  photo: string | null;
  // --- NUEVOS CAMPOS ---
  avatar_frame?: string | null;
  accent_color?: string | null; // Necesario para pintar el marco personalizado
  // --------------------
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  average_rating: number;
};

const STAT_COL_WIDTH = 45;

const TABLE_COACHMARK_STEPS = [
  {
    title: "Filtrar por período",
    body: "Acá podés ver el ranking por histórico, este mes o esta semana. Tocá cada pestaña para cambiar.",
  },
  {
    title: "Resumen total",
    body: "Cantidad de jugadores, quién va primero y el mejor promedio del período elegido.",
  },
  {
    title: "Tabla de posiciones",
    body: "La tabla completa: PJ (partidos jugados), G, P y PROM. Tocá una columna para ordenar.",
  },
];

export default function RankingTableScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<PlayerStats[]>([]);
  const [sortField, setSortField] =
    useState<keyof PlayerStats>("average_rating");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const [timeFilter, setTimeFilter] = useState<"total" | "month" | "week">(
    "total",
  );

  const { shouldShow: showTableCoachmark, markSeen: markTableCoachmark } =
    useCoachmark(CoachmarkKeys.TABLE);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const canShowCoachmark = useCoachmarkReady(
    showTableCoachmark && !dismissedThisSession,
  );

  useFocusEffect(
    useCallback(() => {
      setDismissedThisSession(false);
      return () => {
        setDismissedThisSession(true);
        setCoachmarkStep(-1);
        setTargetFrame(null);
      };
    }, []),
  );

  useEffect(() => {
    if (leagueId) fetchRanking();
    else setLoading(false);
  }, [leagueId, timeFilter]);

  const fetchRanking = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/leagues/${leagueId}/stats/general?period=${timeFilter}`,
      );
      setMembers(response.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof PlayerStats) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    const valA = a[sortField] ?? (typeof a[sortField] === "string" ? "" : 0);
    const valB = b[sortField] ?? (typeof b[sortField] === "string" ? "" : 0);
    const factor = sortDirection === "asc" ? 1 : -1;
    if (typeof valA === "string" && typeof valB === "string")
      return valA.localeCompare(valB) * factor;
    return (valA > valB ? 1 : -1) * factor;
  });

  const SortIcon = ({ field }: { field: keyof PlayerStats }) => {
    if (sortField !== field) return null;
    return (
      <Ionicons
        name={sortDirection === "asc" ? "chevron-up" : "chevron-down"}
        size={8}
        color={Colors.primary}
        style={{ position: "absolute", right: -2, top: 2 }}
      />
    );
  };

  const handlePlayerPress = (playerId: string) => {
    router.push({
      pathname: "/(main)/user/[id]",
      params: {
        id: playerId,
        leagueId: leagueId,
      },
    });
  };

  const viewShotRef = useRef<ViewShot>(null);
  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      Alert.alert("Error", "No se pudo compartir la imagen.");
    }
  };

  const leadersForShare =
    sortedMembers.slice(0, 5).map((p) => ({
      name: p.name,
      average: Number(p.average_rating || 0),
      played: p.matches_played,
      wins: p.matches_won,
    })) || [];

  const periodLabel =
    timeFilter === "total"
      ? "Histórico"
      : timeFilter === "month"
        ? "Este mes"
        : "Esta semana";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RANKING GENERAL</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tarjeta oculta compartible */}
      {leadersForShare.length > 0 && (
        <View style={styles.hiddenShareContainer} pointerEvents="none">
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 0.9 }}
            style={styles.hiddenViewShotWrap}
          >
            <ShareableRankingTableCard
              periodLabel={periodLabel}
              leaders={leadersForShare}
            />
          </ViewShot>
        </View>
      )}

      {canShowCoachmark && (
        <CoachmarkModal
          visible={true}
          steps={TABLE_COACHMARK_STEPS}
          onFinish={() => {
            setDismissedThisSession(true);
            setCoachmarkStep(-1);
            setTargetFrame(null);
            markTableCoachmark();
          }}
          onStepChange={(step) => {
            setCoachmarkStep(step);
            if (step === -1) setTargetFrame(null);
          }}
          targetFrame={targetFrame}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* TABS */}
        <CoachmarkHighlight
          highlighted={canShowCoachmark && coachmarkStep === 0}
          style={{ marginBottom: 16 }}
          onMeasure={(frame) => coachmarkStep === 0 && setTargetFrame(frame)}
        >
          <View style={styles.tabContainer}>
            {(["total", "month", "week"] as const).map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.tabButton,
                  timeFilter === item && styles.tabButtonActive,
                ]}
                onPress={() => setTimeFilter(item)}
              >
                <Text
                  style={[
                    styles.tabText,
                    timeFilter === item && styles.tabTextActive,
                  ]}
                >
                  {item === "total"
                    ? "HISTÓRICO"
                    : item === "month"
                      ? "ESTE MES"
                      : "SEMANA"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CoachmarkHighlight>

        {/* DASHBOARD */}
        <CoachmarkHighlight
          highlighted={canShowCoachmark && coachmarkStep === 1}
          style={{ marginBottom: 16 }}
          onMeasure={(frame) => coachmarkStep === 1 && setTargetFrame(frame)}
        >
          <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="analytics" size={14} color="#9CA3AF" />
            <Text style={styles.statCardTitle}>
              RESUMEN {timeFilter.toUpperCase()}
            </Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>JUGADORES</Text>
              <Text style={styles.statValueMain}>{members.length}</Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>LÍDER</Text>
              <Text style={styles.statValueMain} numberOfLines={1}>
                {members.length > 0 ? sortedMembers[0].name.split(" ")[0] : "-"}
              </Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>TOP PROM</Text>
              <Text style={styles.statValueMain}>
                {members.length > 0
                  ? Number(sortedMembers[0].average_rating).toFixed(1)
                  : "0.0"}
              </Text>
            </View>
          </View>
        </View>
        </CoachmarkHighlight>

        <CoachmarkHighlight
          highlighted={canShowCoachmark && coachmarkStep === 2}
          style={{ marginBottom: 8 }}
          onMeasure={(frame) => coachmarkStep === 2 && setTargetFrame(frame)}
        >
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionHeader}>TABLA DE POSICIONES</Text>
          </View>

          {/* TABLA */}
          <View style={styles.rankingContainer}>
          <View style={styles.tableLabels}>
            <TouchableOpacity
              style={styles.colPlayerHeader}
              onPress={() => handleSort("name")}
            >
              <Text
                style={[
                  styles.label,
                  sortField === "name" && styles.activeLabel,
                ]}
              >
                JUGADOR
              </Text>
              <SortIcon field="name" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colStatFixed}
              onPress={() => handleSort("matches_played")}
            >
              <View>
                <Text
                  style={[
                    styles.label,
                    sortField === "matches_played" && styles.activeLabel,
                  ]}
                >
                  PJ
                </Text>
                <SortIcon field="matches_played" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colStatFixed}
              onPress={() => handleSort("matches_won")}
            >
              <View>
                <Text
                  style={[
                    styles.label,
                    { color: "#10B981" },
                    sortField === "matches_won" && styles.activeLabel,
                  ]}
                >
                  G
                </Text>
                <SortIcon field="matches_won" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colStatFixed}
              onPress={() => handleSort("matches_lost")}
            >
              <View>
                <Text
                  style={[
                    styles.label,
                    { color: "#EF4444" },
                    sortField === "matches_lost" && styles.activeLabel,
                  ]}
                >
                  P
                </Text>
                <SortIcon field="matches_lost" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.colAvgFixed}
              onPress={() => handleSort("average_rating")}
            >
              <View>
                <Text
                  style={[
                    styles.label,
                    { color: Colors.primary },
                    sortField === "average_rating" && styles.activeLabel,
                  ]}
                >
                  PROM
                </Text>
                <SortIcon field="average_rating" />
              </View>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ marginVertical: 8 }}>
              <Skeleton width="100%" height={320} borderRadius={12} />
            </View>
          ) : sortedMembers.length === 0 ? (
            <EmptyState
              title="Ranking vacío"
              message="Jueguen partidos para generar estadísticas."
              iconName="award"
            />
          ) : (
            sortedMembers.map((player, index) => {
              // --- LÓGICA DE COLOR DE MARCO DINÁMICA ---
              const frameId = player.avatar_frame || "none";
              let finalBorderColor = FRAME_COLORS[frameId] || "transparent";

              // Si el marco es "accent", usamos el color del usuario si existe
              if (frameId === "accent" && player.accent_color) {
                finalBorderColor = player.accent_color;
              }

              const hasFrame = frameId !== "none";
              // ------------------------------------------

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
                        index < 3 && { color: "white" },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>

                  {/* --- AVATAR CON MARCO --- */}
                  <View
                    style={[
                      styles.avatarContainer,
                      hasFrame && {
                        borderColor: finalBorderColor,
                        borderWidth: 2, // Borde fino para la tabla
                      },
                    ]}
                  >
                    <UserAvatar
                      imageUrl={player.photo}
                      name={player.name}
                      size={40}
                    />
                  </View>
                  {/* ----------------------- */}

                  <View style={styles.colName}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {player.name}
                    </Text>
                  </View>

                  <Text style={styles.statValueFixed}>
                    {player.matches_played}
                  </Text>
                  <Text style={[styles.statValueFixed, { color: "#10B981" }]}>
                    {player.matches_won}
                  </Text>
                  <Text style={[styles.statValueFixed, { color: "#EF4444" }]}>
                    {player.matches_lost}
                  </Text>

                  <View style={styles.colAvgFixedValue}>
                    <View style={styles.ratingBox}>
                      <Text style={styles.ratingText}>
                        {Number(player.average_rating || 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          </View>
        </CoachmarkHighlight>

        <ShareButton
          onPress={handleShare}
          variant="filled"
          style={styles.shareButtonWrap}
        />

        <View style={{ height: 50 }} />
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

  // TAB SELECTOR
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#374151",
  },
  tabText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "white",
  },

  // DASHBOARD
  statCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
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
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // TABLA
  rankingContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    marginBottom: 25,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#374151",
  },
  tableLabels: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  label: { fontSize: 10, fontWeight: "900", color: "#6B7280" },
  activeLabel: { color: "white" },
  colPlayerHeader: { flex: 1, flexDirection: "row", alignItems: "center" },
  colStatFixed: {
    width: STAT_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  colAvgFixed: { width: 60, alignItems: "center", justifyContent: "center" },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  colRank: { width: 25, alignItems: "center" },
  rankNumber: { color: "#6B7280", fontSize: 11, fontWeight: "bold" },

  // --- ESTILOS DE FOTO Y MARCO ---
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17, // 34/2 = 17 (Círculo perfecto)
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#374151",
  },
  // -------------------------------

  colName: { flex: 1 },
  playerName: { color: "white", fontSize: 12, fontWeight: "600" },
  statValueFixed: {
    width: STAT_COL_WIDTH,
    textAlign: "center",
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "600",
  },
  colAvgFixedValue: { width: 60, alignItems: "center" },
  ratingBox: {
    backgroundColor: "#111827",
    width: 38,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingText: { color: "white", fontWeight: "bold", fontSize: 12 },
  hiddenShareContainer: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: 340,
    height: 520,
    opacity: 0,
  },
  hiddenViewShotWrap: {
    width: 340,
    height: 520,
    backgroundColor: Colors.background,
  },
  shareButtonWrap: {
    marginTop: 10,
  },
});
