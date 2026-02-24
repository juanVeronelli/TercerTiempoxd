import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCurrentUser } from "../../../src/hooks/useCurrentUser";
import { useSafeFetch } from "../../../src/hooks/useSafeFetch";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import { LeagueHomeHeader } from "../../../src/components/ui/LeagueHomeHeader";
import { PredictionsBanner } from "../../../src/components/PredictionsBanner";
import { MatchActionButtons } from "../../../src/components/MatchActionButtons";
import { AINewsTeaser } from "../../../src/components/AINewsTeaser";
import { DuelCard } from "../../../src/components/DuelCard";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useLeagueContext } from "../../../src/context/LeagueContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import apiClient from "../../../src/api/apiClient";
import { CoachmarkModal } from "../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../src/components/coachmark/CoachmarkHighlight";
import { useCoachmark, useCoachmarkReady } from "../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../src/constants/CoachmarkKeys";

// Importamos los componentes
import { NextMatchCard } from "../../../src/components/NextMatchCard";
import { MiniLeaderboard } from "../../../src/components/MiniLeaderboard";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { AdminFirstMatchHero } from "../../../src/components/ui/AdminFirstMatchHero";
import { LeagueInviteHero } from "../../../src/components/ui/LeagueInviteHero";
import { MemberPreSeasonHero } from "../../../src/components/ui/MemberPreSeasonHero";
import { UserAvatar } from "../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../src/components/ui/Skeleton";
import { MatchCardSkeleton } from "../../../src/components/ui/MatchCardSkeleton";
import { NativeAdCardWrapper } from "../../../src/components/ads/NativeAdCardWrapper";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- COMPONENTE INTERNO: TARJETA DE RENDIMIENTO (STATS) ---
const StatsSummaryCard = ({
  stats,
  loading,
  leagueId,
}: {
  stats: any;
  loading: boolean;
  leagueId: string;
}) => {
  const router = useRouter();

  if (loading) {
    return (
      <View style={[styles.cardBase, styles.statsCardLoading]}>
        <Skeleton
          width="100%"
          height={140}
          borderRadius={20}
          style={{ alignSelf: "stretch" }}
        />
      </View>
    );
  }

  const rating = stats?.historicalAvg || "-";
  const form = stats?.form ? stats.form.slice(-5) : [];

  return (
    <TouchableOpacity
      style={[styles.cardBase, styles.statsCard]}
      activeOpacity={0.9}
      onPress={() =>
        router.push({ pathname: "/(main)/league/stats", params: { leagueId } })
      }
    >
      <View style={styles.statsBgIcon}>
        <Ionicons name="analytics" size={100} color="rgba(255,255,255,0.03)" />
      </View>

      <View style={styles.statsHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons
            name="chart-timeline-variant"
            size={20}
            color={Colors.accentGold}
          />
          <Text style={styles.cardTitle}>MI RENDIMIENTO</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>

      <View style={styles.statsContent}>
        <View style={styles.ratingColumn}>
          <Text style={styles.ratingBig}>{rating}</Text>
          <Text style={styles.ratingLabel}>MEDIA GLOBAL</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.formColumn}>
          <Text style={styles.kpiLabel}>RACHA</Text>
          <View style={styles.formBubbles}>
            {form.length > 0 ? (
              form.map((res: string, i: number) => {
                const isW = res === "W";
                const isL = res === "L";
                const letter = isW ? "G" : isL ? "P" : "E";
                return (
                  <View
                    key={i}
                    style={[
                      styles.formBubble,
                      isW ? styles.bgW : isL ? styles.bgL : styles.bgD,
                    ]}
                  >
                    <Text
                      style={[
                        styles.formText,
                        isW ? styles.textW : isL ? styles.textL : styles.textD,
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noStatsText}>Sin partidos</Text>
            )}
          </View>
          {form.length > 0 && (
            <Text style={styles.formHint}>
              Últimos {form.length} partido{form.length !== 1 ? "s" : ""}
            </Text>
          )}
          <Text style={styles.tapHint}>Ver estadísticas</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const SQUAD_AVATAR_SIZE = 60;
const SQUAD_GAP = 16;

// Marcos PRO (mismo criterio que profile/results)
const SQUAD_FRAME_COLORS: Record<string, string> = {
  none: "transparent",
  simple: Colors.borderLight,
  gold: Colors.accentGold,
  accent: Colors.primary,
  danger: Colors.status.error,
};
const SQUAD_FRAME_WIDTHS: Record<string, number> = {
  none: 0,
  simple: 2,
  gold: 4,
  accent: 4,
  danger: 4,
};

const HOME_COACHMARK_STEPS = [
  {
    title: "Plantel",
    body: "Acá ves a todos los jugadores de la liga. Tocá a uno para ver su perfil y estadísticas.",
  },
  {
    title: "Mi rendimiento",
    body: "Tu media de puntaje y la racha de últimos partidos. Entrá para ver el detalle completo.",
  },
  {
    title: "Mini ranking",
    body: "El podio de la liga y tu posición. Se actualiza después de cada partido con votación.",
  },
  {
    title: "Prode y predicciones",
    body: "Pronosticá resultados y competí con el resto. Sumá puntos por acertar.",
  },
  {
    title: "Duelos",
    body: "El partido en curso o el último jugado: resultado, MVP y resumen. Tocá para ver detalle.",
  },
  {
    title: "Próximo partido",
    body: "Cuando un admin programe un partido de fútbol en cancha, aparecerá acá para confirmar asistencia.",
  },
];

const SCROLL_OFFSET_PADDING = 100;

export default function LeagueHomeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const leagueContext = useLeagueContext();
  const { userId } = useCurrentUser();
  const { signal } = useSafeFetch();

  const leagueId = (params.id as string) || (params.leagueId as string);
  const leagueName = (params.leagueName as string) || "Liga";

  // Sincronizar params → contexto para que Ranking y Mi rendimiento usen la liga actual
  useFocusEffect(
    useCallback(() => {
      if (leagueId && leagueContext) {
        leagueContext.setLeague(leagueId, leagueName);
      }
    }, [leagueId, leagueName, leagueContext]),
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [userLeagues, setUserLeagues] = useState<any[]>([]);
  const [planType, setPlanType] = useState<string>("FREE");
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [lastMatch, setLastMatch] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);

  const { shouldShow: showHomeCoachmark, markSeen: markHomeCoachmark } =
    useCoachmark(CoachmarkKeys.HOME);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const canShowCoachmark = useCoachmarkReady(
    !showOnboarding && showHomeCoachmark && !dismissedThisSession,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionYOffsets = useRef<Record<number, number>>({});
  const scrollThenStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (canShowCoachmark && coachmarkStep < 0) setCoachmarkStep(0);
  }, [canShowCoachmark, coachmarkStep]);

  const fetchDashboardData = async () => {
    try {
      // 1. Info Usuario y Ligas (signal cancela si el componente se desmonta)
      const meRes = await apiClient.get("/auth/me", { signal });
      setUserLeagues(meRes.data.leagues || []);
      setPlanType(meRes.data.user?.planType || meRes.data.user?.plan_type || "FREE");
      const currentLeague = meRes.data.leagues.find(
        (l: any) => l.id === leagueId,
      );
      const role = (currentLeague?.role || "").toString().toUpperCase();
      const userHasPower = role === "ADMIN" || role === "OWNER";
      setIsAdmin(userHasPower);
      setUserRole(role);

      // 2. Mis Stats
      try {
        const statsRes = await apiClient.get(
          `/leagues/${leagueId}/my-stats`,
          { signal },
        );
        setStats(statsRes.data);
      } catch (e) {
        if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
      }

      // Próximo partido y último partido
      try {
        const [nextRes, recentRes] = await Promise.allSettled([
          apiClient.get(`/match/${leagueId}/next`, { signal }),
          apiClient.get(`/match/${leagueId}/recent-results`, { signal }),
        ]);

        // Procesar Next Match
        if (nextRes.status === "fulfilled") {
          setNextMatch(nextRes.value.data);
        } else {
          setNextMatch(null);
        }

        // Procesar Last Match (Tomamos el primero del array de recientes)
        if (
          recentRes.status === "fulfilled" &&
          recentRes.value.data.length > 0
        ) {
          setLastMatch(recentRes.value.data[0]);
        } else {
          setLastMatch(null);
        }
      } catch (e) {
        if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
      }

      // Miembros
      try {
        const membersRes = await apiClient.get(
          `/leagues/${leagueId}/members`,
          { signal },
        );
        const list = membersRes.data?.members ?? membersRes.data ?? [];
        setMembers(Array.isArray(list) ? list : []);
      } catch (e) {
        if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
        setMembers([]);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return;
      console.error("Error home data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/confirm`, {});
      showAlert("¡Listo!", "Asistencia confirmada.");
      fetchDashboardData();
    } catch (error) {
      showAlert("Error", "No se pudo confirmar.");
    }
  };

  const handleLeaveMatch = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/unconfirm`, {});
      showAlert("Aviso", "Has cancelado tu asistencia.");
      fetchDashboardData();
    } catch (error) {
      showAlert("Error", "No se pudo cancelar.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (leagueId) fetchDashboardData();
    }, [leagueId]),
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

  const SCROLL_THEN_STEP_MS = 480;

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Selector Ligas: actualizar contexto primero para que al cambiar de tab usen la nueva liga
  const handleSwitchLeague = (newLeague: any) => {
    setModalVisible(false);
    if (newLeague.id === leagueId) return;
    if (leagueContext) {
      leagueContext.setLeague(newLeague.id, newLeague.name);
    }
    router.replace({
      pathname: "/(main)/league/home",
      params: {
        id: newLeague.id,
        leagueId: newLeague.id,
        leagueName: newLeague.name,
      },
    });
  };

  const renderLeagueItem = ({ item }: { item: any }) => {
    const isSelected = item.id === leagueId;
    const initial = item.name ? item.name.charAt(0).toUpperCase() : "?";
    return (
      <TouchableOpacity
        style={[styles.leagueCard, isSelected && styles.leagueCardActive]}
        onPress={() => handleSwitchLeague(item)}
      >
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.leagueAvatar,
              isSelected && { backgroundColor: Colors.accentGold },
            ]}
          >
            <Text style={[styles.avatarText, isSelected && { color: Colors.textInverse }]}>
              {initial}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text
              style={[
                styles.leagueNameText,
                isSelected && { color: Colors.accentGold },
              ]}
            >
              {item.name}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.role || "MIEMBRO"}</Text>
            </View>
          </View>
        </View>
        {isSelected && (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color="black" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // --- LÓGICA DE VISUALIZACIÓN DEL DUELO ---
  const duelMatchId = nextMatch?.id || lastMatch?.id;
  const canAdminDuel = !!nextMatch && isAdmin;

  // --- ONBOARDING DE ADMIN ---
  // Todo el home bloqueado para admin hasta que invite al primer amigo (members >= 2).
  // Luego se desbloquea todo (con bloqueos de widgets para todos: rendimiento/miniranking según corresponda).
  const needsPlayers = members.length < 2;
  const showOnboarding = !loading && isAdmin && needsPlayers;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <LeagueHomeHeader title="" leagueId={leagueId} showSettings />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          showOnboarding && styles.scrollContentOnboarding,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentGold}
          />
        }
      >
        {showOnboarding ? (
          /* CASO A: Solo admin con < 2 miembros — solo hero de invitar + hint bloqueado */
          <>
            <View style={styles.onboardingContainer}>
              <Text style={styles.onboardingTitle}>
                ¡Todo listo para arrancar!
              </Text>
              <View style={styles.onboardingCardSpacer}>
                <LeagueInviteHero leagueId={leagueId} />
              </View>
            </View>

            {/* Widget Plantel — siempre visible */}
            <View style={styles.squadSection}>
              <View style={styles.squadHeader}>
                <Text style={styles.squadTitle}>
                  Plantel ({members.length})
                </Text>
              </View>
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.squadListContent}
                renderItem={({ item: member }) => {
                  const isCurrentUser = member.user_id === userId;
                  const isPro = (member.users?.planType ?? member.users?.plan_type) === "PRO";
                  const frameId = member.users?.avatar_frame || "none";
                  const hasProFrame =
                    isPro && frameId !== "none";
                  const frameColor =
                    frameId === "accent"
                      ? member.users?.accent_color || Colors.primary
                      : SQUAD_FRAME_COLORS[frameId] ?? "transparent";
                  const frameWidth = SQUAD_FRAME_WIDTHS[frameId] ?? 0;
                  const displayName =
                    member.users?.username ||
                    member.users?.full_name ||
                    "Usuario";
                  const truncatedName =
                    displayName.length > 12
                      ? displayName.slice(0, 12) + "…"
                      : displayName;
                  const avatarWrapStyle = hasProFrame
                    ? [
                        styles.squadAvatarWrapFrame,
                        {
                          borderColor: frameColor,
                          borderWidth: frameWidth,
                          padding: frameWidth,
                          borderRadius:
                            SQUAD_AVATAR_SIZE / 2 + frameWidth + 4,
                        },
                      ]
                    : undefined;
                  return (
                    <TouchableOpacity
                      style={styles.squadItem}
                      onPress={() =>
                        router.push({
                          pathname: "/(main)/user/[id]",
                          params: { id: member.user_id },
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={avatarWrapStyle}>
                        <UserAvatar
                          size={SQUAD_AVATAR_SIZE}
                          imageUrl={member.users?.profile_photo_url}
                          name={
                            member.users?.full_name ||
                            member.users?.username ||
                            "Usuario"
                          }
                        />
                      </View>
                      <Text
                        style={styles.squadItemName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {isCurrentUser ? "Tú" : truncatedName}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.lockedHomeHint}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={44}
                color={Colors.iconMuted}
                style={styles.lockedHomeHintIcon}
              />
              <Text style={styles.lockedHomeHintText}>
                Invita al menos un amigo para desbloquear el Inicio.
              </Text>
            </View>
          </>
        ) : (
          /* CASO B: Home desbloqueado (todos: o admin con 2+ miembros) — widget locks para todos si aplica */
          <>
            {/* Hero crear partido: solo admin y solo si aún no hay ningún partido jugado en la liga */}
            {isAdmin && !lastMatch && (
              <View style={styles.onboardingCardSpacer}>
                <AdminFirstMatchHero
                  onProgramMatch={() =>
                    router.push({
                      pathname: "/(main)/league/match/create",
                      params: { leagueId },
                    })
                  }
                />
              </View>
            )}

            {/* Hero Espera: miembro sin partido programado ni jugado — se va cuando el admin programa el primero */}
            {!isAdmin && !lastMatch && !nextMatch && (
              <View style={styles.onboardingCardSpacer}>
                <MemberPreSeasonHero
                  leagueId={leagueId}
                  leagueName={leagueName}
                />
              </View>
            )}

            {/* Widget Plantel — siempre visible (arriba para miembros, debajo del hero para admin) */}

            <MatchActionButtons leagueId={leagueId} />

            <View
              onLayout={(e) => {
                sectionYOffsets.current[0] = e.nativeEvent.layout.y;
              }}
              collapsable={false}
            >
              <CoachmarkHighlight
                highlighted={canShowCoachmark && coachmarkStep === 0}
                style={styles.squadSection}
                onMeasure={(frame) =>
                  coachmarkStep === 0 && setTargetFrame(frame)
                }
              >
                <View style={styles.squadHeader}>
                  <Text style={styles.squadTitle}>
                    Plantel ({members.length})
                  </Text>
                </View>
                <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.squadListContent}
                renderItem={({ item: member }) => {
                  const isCurrentUser = member.user_id === userId;
                  const isPro = (member.users?.planType ?? member.users?.plan_type) === "PRO";
                  const frameId = member.users?.avatar_frame || "none";
                  const hasProFrame =
                    isPro && frameId !== "none";
                  const frameColor =
                    frameId === "accent"
                      ? member.users?.accent_color || Colors.primary
                      : SQUAD_FRAME_COLORS[frameId] ?? "transparent";
                  const frameWidth = SQUAD_FRAME_WIDTHS[frameId] ?? 0;
                  const displayName =
                    member.users?.username ||
                    member.users?.full_name ||
                    "Usuario";
                  const truncatedName =
                    displayName.length > 12
                      ? displayName.slice(0, 12) + "…"
                      : displayName;
                  const avatarWrapStyle = hasProFrame
                    ? [
                        styles.squadAvatarWrapFrame,
                        {
                          borderColor: frameColor,
                          borderWidth: frameWidth,
                          padding: frameWidth,
                          borderRadius:
                            SQUAD_AVATAR_SIZE / 2 + frameWidth + 4,
                        },
                      ]
                    : undefined;
                  return (
                    <TouchableOpacity
                      style={styles.squadItem}
                      onPress={() =>
                        router.push({
                          pathname: "/(main)/user/[id]",
                          params: { id: member.user_id },
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={avatarWrapStyle}>
                        <UserAvatar
                          size={SQUAD_AVATAR_SIZE}
                          imageUrl={member.users?.profile_photo_url}
                          name={
                            member.users?.full_name ||
                            member.users?.username ||
                            "Usuario"
                          }
                        />
                      </View>
                      <Text
                        style={styles.squadItemName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {isCurrentUser ? "Tú" : truncatedName}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
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
                style={{ marginBottom: 20 }}
                onMeasure={(frame) =>
                  coachmarkStep === 1 && setTargetFrame(frame)
                }
              >
            {(stats?.recentMatches?.length ?? 0) > 0 ? (
              <StatsSummaryCard
                stats={stats}
                loading={loading}
                leagueId={leagueId}
              />
            ) : (
              <View style={styles.miniRendimientoLocked}>
                <Ionicons
                  name="stats-chart-outline"
                  size={36}
                  color={Colors.iconMuted}
                  style={styles.miniLeaderboardLockedIcon}
                />
                <Text style={styles.miniLeaderboardLockedText}>
                  Juega tu primer partido en cancha (fútbol real) para
                  desbloquear tu widget de rendimiento.
                </Text>
              </View>
            )}
              </CoachmarkHighlight>
            </View>

            <AINewsTeaser />

            <View
              onLayout={(e) => {
                sectionYOffsets.current[2] = e.nativeEvent.layout.y;
              }}
              collapsable={false}
            >
              <CoachmarkHighlight
                highlighted={canShowCoachmark && coachmarkStep === 2}
                style={{ marginBottom: 20 }}
                onMeasure={(frame) =>
                  coachmarkStep === 2 && setTargetFrame(frame)
                }
              >
            {lastMatch ? (
              <MiniLeaderboard leagueId={leagueId} />
            ) : (
              <View style={styles.miniLeaderboardLocked}>
                <Ionicons
                  name="trophy-outline"
                  size={36}
                  color={Colors.iconMuted}
                  style={styles.miniLeaderboardLockedIcon}
                />
                <Text style={styles.miniLeaderboardLockedText}>
                  El miniranking se desbloqueará después del primer partido en
                  cancha con votación completada.
                </Text>
              </View>
            )}
              </CoachmarkHighlight>
            </View>

            <NativeAdCardWrapper
              style={{ marginTop: 16, marginBottom: 16 }}
              isPro={planType === "PRO"}
            />

            <View
              onLayout={(e) => {
                sectionYOffsets.current[3] = e.nativeEvent.layout.y;
              }}
              collapsable={false}
            >
              <CoachmarkHighlight
                highlighted={canShowCoachmark && coachmarkStep === 3}
                style={{ marginBottom: 20 }}
                onMeasure={(frame) =>
                  coachmarkStep === 3 && setTargetFrame(frame)
                }
              >
                <PredictionsBanner leagueId={leagueId} />
              </CoachmarkHighlight>
            </View>

            {loading ? (
              <View style={{ marginTop: 10 }}>
                <MatchCardSkeleton />
              </View>
            ) : (
              <>
                <View
                  onLayout={(e) => {
                    sectionYOffsets.current[4] = e.nativeEvent.layout.y;
                  }}
                  collapsable={false}
                >
                  <CoachmarkHighlight
                    highlighted={canShowCoachmark && coachmarkStep === 4}
                    style={{ marginBottom: 8 }}
                    onMeasure={(frame) =>
                      coachmarkStep === 4 && setTargetFrame(frame)
                    }
                  >
                    {duelMatchId ? (
                      <View style={{ marginTop: 10, marginBottom: 5 }}>
                        {!nextMatch && lastMatch && (
                          <Text style={styles.sectionTitle}>
                            RESULTADO DESTACADO (PARTIDO JUGADO)
                          </Text>
                        )}
                        <DuelCard
                          matchId={duelMatchId}
                          isAdmin={canAdminDuel}
                          onRefresh={fetchDashboardData}
                          leagueId={leagueId}
                        />
                      </View>
                    ) : (
                      <View style={{ minHeight: 60 }} />
                    )}
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
                    style={{ marginBottom: 24 }}
                    onMeasure={(frame) =>
                      coachmarkStep === 5 && setTargetFrame(frame)
                    }
                  >
                    {nextMatch ? (
                      <View>
                        <Text style={styles.sectionTitle}>
                          PRÓXIMO ENCUENTRO (FÚTBOL REAL)
                        </Text>
                        <NextMatchCard
                          match={nextMatch}
                          isAdmin={isAdmin}
                          userRole={userRole}
                          onConfirm={() => handleJoinMatch(nextMatch.id)}
                          onCancel={() => handleLeaveMatch(nextMatch.id)}
                          onEdit={
                            isAdmin ||
                            userRole === "ADMIN" ||
                            userRole === "OWNER"
                              ? () =>
                                  router.push({
                                    pathname: `/(main)/league/match/${nextMatch.id}`,
                                    params: { userRole },
                                  })
                              : undefined
                          }
                        />
                      </View>
                    ) : (
                      <EmptyState
                        title="Esperando convocatoria"
                        message="Cuando un admin programe un partido de fútbol en cancha (5, 7 u 11), aparecerá aquí."
                        iconName="calendar"
                      />
                    )}
                  </CoachmarkHighlight>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {canShowCoachmark && (
          <CoachmarkModal
            visible={true}
            steps={HOME_COACHMARK_STEPS}
            stepIndexProp={coachmarkStep}
            onRequestNextStep={handleRequestNextStep}
            onFinish={() => {
              setDismissedThisSession(true);
              setCoachmarkStep(-1);
              setTargetFrame(null);
              markHomeCoachmark();
            }}
            onStepChange={(step) => {
              setCoachmarkStep(step);
              if (step === -1) setTargetFrame(null);
            }}
            targetFrame={targetFrame}
          />
        )}

      {/* MODAL SELECTOR */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHandleContainer}>
              <View style={styles.modalHandle} />
            </View>
            <Text style={styles.modalTitle}>Cambiar de Liga</Text>
            <FlatList
              data={userLeagues}
              keyExtractor={(i) => i.id}
              renderItem={renderLeagueItem}
              style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 50 },
  scrollContentOnboarding: { flexGrow: 1, justifyContent: "center" },

  // --- ONBOARDING ADMIN ---
  onboardingContainer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  onboardingTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
  },
  onboardingCardSpacer: {
    width: "100%",
    marginBottom: 20,
  },
  lockedHomeHint: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  lockedHomeHintIcon: {
    opacity: 0.85,
    marginBottom: 14,
  },
  lockedHomeHintText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },

  // --- Widget Plantel ---
  squadSection: {
    marginBottom: 24,
  },
  squadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  squadTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  squadAvatarWrapFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
  squadListContent: {
    paddingHorizontal: 16,
    paddingRight: 50,
    gap: SQUAD_GAP,
  },
  squadItem: {
    alignItems: "center",
    width: SQUAD_AVATAR_SIZE + 24,
  },
  squadItemName: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 84,
    textAlign: "center",
  },

  miniLeaderboardLocked: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 20,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  miniRendimientoLocked: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 20,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLeaderboardLockedIcon: {
    opacity: 0.8,
    marginBottom: 12,
  },
  miniLeaderboardLockedText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },

  // --- COMPONENTES GLOBALES ---
  cardBase: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 5,
  },

  // --- STATS CARD ---
  statsCardLoading: { height: 140, justifyContent: "center" },
  statsCard: { padding: 20, position: "relative", minHeight: 140 },
  statsBgIcon: { position: "absolute", right: -20, bottom: -20, opacity: 0.1 },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  cardTitle: {
    color: Colors.accentGold,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  statsContent: { flexDirection: "row", alignItems: "center" },
  ratingColumn: { alignItems: "flex-start", minWidth: 80 },
  ratingBig: {
    fontSize: 48,
    fontWeight: "900",
    color: Colors.white,
    lineHeight: 48,
  },
  ratingLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 20,
  },
  formColumn: { flex: 1 },
  kpiLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  formBubbles: { flexDirection: "row", gap: 6, marginBottom: 6 },
  formBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  formText: { fontSize: 10, fontWeight: "900" },
  formHint: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2,
  },
  noStatsText: { color: Colors.textMuted, fontSize: 12, fontStyle: "italic" },
  tapHint: { color: Colors.accentGold, fontSize: 10, fontWeight: "600" },

  // Racha colores (W/D/L)
  bgW: { backgroundColor: Colors.status.successSubtle, borderColor: Colors.status.success },
  textW: { color: Colors.status.success },
  bgL: { backgroundColor: Colors.status.errorSubtle, borderColor: Colors.status.error },
  textL: { color: Colors.status.error },
  bgD: { backgroundColor: Colors.status.drawSubtle, borderColor: Colors.status.draw },
  textD: { color: Colors.status.draw },

  // --- PLACEHOLDERS ---
  placeholder: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontWeight: "900",
    fontSize: 13,
    marginTop: 10,
  },
  placeholderSub: { color: Colors.textMuted, fontSize: 11 },
  carouselPlaceholder: {
    height: 160,
    backgroundColor: Colors.surfaceDark,
    borderStyle: "dashed",
  },
  adPlaceholder: {
    height: 80,
    backgroundColor: Colors.adPlaceholder,
    borderStyle: "dashed",
    borderColor: Colors.adPlaceholderBorder,
  },
  adText: {
    color: Colors.placeholder,
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  noMatchContainer: { alignItems: "center", marginTop: 10, opacity: 0.5 },
  noMatchText: { color: Colors.textSecondary, fontSize: 12, fontStyle: "italic" },

  // --- MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandleContainer: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 5,
  },
  modalHandle: {
    width: 50,
    height: 5,
    backgroundColor: Colors.modalHandle,
    borderRadius: 10,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center",
  },
  leagueCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceElevated,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leagueCardActive: {
    backgroundColor: Colors.accentGoldCardBg,
    borderColor: Colors.accentGold,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 15, flex: 1 },
  leagueAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: Colors.textHeading, fontSize: 18, fontWeight: "900" },
  cardInfo: { flex: 1 },
  leagueNameText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  roleBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleText: { color: Colors.textSecondary, fontSize: 9, fontWeight: "bold" },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentGold,
    justifyContent: "center",
    alignItems: "center",
  },
});
