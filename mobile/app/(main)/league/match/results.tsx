import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import apiClient from "../../../../src/api/apiClient";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { useCurrentUser } from "../../../../src/hooks/useCurrentUser";
import { useTtp } from "../../../../src/context/TtpContext";
import { DuelCard } from "../../../../src/components/DuelCard";
import { LeagueHomeHeader } from "../../../../src/components/ui/LeagueHomeHeader";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareableMatchCard } from "../../../../src/components/share/ShareableMatchCard";
import { ShareButton } from "../../../../src/components/share/ShareButton";
import { MedalsInfoButton } from "../../../../src/components/medals/MedalsInfoButton";
import { getMedalDisplayName } from "../../../../src/constants/MedalsInfo";
import { useLeagueMedalNames } from "../../../../src/hooks/useLeagueMedalNames";

const { width } = Dimensions.get("window");

const SHARE_CARD_WIDTH = 340;
const SHARE_CARD_HEIGHT = 520;

const FRAME_COLORS: Record<string, string> = {
  none: "transparent",
  simple: "#374151",
  gold: "#F59E0B",
  accent: Colors.primary,
  danger: "#EF4444",
};

const THEME = {
  cardBg: "#1F2937",
  innerBg: "#111827",
  gold: "#F59E0B",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  borderColor: "#374151",
};

const SCROLL_OFFSET_PADDING = 100;
const SCROLL_THEN_STEP_MS = 480;

export default function MatchResultsScreen() {
  const { matchId, returnTo } = useLocalSearchParams<{
    matchId: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();
  const ttp = useTtp();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [pendingReactions, setPendingReactions] = useState<Record<string, boolean>>({});
  const [expandedCommentGroups, setExpandedCommentGroups] = useState<Record<string, boolean>>({});
  const [commentGroupVisibleCount, setCommentGroupVisibleCount] = useState<Record<string, number>>({});
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [honors, setHonors] = useState<any[]>([]);
  const [predictionsResult, setPredictionsResult] = useState<{
    questions: Array<{
      question_id: string;
      question_label: string;
      points_reward: number;
      user_option_label: string | null;
      correct_option_label: string | null;
      correct: boolean;
      points_earned: number;
    }>;
    totalPoints: number;
  } | null>(null);
  const [showPredictionsModal, setShowPredictionsModal] = useState(false);
  const [claimingTtp, setClaimingTtp] = useState(false);

  // Si el usuario entra al informe, la acción “Resultados disponibles” se considera vista.
  useFocusEffect(
    useCallback(() => {
      if (!matchId) return;
      (async () => {
        try {
          await apiClient.post("/actions/seen", { keys: [`results_ready:${String(matchId)}`] });
        } catch {
          // silencioso
        }
      })();
    }, [matchId]),
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const fetchSeqRef = useRef(0);

  const handleBackPress = useCallback(() => {
    const rt = String(returnTo ?? "").trim();
    if (rt) {
      // Soporta path completo (recomendado)
      if (rt.startsWith("/")) {
        router.replace(rt as any);
        return;
      }
      // Compat: claves viejas
      if (rt === "stats") {
        router.replace("/(main)/league/stats" as any);
        return;
      }
      if (rt === "home") {
        router.replace("/(main)/league/home" as any);
        return;
      }
    }
    // Fallback inteligente
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/(main)/league/home" as any);
  }, [navigation, returnTo, router]);

  const getConsumableVisual = useCallback(
    (consumableKey?: string | null): { icon: keyof typeof Ionicons.glyphMap; color: string } => {
      const key = String(consumableKey ?? "").toLowerCase();
      if (key.includes("shield")) return { icon: "shield-checkmark", color: "#34D399" };
      if (key.includes("duel")) return { icon: "flame", color: "#F97316" };
      if (key.includes("prode") || key.includes("prediction")) return { icon: "stats-chart", color: "#60A5FA" };
      if (key.includes("spectator")) return { icon: "eye", color: "#C084FC" };
      if (key.includes("rewind")) return { icon: "play-back", color: "#F59E0B" };
      if (key.includes("heist")) return { icon: "swap-horizontal", color: "#FBBF24" };
      if (key.includes("history_delete")) return { icon: "trash", color: "#EF4444" };
      return { icon: "flash", color: "#F59E0B" };
    },
    [],
  );


  useEffect(() => {
    const fetchResults = async () => {
      const seq = ++fetchSeqRef.current;
      // Evitar flash de data anterior cuando cambia matchId
      setLoading(true);
      setMatchData(null);
      setPlayers([]);
      setComments([]);
      setHonors([]);
      setPredictionsResult(null);
      setShowPredictionsModal(false);
      try {
        // Cambiado a /details para usar el controlador actualizado
        const res = await apiClient.get(`/match/${matchId}/details`);
        if (seq !== fetchSeqRef.current) return;

        // matchData ahora contiene team_a_score y team_b_score directamente
        setMatchData(res.data);

        // Ordenamos los jugadores por rating para el ranking
        const sortedPlayers = res.data.match_players.sort(
          (a: any, b: any) =>
            Number(b.match_rating || 0) - Number(a.match_rating || 0),
        );

        setPlayers(sortedPlayers);
        setComments(res.data.comments || []);
        setHonors(res.data.honors || []);
      } catch (error: unknown) {
        if (seq !== fetchSeqRef.current) return;
        showAlert(
          "Error",
          formatUserFacingError(error, "No se pudieron cargar los resultados."),
          undefined,
          "error",
        );
        router.back();
      } finally {
        if (seq !== fetchSeqRef.current) return;
        setLoading(false);
      }
    };

    if (matchId) fetchResults();
  }, [matchId]);

  const refreshComments = useCallback(async () => {
    try {
      const seq = fetchSeqRef.current;
      const res = await apiClient.get(`/match/${matchId}/details`);
      if (seq !== fetchSeqRef.current) return;
      setComments(res.data.comments || []);
    } catch {}
  }, [matchId]);

  // Inicializar estado desplegable por grupo cuando llegan comentarios
  useEffect(() => {
    const getTargetKey = (c: any) =>
      String(c?.target?.id ?? c?.target_id ?? c?.target?.name ?? c?.target_name ?? "GENERAL");
    const keys = Array.from(new Set((comments || []).map(getTargetKey)));
    if (keys.length === 0) return;
    setExpandedCommentGroups((prev) => {
      const next = { ...prev };
      // Por defecto: solo el primer grupo abierto
      keys.forEach((k, idx) => {
        if (next[k] === undefined) next[k] = idx === 0;
      });
      return next;
    });
    setCommentGroupVisibleCount((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        if (next[k] === undefined) next[k] = 3;
      });
      return next;
    });
  }, [comments]);

  const handleReact = useCallback(
    async (voteId: string, nextValue: 1 | -1) => {
      const prevComments = comments;
      try {
        const current = comments.find((c) => c.id === voteId)?.myReaction ?? 0;
        const valueToSend = current === nextValue ? 0 : nextValue;

        // Optimistic UI: actualizar al instante
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== voteId) return c;
            const prevReaction = Number(c.myReaction ?? 0);
            const nextReaction = Number(valueToSend);
            let likes = Number(c.likes ?? 0);
            let dislikes = Number(c.dislikes ?? 0);

            if (prevReaction === 1) likes = Math.max(0, likes - 1);
            if (prevReaction === -1) dislikes = Math.max(0, dislikes - 1);
            if (nextReaction === 1) likes += 1;
            if (nextReaction === -1) dislikes += 1;

            return { ...c, myReaction: nextReaction, likes, dislikes };
          }),
        );

        setPendingReactions((m) => ({ ...m, [voteId]: true }));
        await apiClient.post(`/match/${matchId}/comments/${voteId}/react`, {
          value: valueToSend,
        });
        // Sync final (por si hubo race con otros users)
        await refreshComments();
      } catch (e: unknown) {
        // Revert on failure
        setComments(prevComments);
        showAlert(
          "Error",
          formatUserFacingError(e, "No se pudo reaccionar al comentario."),
          undefined,
          "error",
        );
      } finally {
        setPendingReactions((m) => ({ ...m, [voteId]: false }));
      }
    },
    [comments, matchId, refreshComments, showAlert],
  );

  const openReply = useCallback((c: any) => {
    setReplyingTo(c);
    setReplyText("");
    setReplyModalVisible(true);
  }, []);

  const sendReply = useCallback(async () => {
    const voteId = replyingTo?.id;
    if (!voteId) return;
    const text = String(replyText || "").trim();
    if (!text) return;
    setSendingReply(true);
    try {
      await apiClient.post(`/match/${matchId}/comments/${voteId}/reply`, {
        reply: text,
      });
      setReplyModalVisible(false);
      setReplyingTo(null);
      setReplyText("");
      await refreshComments();
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudo enviar la respuesta."),
        undefined,
        "error",
      );
    } finally {
      setSendingReply(false);
    }
  }, [matchId, refreshComments, replyText, replyingTo, showAlert]);

  useEffect(() => {
    if (!matchId || loading) return;
    const fetchPredictionsResult = async () => {
      try {
        const seq = fetchSeqRef.current;
        const res = await apiClient.get(`/match/${matchId}/predictions-result`);
        if (seq !== fetchSeqRef.current) return;
        setPredictionsResult(res.data);
      } catch {
        const seq = fetchSeqRef.current;
        if (seq !== fetchSeqRef.current) return;
        setPredictionsResult({ questions: [], totalPoints: 0 });
      }
    };
    fetchPredictionsResult();
  }, [matchId, loading]);

  const handlePlayerPress = (playerId: string) => {
    const leagueId = matchData?.league_id;
    if (leagueId) {
      router.push({
        pathname: "/(main)/user/[id]",
        params: { id: playerId, leagueId: leagueId },
      });
    }
  };

  const handleClaimTtp = useCallback(async () => {
    if (!matchId || claimingTtp) return;
    try {
      setClaimingTtp(true);
      const res = await apiClient.post<{
        totalClaimed: number;
        balanceAfter?: number | null;
        summary?: any;
      }>(`/match/${matchId}/claim-ttp`);
      setMatchData((prev: any) => ({
        ...prev,
        my_ttp_summary: res?.data?.summary ?? prev?.my_ttp_summary,
      }));
      const amount = Number(res?.data?.totalClaimed ?? 0);
      ttp?.animateGain({ amount, balanceAfter: res?.data?.balanceAfter ?? null });
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudieron reclamar los TTP."),
        undefined,
        "error",
      );
    } finally {
      setClaimingTtp(false);
    }
  }, [claimingTtp, matchId, showAlert, ttp]);

  const viewShotRef = useRef<ViewShot>(null);
  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudo compartir la imagen."),
        undefined,
        "error",
      );
    }
  };

  const customMedalNames = useLeagueMedalNames(matchData?.league_id ?? null);

  const myStats = players.find((p) => p.id === userId);
  const myTtpSummary = matchData?.my_ttp_summary;

  const leagueRoleUpper = String(matchData?.userRole ?? "").toUpperCase();
  const canManageLeagueDuel =
    leagueRoleUpper === "ADMIN" || leagueRoleUpper === "OWNER";

  const renderBadges = (
    playerId: string,
    index: number,
    totalPlayers: number,
  ) => {
    const playerHonors = honors.filter((h) => h.user_id === playerId);
    const badges: { icon: string; color: string; label: string }[] = [];

    // MVP: desde honors (votación). Independiente de posición.
    if (playerHonors.some((h) => h.honor_type === "MVP"))
      badges.push({ icon: "trophy", color: "#F59E0B", label: getMedalDisplayName("mvp", customMedalNames) });

    // Posición en ranking (2º, 3º): visual, no exclusivo de otras medallas.
    if (index === 1)
      badges.push({ icon: "medal", color: "#9CA3AF", label: getMedalDisplayName("segundo", customMedalNames) });
    if (index === 2)
      badges.push({ icon: "medal", color: "#B45309", label: getMedalDisplayName("tercero", customMedalNames) });

    // FANTASMA: desde honors. Independiente.
    if (playerHonors.some((h) => h.honor_type === "FANTASMA"))
      badges.push({ icon: "ghost", color: "#A78BFA", label: getMedalDisplayName("fantasma", customMedalNames) });

    // TRONCO: desde honors. Independiente (un jugador puede tener Fantasma y Tronco).
    if (playerHonors.some((h) => h.honor_type === "TRONCO"))
      badges.push({ icon: "tree", color: "#EF4444", label: getMedalDisplayName("tronco", customMedalNames) });

    // ORACLE: desde honors (Prode). Independiente. Un jugador puede ser MVP y Oracle.
    if (playerHonors.some((h) => h.honor_type === "ORACLE"))
      badges.push({ icon: "crystal-ball", color: THEME.gold, label: getMedalDisplayName("oracle", customMedalNames) });

    return (
      <View style={styles.badgesContainer}>
        {badges.map((b, i) => (
          <View key={i} style={[styles.badgePill, { borderColor: b.color }]}>
            <MaterialCommunityIcons
              name={b.icon as any}
              size={10}
              color={b.color}
            />
            <Text style={[styles.badgeText, { color: b.color }]}>
              {b.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const mvpFallback = players[0];
  const troncoFallback = players[players.length - 1];

  const findHonorUserId = (honorType: string) =>
    honors?.find((h) => String(h.honor_type).toUpperCase() === honorType)
      ?.user_id;

  const mvpId = findHonorUserId("MVP") ?? null;
  const troncoId = findHonorUserId("TRONCO") ?? null;

  const mvpPlayer =
    (mvpId ? players.find((p) => p.id === mvpId) : null) ?? mvpFallback ?? null;
  const troncoPlayer =
    (troncoId ? players.find((p) => p.id === troncoId) : null) ??
    troncoFallback ??
    null;

  const shareCardData = matchData
    ? {
        teamAName: "EQUIPO A",
        teamBName: "EQUIPO B",
        scoreA: matchData.team_a_score ?? 0,
        scoreB: matchData.team_b_score ?? 0,
        locationName: matchData.location_name,
        mvp: mvpPlayer
          ? {
              name: mvpPlayer.full_name || mvpPlayer.username || "Jugador",
              rating: Number(mvpPlayer.match_rating || 0),
            }
          : null,
        tronco: troncoPlayer
          ? {
              name: troncoPlayer.full_name || troncoPlayer.username || "Jugador",
              rating: Number(troncoPlayer.match_rating || 0),
            }
          : null,
        top3Figures: players.slice(0, 3).map((p) => ({
          name: p.full_name || p.username || "Jugador",
          rating: Number(p.match_rating || 0),
        })),
        top3Prode: [...players]
          .sort((a, b) => (b.prediction_points ?? 0) - (a.prediction_points ?? 0))
          .slice(0, 3)
          .map((p) => ({
            name: p.full_name || p.username || "Jugador",
            points: p.prediction_points ?? 0,
          })),
      }
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <LeagueHomeHeader
        title="INFORME OFICIAL"
        addTopSafeArea={false}
        onBackPress={handleBackPress}
      />

      {loading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 20 }} />
          <Skeleton width="100%" height={320} borderRadius={16} style={{ marginBottom: 20 }} />
        </ScrollView>
      ) : (
        <>
      {/* Hidden shareable card: renderizado fuera de pantalla para ViewShot */}
      {shareCardData && (
        <View
          style={styles.hiddenShareContainer}
          pointerEvents="none"
        >
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 0.9 }}
            style={styles.hiddenViewShotWrap}
          >
            <ShareableMatchCard {...shareCardData} />
          </ViewShot>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* SCOREBOARD CON RESULTADO REAL */}
        <View style={{ marginBottom: 20 }}>
        {matchData && (
          <View style={styles.scoreboardCard}>
            <View style={styles.scoreRow}>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>EQUIPO A</Text>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreText}>
                  {matchData.team_a_score ?? 0}
                </Text>
                <Text style={styles.scoreDivider}>-</Text>
                <Text style={styles.scoreText}>
                  {matchData.team_b_score ?? 0}
                </Text>
              </View>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>EQUIPO B</Text>
              </View>
            </View>
            <Text style={styles.locationSub}>
              {matchData.location_name?.toUpperCase()}
            </Text>
          </View>
        )}
        </View>

        <View style={{ marginBottom: 20 }}>
        {myStats && (
          <>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <Ionicons name="analytics" size={14} color="#9CA3AF" />
                <Text style={styles.statCardTitle}>TU RENDIMIENTO</Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>RATING</Text>
                  <Text style={styles.statValueMain}>
                    {Number(myStats.match_rating).toFixed(1)}
                  </Text>
                </View>
                <View style={styles.dividerVertical} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>TENDENCIA</Text>
                  {(() => {
                    const trendVal = myStats.trend || 0;
                    const isPos = trendVal > 0;
                    const isNeg = trendVal < 0;
                    const color = isPos
                      ? "#10B981"
                      : isNeg
                        ? "#EF4444"
                        : "#9CA3AF";
                    return (
                      <View
                        style={[
                          styles.trendBadge,
                          {
                            backgroundColor:
                              trendVal === 0 ? "transparent" : `${color}20`,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            isPos ? "caret-up" : isNeg ? "caret-down" : "remove"
                          }
                          size={12}
                          color={color}
                        />
                        <Text style={[styles.trendText, { color }]}>
                          {isPos ? "+" : ""}
                          {trendVal.toFixed(1)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <View style={styles.dividerVertical} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>POSICIÓN</Text>
                  <Text style={styles.statValueSub}>
                    #{players.findIndex((p) => p.id === userId) + 1}
                  </Text>
                </View>
              </View>
            </View>
            {myTtpSummary && (
              <View style={styles.ttpCard}>
                <View style={styles.ttpCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="wallet" size={15} color={THEME.gold} />
                    <Text style={styles.ttpCardTitle}>TUS TTP DE ESTE PARTIDO</Text>
                  </View>
                </View>
                <Text style={styles.ttpTotalValue}>{Number(myTtpSummary.total || 0)} TTP</Text>
                {Array.isArray(myTtpSummary.breakdown) && myTtpSummary.breakdown.length > 0 && (
                  <View style={styles.ttpBreakdownWrap}>
                    {myTtpSummary.breakdown.map((row: any) => (
                      <View key={String(row.key)} style={styles.ttpBreakdownRow}>
                        <Text style={styles.ttpBreakdownLabel}>{row.label}</Text>
                        <Text style={styles.ttpBreakdownValue}>+{row.amount}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {myTtpSummary.can_claim ? (
                  <TouchableOpacity
                    style={[styles.claimTtpBtn, claimingTtp && { opacity: 0.7 }]}
                    onPress={handleClaimTtp}
                    disabled={claimingTtp}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.claimTtpBtnText}>
                      {claimingTtp ? "RECLAMANDO..." : "RECLAMAR TTPs"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.ttpClaimedText}>
                    {myTtpSummary.claimed ? "Ya reclamaste tus TTP." : "No hay TTP para reclamar."}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
        </View>

        <View style={{ marginBottom: 20 }}>
        <View style={[styles.sectionHeaderBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <Text style={styles.sectionHeader}>RANKING DEL PARTIDO</Text>
          <MedalsInfoButton size={22} />
        </View>

        <View style={styles.rankingContainer}>
          {players.map((player, index) => {
            const frameId = player.avatar_frame || "none";
            let borderColor = FRAME_COLORS[frameId] || "transparent";
            if (frameId === "accent" && player.accent_color)
              borderColor = player.accent_color;

            const playerTeam = String(player.team || "").toUpperCase();
            const isTeamA = playerTeam === "A";

            return (
              <TouchableOpacity
                key={player.id}
                style={styles.playerRow}
                onPress={() => handlePlayerPress(player.id)}
              >
                <View style={styles.rankCol}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>

                <View
                  style={[
                    styles.avatarContainer,
                    frameId !== "none" && { borderColor, borderWidth: 2 },
                  ]}
                >
                  <UserAvatar
                    imageUrl={player.profile_photo_url}
                    name={player.full_name}
                    size={40}
                  />
                </View>

                <View style={styles.nameCol}>
                  <View style={styles.playerNameRow}>
                    <Text style={styles.playerName}>{player.full_name}</Text>
                    {player.post_consumable_used?.consumable_key ? (
                      <View
                        style={[
                          styles.consumableBadge,
                          {
                            borderColor: getConsumableVisual(player.post_consumable_used.consumable_key).color,
                          },
                        ]}
                      >
                        <Ionicons
                          name={getConsumableVisual(player.post_consumable_used.consumable_key).icon}
                          size={10}
                          color={getConsumableVisual(player.post_consumable_used.consumable_key).color}
                        />
                      </View>
                    ) : null}
                    {/* INDICADOR DE EQUIPO CORREGIDO */}
                    <View
                      style={[
                        styles.teamIndicator,
                        { backgroundColor: isTeamA ? "#3B82F6" : "#F87171" },
                      ]}
                    >
                      <Text style={styles.teamIndicatorText}>
                        {playerTeam || "?"}
                      </Text>
                    </View>
                  </View>
                  {renderBadges(player.id, index, players.length)}
                </View>

                <View style={styles.ratingBox}>
                  <Text style={styles.ratingText}>
                    {Number(player.match_rating || 0).toFixed(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Votos anónimos: no se expone quién votó a quién */}
        </View>

        <View style={{ marginBottom: 20 }}>
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>DUELO DE LA FECHA</Text>
        </View>
        <View style={styles.duelCardWrapper}>
          <DuelCard
            matchId={String(matchId)}
            isAdmin={canManageLeagueDuel}
            leagueId={matchData?.league_id ?? undefined}
          />
        </View>
        </View>

        {/* TOP 3 PRODE justo debajo del duelo */}
        <View style={{ marginBottom: 20 }}>
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>TOP 3 PRODE</Text>
        </View>
        <View style={styles.predictionTop3Card}>
          {(function () {
            const sorted = [...players].sort(
              (a, b) => (b.prediction_points ?? 0) - (a.prediction_points ?? 0),
            );
            const top3 = sorted.slice(0, 3);
            const participantsCount = players.filter(
              (p) => (p.prediction_points ?? 0) > 0,
            ).length;
            const showNoMoreLegend =
              top3.length > 0 && participantsCount < 3 && participantsCount > 0;
            if (top3.length === 0) {
              return (
                <View style={styles.predictionTop3Empty}>
                  <Text style={styles.emptyText}>
                    Aún no hay puntos de predicción para esta fecha.
                  </Text>
                </View>
              );
            }
            return (
              <>
                {top3.map((player, index) => {
                  const pts = player.prediction_points ?? 0;
                  const medalIcon =
                    index === 0 ? "crystal-ball" : index === 1 ? "medal" : "medal";
                  const medalColor =
                    index === 0 ? THEME.gold : index === 1 ? "#9CA3AF" : "#B45309";
                  return (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.predictionTop3Row}
                      onPress={() => handlePlayerPress(player.id)}
                    >
                      <View style={styles.predictionTop3Medal}>
                        <MaterialCommunityIcons
                          name={medalIcon as any}
                          size={18}
                          color={medalColor}
                        />
                        <Text
                          style={[styles.predictionTop3Pos, { color: medalColor }]}
                        >
                          #{index + 1}
                        </Text>
                      </View>
                      <View style={styles.predictionTop3NameCol}>
                        <Text style={styles.predictionTop3Name} numberOfLines={1}>
                          {player.full_name || player.username || "Jugador"}
                        </Text>
                      </View>
                      <View style={styles.predictionTop3PtsBox}>
                        <Text style={styles.predictionTop3Pts}>{pts}</Text>
                        <Text style={styles.predictionTop3PtsLabel}>PTS</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {showNoMoreLegend && (
                  <View style={styles.predictionTop3Legend}>
                    <Text style={styles.predictionTop3LegendText}>
                      No hubo más votaciones
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>
        </View>

        {predictionsResult != null &&
          predictionsResult.questions.some((q) => q.user_option_label != null) && (
          <>
            <TouchableOpacity
              style={styles.myPredictionsButton}
              onPress={() => setShowPredictionsModal(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="crystal-ball" size={20} color="#22D3EE" />
              <Text style={styles.myPredictionsButtonText}>Ver mis predicciones</Text>
              <Text style={styles.myPredictionsButtonSubtext}>
                {predictionsResult.questions.filter((q) => q.user_option_label != null).length}{" "}
                respuesta(s) · {predictionsResult.totalPoints} pts
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>

            <Modal
              visible={showPredictionsModal}
              animationType="slide"
              transparent
              onRequestClose={() => setShowPredictionsModal(false)}
            >
              <View style={styles.predictionsModalOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setShowPredictionsModal(false)}
                />
                <View style={styles.predictionsModalContent}>
                  <View style={styles.predictionsModalHandle} />
                  <View style={styles.predictionsModalHeader}>
                    <Text style={styles.predictionsModalTitle}>Mis predicciones</Text>
                    <TouchableOpacity
                      onPress={() => setShowPredictionsModal(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="close" size={28} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.predictionsModalScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {predictionsResult.questions
                      .filter((q) => q.user_option_label != null)
                      .map((q) => (
                        <View key={q.question_id} style={styles.predictionDetailRow}>
                          <View style={styles.predictionDetailQuestion}>
                            <Text style={styles.predictionDetailLabel}>{q.question_label}</Text>
                            <Text style={styles.predictionDetailYour}>
                              Tu respuesta: {q.user_option_label}
                            </Text>
                            {q.correct_option_label != null && (
                              <Text style={styles.predictionDetailCorrect}>
                                Correcto: {q.correct_option_label}
                              </Text>
                            )}
                          </View>
                          <View style={styles.predictionDetailRight}>
                            {q.correct ? (
                              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                            ) : (
                              <Ionicons name="close-circle" size={24} color="#EF4444" />
                            )}
                            <Text
                              style={[
                                styles.predictionDetailPts,
                                q.correct && { color: "#10B981" },
                              ]}
                            >
                              +{q.points_earned}
                            </Text>
                          </View>
                        </View>
                      ))}
                    <View style={styles.predictionDetailTotal}>
                      <Text style={styles.predictionDetailTotalLabel}>Total esta fecha</Text>
                      <Text style={styles.predictionDetailTotalValue}>
                        {predictionsResult.totalPoints} pts
                      </Text>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </>
        )}

        <View style={{ marginBottom: 20 }}>
        <ShareButton
          onPress={handleShare}
          variant="filled"
          style={styles.shareButtonWrap}
        />
        </View>

        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>VOCES DEL VESTUARIO</Text>
        </View>

        <View style={styles.lockerContainer}>
          {comments.length > 0 ? (
            (() => {
              const getTargetKey = (c: any) =>
                String(c?.target?.id ?? c?.target_id ?? c?.target?.name ?? c?.target_name ?? "GENERAL");
              const getTargetLabel = (c: any) =>
                String(c?.target?.name ?? c?.target_name ?? "GENERAL");

              const byTarget = comments.reduce<Record<string, any[]>>((acc, c) => {
                const key = getTargetKey(c);
                if (!acc[key]) acc[key] = [];
                acc[key].push(c);
                return acc;
              }, {});

              const order = [...new Set(comments.map(getTargetKey))];
              return (
                <>
                  {order.map((targetKey) => {
                    const groupComments = byTarget[targetKey] ?? [];
                    const isOpen = expandedCommentGroups[targetKey] ?? false;
                    const visibleCount = commentGroupVisibleCount[targetKey] ?? 3;
                    const shown = isOpen ? groupComments.slice(0, visibleCount) : [];
                    const hasMore = isOpen && groupComments.length > shown.length;
                    const headerLabel = getTargetLabel(groupComments[0]);
                    const preview = groupComments?.[0]?.comment
                      ? String(groupComments[0].comment).trim()
                      : "";
                    return (
                    <View key={targetKey} style={styles.commentGroup}>
                      <TouchableOpacity
                        style={[
                          styles.commentGroupHeaderRow,
                          !isOpen && styles.commentGroupHeaderRowCollapsed,
                        ]}
                        activeOpacity={0.85}
                        onPress={() =>
                          setExpandedCommentGroups((m) => ({
                            ...m,
                            [targetKey]: !(m[targetKey] ?? false),
                          }))
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.commentGroupHeaderTopRow}>
                            <Text style={styles.commentGroupHeader}>
                              SOBRE {String(headerLabel).toUpperCase()}
                            </Text>
                            <View style={styles.commentGroupHeaderRight}>
                              <View style={styles.commentGroupCountPill}>
                                <Text style={styles.commentGroupCountText}>
                                  {groupComments.length}
                                </Text>
                              </View>
                              <Ionicons
                                name={isOpen ? "chevron-up" : "chevron-down"}
                                size={16}
                                color={THEME.textSecondary}
                              />
                            </View>
                          </View>
                          {!isOpen && preview ? (
                            <Text style={styles.commentGroupPreview} numberOfLines={1}>
                              “{preview}”
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>

                      {isOpen &&
                        shown.map((c, idx) => (
                        <View key={c?.id ?? idx} style={styles.commentRow}>
                          <View style={styles.commentBar} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commentBody}>"{c.comment}"</Text>
                            <View style={styles.commentActionsRow}>
                              <TouchableOpacity
                                style={[
                                  styles.reactBtn,
                                  c.myReaction === 1 && styles.reactBtnActive,
                                  pendingReactions[c.id] && styles.reactBtnPending,
                                ]}
                                onPress={() => handleReact(c.id, 1)}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name={c.myReaction === 1 ? "thumbs-up" : "thumbs-up-outline"}
                                  size={14}
                                  color={c.myReaction === 1 ? THEME.gold : "#9CA3AF"}
                                />
                                <Text style={styles.reactCount}>{Number(c.likes || 0)}</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.reactBtn,
                                  c.myReaction === -1 && styles.reactBtnActive,
                                  pendingReactions[c.id] && styles.reactBtnPending,
                                ]}
                                onPress={() => handleReact(c.id, -1)}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name={
                                    c.myReaction === -1
                                      ? "thumbs-down"
                                      : "thumbs-down-outline"
                                  }
                                  size={14}
                                  color={c.myReaction === -1 ? "#EF4444" : "#9CA3AF"}
                                />
                                <Text style={styles.reactCount}>
                                  {Number(c.dislikes || 0)}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.replyBtn}
                                onPress={() => openReply(c)}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="chatbubble-ellipses-outline"
                                  size={14}
                                  color="#9CA3AF"
                                />
                                <Text style={styles.replyBtnText}>
                                  Responder
                                  {Array.isArray(c.replies) && c.replies.length > 0
                                    ? ` (${c.replies.length})`
                                    : ""}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {Array.isArray(c.replies) && c.replies.length > 0 && (
                              <View style={styles.repliesWrap}>
                                {c.replies.map((r: any) => (
                                  <View key={r.id} style={styles.replyRow}>
                                    <View style={styles.replyDot} />
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.replyText}>{r.reply}</Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}

                          </View>
                        </View>
                      ))}

                      {hasMore && (
                        <TouchableOpacity
                          style={styles.showMoreCommentsBtn}
                          onPress={() =>
                            setCommentGroupVisibleCount((m) => ({
                              ...m,
                              [targetKey]: (m[targetKey] ?? 3) + 3,
                            }))
                          }
                          activeOpacity={0.85}
                        >
                          <Text style={styles.showMoreCommentsText}>
                            Ver más comentarios
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    );
                  })}
                </>
              );
            })()
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Silencio en el vestuario.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
        </>
      )}

      <Modal
        visible={replyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.replyModalCard}>
            <View style={styles.replyModalHeader}>
              <Text style={styles.replyModalTitle}>Responder</Text>
              <TouchableOpacity
                onPress={() => setReplyModalVisible(false)}
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            <Text style={styles.replyModalSubtitle} numberOfLines={2}>
              "{String(replyingTo?.comment ?? "").slice(0, 90)}"
            </Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Escribe tu respuesta..."
              placeholderTextColor="#6B7280"
              multiline
              style={styles.replyInput}
              maxLength={240}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.sendReplyBtn, sendingReply && { opacity: 0.7 }]}
              onPress={sendReply}
              disabled={sendingReply}
              activeOpacity={0.9}
            >
              <Text style={styles.sendReplyBtnText}>
                {sendingReply ? "ENVIANDO..." : "ENVIAR"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  content: { padding: 20 },
  scoreboardCard: {
    backgroundColor: "#111827",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  teamInfo: { flex: 1, alignItems: "center" },
  teamName: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 15,
  },
  scoreText: { color: "white", fontSize: 32, fontWeight: "900" },
  scoreDivider: {
    color: "#4B5563",
    fontSize: 24,
    marginHorizontal: 10,
    fontWeight: "bold",
  },
  locationSub: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 15,
    letterSpacing: 1,
  },
  statCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  statValueMain: { color: "white", fontSize: 28, fontWeight: "900" },
  statValueSub: { color: "#D1D5DB", fontSize: 20, fontWeight: "bold" },
  trendBadge: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: "center",
  },
  trendText: { fontSize: 12, fontWeight: "bold", marginLeft: 2 },
  dividerVertical: { width: 1, height: 30, backgroundColor: "#374151" },
  ttpCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  ttpCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  ttpCardTitle: {
    color: THEME.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  ttpTotalValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  ttpBreakdownWrap: {
    marginBottom: 12,
    gap: 6,
  },
  ttpBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ttpBreakdownLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  ttpBreakdownValue: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },
  claimTtpBtn: {
    backgroundColor: THEME.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  claimTtpBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  ttpClaimedText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
  },
  votesRevealCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 25,
    overflow: "hidden",
    minHeight: 120,
  },
  votesEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  votesEntryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: Colors.accentGoldSubtle,
  },
  votesEntryTitle: {
    color: Colors.textHeading,
    fontSize: 15,
    fontWeight: "800",
  },
  votesEntrySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  votesEntryButton: {
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 8,
    backgroundColor: Colors.accentGold,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  votesEntryButtonText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  votesRevealLocked: {
    position: "relative",
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  votesPromoContent: {
    padding: 20,
    alignItems: "center",
  },
  votesPromoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentGoldSubtle,
  },
  votesRevealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.85)",
  },
  votesRevealCtaBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  votesRevealCtaTitle: {
    color: Colors.textHeading,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  votesRevealCtaSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  votesRevealCtaButton: {
    backgroundColor: Colors.accentGold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  votesRevealCtaButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sectionHeaderBox: { marginBottom: 10, marginTop: 0 },
  sectionHeader: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  rankingContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  predictionTableCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    overflow: "hidden",
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderColor,
  },
  predictionRowWinner: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderLeftWidth: 4,
    borderLeftColor: THEME.gold,
  },
  predictionRowLast: {
    borderBottomWidth: 0,
  },
  predictionRankCol: {
    width: 32,
    alignItems: "center",
  },
  predictionRankText: {
    color: THEME.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  predictionAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  predictionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.borderColor,
  },
  predictionNameCol: {
    flex: 1,
  },
  predictionName: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  predictionNameWinner: {
    color: THEME.gold,
  },
  predictionPtsBox: {
    backgroundColor: THEME.innerBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  predictionPtsBoxWinner: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: THEME.gold,
  },
  predictionPtsText: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  predictionPtsTextWinner: {
    color: THEME.gold,
  },
  predictionPtsLabel: {
    color: THEME.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    marginTop: 2,
  },
  duelCardWrapper: {
    marginBottom: 20,
  },
  predictionTop3Card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  predictionTop3Row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  predictionTop3Medal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 70,
  },
  predictionTop3Pos: {
    fontSize: 11,
    fontWeight: "800",
  },
  predictionTop3NameCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  predictionTop3Name: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  predictionTop3PtsBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  predictionTop3Pts: {
    color: THEME.gold,
    fontSize: 16,
    fontWeight: "900",
  },
  predictionTop3PtsLabel: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  predictionTop3Empty: {
    paddingVertical: 8,
  },
  predictionTop3Legend: {
    paddingTop: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  predictionTop3LegendText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontStyle: "italic",
  },
  myPredictionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  myPredictionsButtonText: {
    flex: 1,
    marginLeft: 12,
    color: THEME.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  myPredictionsButtonSubtext: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginRight: 8,
  },
  predictionsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  predictionsModalContent: {
    backgroundColor: THEME.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: "75%",
  },
  predictionsModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4B5563",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  predictionsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  predictionsModalTitle: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  predictionsModalScroll: {
    maxHeight: 400,
  },
  predictionDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  predictionDetailQuestion: { flex: 1, marginRight: 12 },
  predictionDetailLabel: {
    color: THEME.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  predictionDetailAnswers: { gap: 2 },
  predictionDetailYour: {
    color: THEME.textSecondary,
    fontSize: 11,
  },
  predictionDetailCorrect: {
    color: "#9CA3AF",
    fontSize: 11,
    fontStyle: "italic",
  },
  predictionDetailRight: { alignItems: "flex-end" },
  predictionDetailPts: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  predictionDetailTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  predictionDetailTotalLabel: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  predictionDetailTotalValue: {
    color: "#22D3EE",
    fontSize: 16,
    fontWeight: "900",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  rankCol: { width: 25, alignItems: "center" },
  rankNumber: { color: "#6B7280", fontSize: 12, fontWeight: "bold" },
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
  nameCol: { flex: 1, justifyContent: "center" },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  playerName: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    marginRight: 8,
  },
  consumableBadge: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  teamIndicator: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  teamIndicatorText: { color: "white", fontSize: 8, fontWeight: "900" },
  badgesContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  badgeText: { fontSize: 8, fontWeight: "800", marginLeft: 3 },
  ratingBox: {
    backgroundColor: "#111827",
    width: 40,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingText: { color: "white", fontWeight: "bold", fontSize: 13 },
  lockerContainer: { marginBottom: 20 },
  lockerProCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  lockerProCardText: { flex: 1, marginLeft: 12 },
  lockerProCardTitle: {
    color: THEME.gold,
    fontSize: 13,
    fontWeight: "800",
  },
  lockerProCardSubtitle: {
    color: THEME.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  commentGroup: {
    marginBottom: 20,
  },
  commentGroupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  commentGroupHeaderRowCollapsed: {
    marginBottom: 12,
  },
  commentGroupHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commentGroupHeader: {
    color: THEME.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  commentGroupHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentGroupCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  commentGroupCountText: {
    color: THEME.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  commentGroupPreview: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 16,
  },
  commentRow: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 8,
  },
  commentBar: {
    width: 3,
    backgroundColor: "#4B5563",
    borderRadius: 2,
    marginRight: 12,
  },
  commentHeader: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  commentBody: {
    color: "#E5E7EB",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
  },
  commentActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  reactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reactBtnPending: {
    opacity: 0.55,
  },
  reactBtnActive: {
    borderColor: "rgba(245, 158, 11, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.10)",
  },
  reactCount: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "700",
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  replyBtnText: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "700",
  },
  repliesWrap: {
    marginTop: 10,
    gap: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(148, 163, 184, 0.15)",
  },
  replyRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  replyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(245, 158, 11, 0.7)",
    marginTop: 7,
  },
  replyText: {
    color: "#E5E7EB",
    fontSize: 13,
    lineHeight: 18,
  },
  replyAuthor: {
    marginTop: 4,
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  replyModalCard: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    width: "100%",
    maxWidth: 520,
  },
  replyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  replyModalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  replyModalSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 10,
  },
  replyInput: {
    minHeight: 90,
    maxHeight: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
  },
  sendReplyBtn: {
    marginTop: 12,
    backgroundColor: THEME.gold,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  sendReplyBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  commentAuthorWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  commentAuthor: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },
  commentAuthorBlur: {
    opacity: 0.45,
  },
  commentAuthorBlurText: {
    color: "#6B7280",
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 8,
  },
  emptyText: { color: "#6B7280", fontStyle: "italic", fontSize: 12 },
  showMoreCommentsBtn: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignSelf: "flex-start",
  },
  showMoreCommentsText: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "800",
  },
  hiddenShareContainer: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    opacity: 0,
  },
  hiddenViewShotWrap: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: Colors.background,
  },
  shareButtonWrap: {
    marginTop: 0,
    marginBottom: 20,
  },
});
