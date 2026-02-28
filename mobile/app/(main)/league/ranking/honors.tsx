import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useCustomAlert } from "../../../../src/context/AlertContext";
import apiClient from "../../../../src/api/apiClient";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareableHonorsCard } from "../../../../src/components/share/ShareableHonorsCard";
import { ShareButton } from "../../../../src/components/share/ShareButton";
import { MedalsInfoButton } from "../../../../src/components/medals/MedalsInfoButton";
import { useCoachmark, useCoachmarkReady } from "../../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../../src/constants/CoachmarkKeys";
import { CoachmarkModal } from "../../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../../src/components/coachmark/CoachmarkHighlight";

// --- CONSTANTES (Iguales a table.tsx) ---
const FRAME_COLORS: Record<string, string> = {
  none: "transparent",
  simple: "#374151",
  gold: "#F59E0B",
  accent: Colors.primary,
  danger: "#EF4444",
};

type HonorStats = {
  id: string;
  name: string;
  photo: string | null;
  avatar_frame?: string | null;
  accent_color?: string | null;
  mvp_count: number;
  fantasma_count: number;
  worst_player_count: number;
  duel_count: number;
  prediction_count: number;
};

const HONOR_COL_WIDTH = 45;

const HONORS_COACHMARK_STEPS = [
  {
    title: "Medallero histórico",
    body: "Acá se explica el acumulado de medallas de la liga. El ícono (i) abre un glosario con el significado de cada medalla y cómo se gana.",
  },
  {
    title: "Ranking de medallas",
    body: "Cada jugador con sus MVPs, Fantasmas, Troncos, Duelos y Prode. Tocá una columna para ordenar o un jugador para ver su perfil.",
  },
];

export default function HonorsRankingScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const { showAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<HonorStats[]>([]);
  const [sortField, setSortField] = useState<keyof HonorStats>("mvp_count");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const { shouldShow: showHonorsCoachmark, markSeen: markHonorsCoachmark } =
    useCoachmark(CoachmarkKeys.HONORS);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const canShowCoachmark = useCoachmarkReady(
    showHonorsCoachmark && !dismissedThisSession,
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
    if (leagueId) fetchHonors();
    else setLoading(false);
  }, [leagueId]);

  const fetchHonors = async () => {
    if (!leagueId) return;
    try {
      const response = await apiClient.get(
        `/leagues/${leagueId}/stats/honors`,
      );
      setMembers(response.data);
    } catch (error) {
      showAlert("Error", "No se pudo cargar el Salón de la Fama.");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof HonorStats) => {
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

  const SortIcon = ({ field }: { field: keyof HonorStats }) => {
    if (sortField !== field) return null;
    return (
      <Ionicons
        name={sortDirection === "asc" ? "chevron-up" : "chevron-down"}
        size={8}
        color={Colors.primary}
        style={{ position: "absolute", right: -2, top: -2 }}
      />
    );
  };

  const handlePlayerPress = (playerId: string) => {
    router.push({
      pathname: "/(main)/user/[id]",
      params: { id: playerId, leagueId: leagueId },
    });
  };

  const viewShotRef = useRef<ViewShot>(null);
  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      showAlert("Error", "No se pudo compartir la imagen.");
    }
  };

  const leadersForShare =
    sortedMembers.slice(0, 5).map((p) => ({
      name: p.name,
      mvp: p.mvp_count,
      tronco: p.worst_player_count,
      fantasma: p.fantasma_count,
      duel: p.duel_count ?? 0,
      prode: p.prediction_count ?? 0,
    })) || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SALÓN DE LA FAMA</Text>
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
            <ShareableHonorsCard leaders={leadersForShare} />
          </ViewShot>
        </View>
      )}

      {canShowCoachmark && (
        <CoachmarkModal
          visible={true}
          steps={HONORS_COACHMARK_STEPS}
          onFinish={() => {
            setDismissedThisSession(true);
            setCoachmarkStep(-1);
            setTargetFrame(null);
            markHonorsCoachmark();
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
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 0}
            style={{ marginBottom: 16 }}
            onMeasure={(frame) => coachmarkStep === 0 && setTargetFrame(frame)}
          >
            <View style={styles.infoCard}>
              <View style={[styles.infoCardHeader, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="ribbon-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.infoCardTitle}>MEDALLERO HISTÓRICO</Text>
                </View>
                <MedalsInfoButton size={20} />
              </View>
              <Text style={styles.infoDesc}>
                Acumulado de medallas obtenidas en todos los partidos de la liga.
              </Text>
            </View>
          </CoachmarkHighlight>

          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 1}
            style={{ marginBottom: 8 }}
            onMeasure={(frame) => coachmarkStep === 1 && setTargetFrame(frame)}
          >
            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionHeader}>RANKING DE HONORES</Text>
            </View>

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
            <View style={styles.colHonorFixed}>
              <MaterialCommunityIcons name="trophy" size={16} color="#F59E0B" />
            </View>
            <View style={styles.colHonorFixed}>
              <MaterialCommunityIcons name="ghost" size={16} color="#A78BFA" />
            </View>
            <View style={styles.colHonorFixed}>
              <MaterialCommunityIcons name="tree" size={16} color="#EF4444" />
            </View>
            <View style={styles.colHonorFixed}>
              <MaterialCommunityIcons
                name="sword-cross"
                size={16}
                color="#10B981"
              />
            </View>
            <View style={styles.colHonorFixed}>
              <MaterialCommunityIcons
                name="crystal-ball"
                size={16}
                color="#22D3EE"
              />
            </View>
          </View>

          {loading ? (
            <View style={{ marginVertical: 8 }}>
              <Skeleton width="100%" height={320} borderRadius={12} />
            </View>
          ) : (
            sortedMembers.map((player, index) => {
              // --- LÓGICA DE MARCO DE TABLE.TSX ---
              const frameId = player.avatar_frame || "none";
              let finalBorderColor = FRAME_COLORS[frameId] || "transparent";

              if (frameId === "accent" && player.accent_color) {
                finalBorderColor = player.accent_color;
              }
              const hasFrame = frameId !== "none";
              // ------------------------------------

              return (
                <TouchableOpacity
                  key={`${player.id}-${index}`}
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

                  {/* AVATAR CON MARCO (SOLO SI TIENE FRAME) */}
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
                  </View>

                  <Text
                    style={[
                      styles.statValueFixed,
                      player.mvp_count > 0 && { color: "#F59E0B" },
                    ]}
                  >
                    {player.mvp_count}
                  </Text>
                  <Text
                    style={[
                      styles.statValueFixed,
                      player.fantasma_count > 0 && { color: "#A78BFA" },
                    ]}
                  >
                    {player.fantasma_count}
                  </Text>
                  <Text
                    style={[
                      styles.statValueFixed,
                      player.worst_player_count > 0 && { color: "#EF4444" },
                    ]}
                  >
                    {player.worst_player_count}
                  </Text>
                  <Text
                    style={[
                      styles.statValueFixed,
                      player.duel_count > 0 && { color: "#10B981" },
                    ]}
                  >
                    {player.duel_count ?? 0}
                  </Text>
                  <Text
                    style={[
                      styles.statValueFixed,
                      (player.prediction_count ?? 0) > 0 && { color: "#22D3EE" },
                    ]}
                  >
                    {player.prediction_count ?? 0}
                  </Text>
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
  infoCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#374151",
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  infoCardTitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  infoDesc: { color: "#6B7280", fontSize: 12, lineHeight: 16 },
  sectionHeaderBox: { marginBottom: 12 },
  sectionHeader: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
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
  colHonorFixed: {
    width: HONOR_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
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

  // --- ESTILOS DE FOTO Y MARCO (RESTAURADOS) ---
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  // --------------------------------------------

  colName: { flex: 1 },
  playerName: { color: "white", fontSize: 13, fontWeight: "600" },
  statValueFixed: {
    width: HONOR_COL_WIDTH,
    textAlign: "center",
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "900",
  },
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
