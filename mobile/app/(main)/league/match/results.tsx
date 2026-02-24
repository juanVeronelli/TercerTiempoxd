import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import apiClient from "../../../../src/api/apiClient";
import { useCurrentUser } from "../../../../src/hooks/useCurrentUser";
import { DuelCard } from "../../../../src/components/DuelCard";
import { LeagueHomeHeader } from "../../../../src/components/ui/LeagueHomeHeader";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareableMatchCard } from "../../../../src/components/share/ShareableMatchCard";
import { MedalsInfoButton } from "../../../../src/components/medals/MedalsInfoButton";
import { getMedalDisplayName } from "../../../../src/constants/MedalsInfo";
import { useLeagueMedalNames } from "../../../../src/hooks/useLeagueMedalNames";
import { useCoachmark, useCoachmarkReady } from "../../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../../src/constants/CoachmarkKeys";
import { CoachmarkModal } from "../../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../../src/components/coachmark/CoachmarkHighlight";

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

const RESULTS_COACHMARK_STEPS = [
  {
    title: "Marcador",
    body: "El resultado del partido: goles por equipo.",
  },
  {
    title: "Tu rendimiento",
    body: "Tu puntaje, tendencia y posición en este partido.",
  },
  {
    title: "Ranking del partido",
    body: "El podio y todos los jugadores con sus medallas (MVP, Tronco, etc.). Tocá uno para ver su perfil.",
  },
  {
    title: "Duelo de la fecha",
    body: "El duelo destacado del partido.",
  },
  {
    title: "Top 3 Prode",
    body: "Quienes más acertaron en las predicciones.",
  },
  {
    title: "Compartir",
    body: "Compartí el informe del partido en redes.",
  },
];

const SCROLL_OFFSET_PADDING = 100;
const SCROLL_THEN_STEP_MS = 480;

export default function MatchResultsScreen() {
  const { matchId, returnTo } = useLocalSearchParams<{
    matchId: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [honors, setHonors] = useState<any[]>([]);

  const { shouldShow: showResultsCoachmark, markSeen: markResultsCoachmark } =
    useCoachmark(CoachmarkKeys.RESULTS);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionYOffsets = useRef<Record<number, number>>({});
  const scrollThenStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canShowCoachmark = useCoachmarkReady(
    !loading && showResultsCoachmark && !dismissedThisSession,
  );

  useEffect(() => {
    if (canShowCoachmark && coachmarkStep < 0) setCoachmarkStep(0);
  }, [canShowCoachmark, coachmarkStep]);

  const handleRequestNextStep = useCallback(
    (nextStep: number) => {
      if (scrollThenStepTimerRef.current) {
        clearTimeout(scrollThenStepTimerRef.current);
        scrollThenStepTimerRef.current = null;
      }
      const y = sectionYOffsets.current[nextStep];
      if (y !== undefined) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - SCROLL_OFFSET_PADDING),
          animated: true,
        });
      }
      scrollThenStepTimerRef.current = setTimeout(() => {
        scrollThenStepTimerRef.current = null;
        setCoachmarkStep(nextStep);
        setTargetFrame(null);
      }, SCROLL_THEN_STEP_MS);
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setDismissedThisSession(false);
      return () => {
        setDismissedThisSession(true);
        setCoachmarkStep(-1);
        setTargetFrame(null);
        if (scrollThenStepTimerRef.current) {
          clearTimeout(scrollThenStepTimerRef.current);
          scrollThenStepTimerRef.current = null;
        }
      };
    }, []),
  );

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Cambiado a /details para usar el controlador actualizado
        const res = await apiClient.get(`/match/${matchId}/details`);

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
      } catch (error) {
        console.error(error);
        showAlert("Error", "No se pudieron cargar los resultados.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    if (matchId) fetchResults();
  }, [matchId]);

  const handlePlayerPress = (playerId: string) => {
    const leagueId = matchData?.league_id;
    if (leagueId) {
      router.push({
        pathname: "/(main)/user/[id]",
        params: { id: playerId, leagueId: leagueId },
      });
    }
  };

  const viewShotRef = useRef<ViewShot>(null);
  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      showAlert("Error", "No se pudo compartir la imagen.");
    }
  };

  const customMedalNames = useLeagueMedalNames(matchData?.league_id ?? null);

  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <LeagueHomeHeader
          title="INFORME OFICIAL"
          addTopSafeArea={false}
          onBackPress={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 20 }} />
          <Skeleton width="100%" height={320} borderRadius={16} style={{ marginBottom: 20 }} />
        </ScrollView>
      </SafeAreaView>
    );

  const myStats = players.find((p) => p.id === userId);

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
          .filter((p) => (p.prediction_points ?? 0) > 0)
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
        onBackPress={() => router.back()}
      />

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
        <View
          onLayout={(e) => {
            sectionYOffsets.current[0] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 0}
            style={{ marginBottom: 20 }}
            onMeasure={(frame) => coachmarkStep === 0 && setTargetFrame(frame)}
          >
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
          </CoachmarkHighlight>
        </View>

        <View
          onLayout={(e) => {
            sectionYOffsets.current[1] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 1}
            style={{ marginBottom: 25 }}
            onMeasure={(frame) => coachmarkStep === 1 && setTargetFrame(frame)}
          >
        {myStats && (
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
        )}
          </CoachmarkHighlight>
        </View>

        {/* Quién votó qué (PRO: texto claro; FREE: difuminado + CTA Revelar) */}
        {(matchData?.votes_breakdown?.length ?? 0) > 0 && (
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionHeader}>QUIÉN VOTÓ QUÉ</Text>
          </View>
        )}
        {(matchData?.votes_breakdown?.length ?? 0) > 0 && (
          <View style={styles.votesRevealCard}>
            {(() => {
              const isPro = (matchData?.userPlanType ?? "FREE").toUpperCase() === "PRO";
              const breakdown = matchData.votes_breakdown as { voter_name: string; target_name: string; overall: number }[];
              const listContent = (
                <View style={styles.votesBreakdownList}>
                  {breakdown.map((v, i) => (
                    <View key={i} style={styles.votesBreakdownRow}>
                      <Text style={styles.votesBreakdownText} numberOfLines={1}>
                        <Text style={{ color: Colors.textSecondary }}>{v.voter_name}</Text>
                        {" → "}
                        <Text style={{ color: "white", fontWeight: "600" }}>{v.target_name}</Text>
                        {" "}
                        <Text style={{ color: THEME.gold, fontWeight: "700" }}>{Number(v.overall).toFixed(1)}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              );
              if (isPro) {
                return listContent;
              }
              return (
                <View style={styles.votesRevealLocked}>
                  <View style={[styles.votesBreakdownList, { opacity: 0.35 }]}>
                    {breakdown.map((v, i) => (
                      <View key={i} style={styles.votesBreakdownRow}>
                        <Text style={styles.votesBreakdownText} numberOfLines={1}>
                          {v.voter_name} → {v.target_name} {Number(v.overall).toFixed(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <View style={styles.votesRevealOverlay} />
                    <View style={styles.votesRevealCtaBox}>
                      <Ionicons name="lock-closed" size={32} color={THEME.gold} style={{ marginBottom: 10 }} />
                      <Text style={styles.votesRevealCtaTitle}>Revelar votos</Text>
                      <Text style={styles.votesRevealCtaSub}>Con Plan PRO ves quién votó a quién.</Text>
                      <TouchableOpacity
                        style={styles.votesRevealCtaButton}
                        activeOpacity={0.85}
                        onPress={() => router.push("/(main)/paywall")}
                      >
                        <Text style={styles.votesRevealCtaButtonText}>Revelar votos (Plan PRO)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        <View
          onLayout={(e) => {
            sectionYOffsets.current[2] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 2}
            style={{ marginBottom: 25 }}
            onMeasure={(frame) => coachmarkStep === 2 && setTargetFrame(frame)}
          >
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
          </CoachmarkHighlight>
        </View>

        <View
          onLayout={(e) => {
            sectionYOffsets.current[3] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 3}
            style={{ marginBottom: 25 }}
            onMeasure={(frame) => coachmarkStep === 3 && setTargetFrame(frame)}
          >
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>DUELO DE LA FECHA</Text>
        </View>
        <View style={styles.duelCardWrapper}>
          <DuelCard
            matchId={String(matchId)}
            isAdmin={matchData?.admin_id === userId}
            leagueId={matchData?.league_id ?? undefined}
          />
        </View>
          </CoachmarkHighlight>
        </View>

        {/* TOP 3 PRODE justo debajo del duelo */}
        <View
          onLayout={(e) => {
            sectionYOffsets.current[4] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 4}
            style={{ marginBottom: 25 }}
            onMeasure={(frame) => coachmarkStep === 4 && setTargetFrame(frame)}
          >
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>TOP 3 PRODE</Text>
        </View>
        <View style={styles.predictionTop3Card}>
          {(function () {
            const sorted = [...players].sort(
              (a, b) => (b.prediction_points ?? 0) - (a.prediction_points ?? 0),
            );
            const top3 = sorted
              .slice(0, 3)
              .filter((p) => (p.prediction_points ?? 0) > 0);
            if (top3.length === 0) {
              return (
                <View style={styles.predictionTop3Empty}>
                  <Text style={styles.emptyText}>
                    Aún no hay puntos de predicción para esta fecha.
                  </Text>
                </View>
              );
            }
            return top3.map((player, index) => {
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
            });
          })()}
        </View>
          </CoachmarkHighlight>
        </View>

        <View
          onLayout={(e) => {
            sectionYOffsets.current[5] = e.nativeEvent.layout.y;
          }}
          collapsable={false}
        >
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 5}
            style={{ marginBottom: 20 }}
            onMeasure={(frame) => coachmarkStep === 5 && setTargetFrame(frame)}
          >
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.8}
          onPress={handleShare}
        >
          <Ionicons
            name="share-social"
            size={20}
            color="black"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.shareButtonText}>COMPARTIR EN REDES</Text>
        </TouchableOpacity>
          </CoachmarkHighlight>
        </View>

        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>VOCES DEL VESTUARIO</Text>
        </View>

        <View style={styles.lockerContainer}>
          {comments.length > 0 ? (
            comments.map((c, idx) => (
              <View key={idx} style={styles.commentRow}>
                <View style={styles.commentBar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentHeader}>
                    SOBRE{" "}
                    <Text style={{ color: "white" }}>
                      {c.target_name.toUpperCase()}
                    </Text>
                  </Text>
                  <Text style={styles.commentBody}>"{c.comment}"</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Silencio en el vestuario.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {canShowCoachmark && (
        <CoachmarkModal
          visible={true}
          steps={RESULTS_COACHMARK_STEPS}
          stepIndexProp={coachmarkStep}
          onRequestNextStep={handleRequestNextStep}
          onFinish={() => {
            setDismissedThisSession(true);
            setCoachmarkStep(-1);
            setTargetFrame(null);
            markResultsCoachmark();
          }}
          onStepChange={(step) => {
            setCoachmarkStep(step);
            if (step === -1) setTargetFrame(null);
          }}
          targetFrame={targetFrame}
        />
      )}
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
  votesRevealCard: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 25,
    overflow: "hidden",
    minHeight: 120,
  },
  votesBreakdownList: { padding: 14 },
  votesBreakdownRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(55,65,81,0.5)" },
  votesBreakdownText: { color: "#E5E7EB", fontSize: 13 },
  votesRevealLocked: { position: "relative", minHeight: 180 },
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
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  votesRevealCtaSub: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 16,
  },
  votesRevealCtaButton: {
    backgroundColor: THEME.gold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  votesRevealCtaButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sectionHeaderBox: { marginBottom: 12, marginTop: 5 },
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
    marginBottom: 25,
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
    marginBottom: 25,
  },
  predictionTop3Card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 25,
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
  emptyState: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 8,
  },
  emptyText: { color: "#6B7280", fontStyle: "italic", fontSize: 12 },
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
  shareButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  shareButtonText: {
    color: "black",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
