import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ActivityIndicator,
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
  Image,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCurrentUser } from "../../../src/hooks/useCurrentUser";
import { useSafeFetch } from "../../../src/hooks/useSafeFetch";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import { LeagueHomeHeader } from "../../../src/components/ui/LeagueHomeHeader";
import { PredictionsBanner } from "../../../src/components/PredictionsBanner";
import { AINewsTeaser } from "../../../src/components/AINewsTeaser";
import { DuelCard } from "../../../src/components/DuelCard";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useLeagueContext } from "../../../src/context/LeagueContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import apiClient from "../../../src/api/apiClient";
import { formatUserFacingError } from "../../../src/api/apiErrors";
import { useTtp } from "../../../src/context/TtpContext";


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
import { AVATAR_FRAMES } from "../../../src/components/profile/profileConstants";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// El ScrollView del home tiene paddingHorizontal=20 → el ancho útil real es (screen - 40).
// Si usamos (screen - 32) la card se corta/traspasa en algunos dispositivos.
const ACTION_CARD_W = Math.min(Dimensions.get("window").width - 40, 420);

function formatActionMatchDateTime(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  // ej: "vie 02 may · 22:00"
  return `${day} · ${time}`.replace(/\.$/, "");
}

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
const SQUAD_GAP = 12;
const SQUAD_FRAME_OVERLAY_SIZE = Math.round(SQUAD_AVATAR_SIZE * 1.7);

const SQUAD_FRAME_ALIASES: Record<string, string> = {
  danger: "danger_frame",
  streak: "streak_frame",
  mvp: "mvp_frame",
  crown: "crown_frame",
  duo: "duo_frame",
  captain: "captain_frame",
  champion: "champion_frame",
  phoenix: "phoenix_frame",
  ghost: "ghost_frame",
  duel: "duel_frame",
  oracle: "oracle_frame",
  neon: "neon_frame",
  all_rounder: "all_rounder_frame",
  comeback: "comeback_frame",
};

const SCROLL_OFFSET_PADDING = 100;

export default function LeagueHomeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const leagueContext = useLeagueContext();
  const { userId } = useCurrentUser();
  const { signal } = useSafeFetch();
  const ttp = useTtp();

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
  const [votingMatches, setVotingMatches] = useState<any[]>([]);
  const [lastMatch, setLastMatch] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [actionNowRemote, setActionNowRemote] = useState<
    Array<{
      key: string;
      kind: string;
      title: string;
      subtitle: string;
      primary: { label: string; screen: string; params?: Record<string, string> };
    }>
  >([]);
  const [monthlyRewardVisible, setMonthlyRewardVisible] = useState(false);
  const [monthlyRewardAmount, setMonthlyRewardAmount] = useState(0);
  const [monthlyRewardPeriodKey, setMonthlyRewardPeriodKey] = useState<string | null>(null);
  const [monthlyRewardMeta, setMonthlyRewardMeta] = useState<any>(null);

  const resolveSquadFrame = useCallback(
    (frameId?: string, accentColor?: string | null) => {
      const normalizedFrameId = (frameId || "none").trim().toLowerCase();
      const canonicalFrameId = SQUAD_FRAME_ALIASES[normalizedFrameId] ?? normalizedFrameId;
      const preset =
        AVATAR_FRAMES.find((frame) => frame.id.toLowerCase() === canonicalFrameId) ??
        AVATAR_FRAMES[0];
      const frameColor = preset.color === "accent" ? (accentColor || Colors.primary) : preset.color;
      return {
        source: preset.source as ImageSourcePropType | null,
        frameColor,
        frameWidth: preset.width,
        hasFrame: preset.id !== "none",
      };
    },
    [],
  );

  const renderSquadMember = useCallback(
    ({ item: member }: { item: any }) => {
      const isCurrentUser = member.user_id === userId;
      const userData = member.users ?? member.user ?? member;
      const frameId =
        userData?.avatar_frame ??
        userData?.avatarFrame ??
        member.avatar_frame ??
        member.avatarFrame ??
        "none";
      const { source: frameSource, frameColor, frameWidth, hasFrame } = resolveSquadFrame(
        frameId,
        userData?.accent_color ?? userData?.accentColor,
      );
      const displayName =
        userData?.username ||
        userData?.full_name ||
        userData?.fullName ||
        "Usuario";
      const truncatedName =
        displayName.length > 12 ? `${displayName.slice(0, 12)}…` : displayName;

      return (
        <TouchableOpacity
          style={styles.squadItem}
          onPress={() =>
            router.push({
              pathname: "/(main)/user/[id]",
              params: { id: member.user_id, leagueId },
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.squadAvatarSlot}>
            <UserAvatar
              size={SQUAD_AVATAR_SIZE}
              imageUrl={member.users?.profile_photo_url}
              name={
                userData?.full_name ||
                userData?.fullName ||
                userData?.username ||
                "Usuario"
              }
            />
            {hasFrame && frameSource ? (
              <Image
                source={frameSource}
                style={styles.squadAvatarFrameOverlay}
                resizeMode="contain"
              />
            ) : null}
            {hasFrame && !frameSource && frameWidth > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.squadAvatarBorderOverlay,
                  {
                    borderColor: frameColor,
                    borderWidth: frameWidth,
                  },
                ]}
              />
            ) : null}
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
    },
    [leagueId, resolveSquadFrame, router, userId],
  );

  // --- ONBOARDING DE ADMIN ---
  // Todo el home bloqueado para admin hasta que invite al primer amigo (members >= 2).
  // Luego se desbloquea todo (con bloqueos de widgets para todos: rendimiento/miniranking según corresponda).
  const needsPlayers = members.length < 2;
  const showOnboarding = !loading && isAdmin && needsPlayers;

  const scrollViewRef = useRef<ScrollView>(null);


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

      // Popup one-shot: recompensa por predicciones mensuales (si corresponde)
      try {
        const popupRes = await apiClient.get<{
          show: boolean;
          amount?: number;
          periodKey?: string;
          meta?: any;
        }>(`/leagues/${leagueId}/monthly-reward-popup`, { signal });
        if (popupRes.data?.show) {
          ttp?.refresh?.().catch(() => {});
          setMonthlyRewardAmount(Number(popupRes.data.amount ?? 0));
          setMonthlyRewardPeriodKey(
            popupRes.data.periodKey != null ? String(popupRes.data.periodKey) : null,
          );
          setMonthlyRewardMeta(popupRes.data.meta ?? null);
          setMonthlyRewardVisible(true);
        }
      } catch (e) {
        if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
      }

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
        const [nextRes, recentRes, voteRes, actionsRes] = await Promise.allSettled([
          apiClient.get(`/match/${leagueId}/next`, { signal }),
          apiClient.get(`/match/${leagueId}/recent-results`, { signal }),
          apiClient.get(`/match/${leagueId}/voting`, { signal }),
          apiClient.get(`/actions/now`, { signal, params: { leagueId } }),
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

        if (voteRes.status === "fulfilled") {
          setVotingMatches(Array.isArray(voteRes.value.data) ? voteRes.value.data : []);
        } else {
          setVotingMatches([]);
        }

        if (actionsRes.status === "fulfilled") {
          const arr = actionsRes.value.data?.actions ?? [];
          setActionNowRemote(Array.isArray(arr) ? arr : []);
        } else {
          setActionNowRemote([]);
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
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo cargar el home de la liga."),
        undefined,
        "error",
      );
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
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo confirmar."),
        undefined,
        "error",
      );
    }
  };

  const handleLeaveMatch = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/unconfirm`, {});
      showAlert("Aviso", "Has cancelado tu asistencia.");
      fetchDashboardData();
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo cancelar."),
        undefined,
        "error",
      );
    }
  };

  const handleSignup = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/signup`, {});
      showAlert("¡Listo!", "Te anotaste al partido.");
      fetchDashboardData();
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo anotar."),
        undefined,
        "error",
      );
    }
  };

  const handleUnsignup = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/unsignup`, {});
      showAlert("Aviso", "Te desanotaste del partido.");
      fetchDashboardData();
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo desanotar."),
        undefined,
        "error",
      );
    }
  };

  const handleSpectate = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/spectate`, {});
      showAlert("¡Listo!", "Marcaste que vas a ir como espectador.");
      fetchDashboardData();
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo confirmar."),
        undefined,
        "error",
      );
    }
  };

  const handleUnspectate = async (matchId: string) => {
    try {
      await apiClient.post(`/match/${matchId}/unspectate`, {});
      showAlert("Aviso", "Cancelaste tu asistencia como espectador.");
      fetchDashboardData();
    } catch (error: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(error, "No se pudo cancelar."),
        undefined,
        "error",
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (leagueId) fetchDashboardData();
    }, [leagueId]),
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
            {item.profile_photo_url ? (
              <Image
                source={{ uri: item.profile_photo_url }}
                style={styles.leagueAvatarImage}
              />
            ) : (
              <Text style={[styles.avatarText, isSelected && { color: Colors.textInverse }]}>
                {initial}
              </Text>
            )}
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
  const canAdminDuel = isAdmin && Boolean(duelMatchId);

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
        scrollEnabled={!loading}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentGold}
          />
        }
      >
        {loading ? (
          // Fondo limpio durante carga (evita flashes de estados vacíos).
          <View style={{ minHeight: 240 }} />
        ) : showOnboarding ? (
          /* CASO A: Solo admin con < 2 miembros — solo hero de invitar + hint bloqueado */
          <>
            <View style={styles.onboardingContainer}>
              <Text style={styles.onboardingTitle}>¡Todo listo para arrancar!</Text>
              <View style={styles.onboardingCardSpacer}>
                <LeagueInviteHero leagueId={leagueId} />
              </View>
            </View>

            {/* Widget Plantel — siempre visible */}
            <View style={styles.squadSection}>
              <View style={styles.squadHeader}>
                <Text style={styles.squadTitle}>Plantel ({members.length})</Text>
              </View>
              <FlatList
                data={members}
                keyExtractor={(m) => m.user_id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.squadListContent}
                renderItem={renderSquadMember}
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

            {/* TU ACCIÓN AHORA (UX): Votar / Anotarte / Confirmar / Espectador */}
            <View style={styles.actionNowWrap}>
              <Text style={styles.sectionTitle}>TU ACCIÓN AHORA</Text>
              <Text style={styles.actionNowHint}>Deslizá para ver más acciones</Text>
              {(() => {
                const localCards: any[] = [];
                if (votingMatches.length > 0) {
                  const when = formatActionMatchDateTime(votingMatches[0]?.date_time);
                  localCards.push({
                    key: "local:voting",
                    title: "VOTACIÓN ABIERTA",
                    subtitle: votingMatches[0]?.location_name ?? "Partido terminado",
                    detail: "Ya podés votar el informe del partido.",
                    when,
                    icon: { name: "star" as const, color: Colors.accentGold },
                    primary: {
                      label: "VOTAR AHORA",
                      onPress: () =>
                        router.push({
                          pathname: "/(main)/league/match/vote",
                          params: { matchId: votingMatches[0].id },
                        }),
                      variant: "gold" as const,
                    },
                  });
                } else if (nextMatch) {
                  const isOpenSignup = nextMatch?.is_open_signup === true;
                  const userSignedUp = nextMatch?.user_signed_up === true;
                  const maxPlayers = typeof nextMatch?.max_players === "number" ? nextMatch.max_players : null;
                  const signedUpCount = typeof nextMatch?.signed_up_count === "number" ? nextMatch.signed_up_count : null;
                  const isFull =
                    typeof maxPlayers === "number" &&
                    typeof signedUpCount === "number" &&
                    signedUpCount >= maxPlayers;
                  const status = String(nextMatch?.user_status ?? "").toUpperCase();
                  const isSummoned = status === "PENDING" || status === "CONFIRMED";
                  const spectatorAttending = nextMatch?.spectator_attending === true;

                  const subtitle = nextMatch?.location_name ?? "Próximo partido";
                  const when = formatActionMatchDateTime(nextMatch?.date_time);
                  const actionLabel = isOpenSignup
                    ? userSignedUp
                      ? "DESANOTARME"
                      : isFull
                        ? "CUPO COMPLETO"
                        : "ANOTARME"
                    : isSummoned
                      ? status === "CONFIRMED"
                        ? "CANCELAR ASISTENCIA"
                        : "CONFIRMAR ASISTENCIA"
                      : spectatorAttending
                        ? "CANCELAR ESPECTADOR"
                        : "VOY COMO ESPECTADOR";

                  const onPress = () => {
                    if (isOpenSignup) {
                      if (userSignedUp) return handleUnsignup(nextMatch.id);
                      if (isFull) return;
                      return handleSignup(nextMatch.id);
                    }
                    if (isSummoned) {
                      if (status === "CONFIRMED") return handleLeaveMatch(nextMatch.id);
                      return handleJoinMatch(nextMatch.id);
                    }
                    if (spectatorAttending) return handleUnspectate(nextMatch.id);
                    return handleSpectate(nextMatch.id);
                  };

                  localCards.push({
                    key: "local:nextmatch",
                    title: "PRÓXIMO PARTIDO",
                    subtitle,
                    detail: isOpenSignup
                      ? "Anotate para jugar."
                      : isSummoned
                        ? "Confirmá tu asistencia."
                        : "Marcá si vas como espectador.",
                    when,
                    icon: { name: "flash" as const, color: Colors.primary },
                    meta: isOpenSignup
                      ? `${typeof signedUpCount === "number" ? signedUpCount : "-"}${typeof maxPlayers === "number" ? ` / ${maxPlayers}` : ""} anotados`
                      : null,
                    primary: {
                      label: actionLabel,
                      onPress,
                      disabled: isOpenSignup && !userSignedUp && isFull,
                      variant: "primary" as const,
                    },
                  });
                } else {
                  localCards.push({
                    key: "local:none",
                    title: "SIN ACCIONES PENDIENTES",
                    subtitle: "Cuando haya un partido o votación, aparecerá aquí.",
                    detail: null,
                    icon: { name: "information-circle-outline" as const, color: Colors.textMuted },
                    primary: null,
                  });
                }

                const remote = (actionNowRemote ?? []).map((a) => ({
                  ...a,
                  icon:
                    a.kind === "MISSION_CLAIM"
                      ? { name: "trophy-outline" as const, color: Colors.accentGold }
                      : a.kind === "HOUSE_BET_SETTLED"
                        ? { name: "poker-chip" as const, color: Colors.accentGold }
                        : a.kind === "PRODE_OPEN"
                          ? { name: "list" as const, color: Colors.primary }
                          : { name: "stats-chart-outline" as const, color: Colors.status.success },
                }));

                const combined = [...localCards, ...remote];

                const handleSeen = async (key: string) => {
                  try {
                    await apiClient.post("/actions/seen", { keys: [key] });
                  } catch {}
                  setActionNowRemote((prev) => prev.filter((x) => x.key !== key));
                };

                return (
                  <FlatList
                    data={combined}
                    keyExtractor={(it) => it.key}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={ACTION_CARD_W + 12}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingRight: 4 }}
                    renderItem={({ item }) => {
                      const isRemote = item.kind != null;
                      const isEmpty = item.key === "local:none";
                      const onPrimaryPress = () => {
                        if (isRemote) {
                          handleSeen(item.key);
                          router.push({ pathname: item.primary.screen, params: item.primary.params ?? {} } as any);
                          return;
                        }
                        item.primary?.onPress?.();
                      };
                      const primaryLabel = isRemote ? item.primary?.label : item.primary?.label;
                      const primaryDisabled = isRemote ? false : Boolean(item.primary?.disabled);
                      const primaryVariant = isRemote
                        ? "primary"
                        : item.primary?.variant === "gold"
                          ? "gold"
                          : "primary";

                      if (isEmpty) {
                        return (
                          <View style={[styles.actionNowCard, { width: ACTION_CARD_W, marginRight: 12 }]}>
                            <View style={[styles.actionNowBody, styles.actionNowEmptyBody]}>
                              <View style={styles.actionNowEmptyTop}>
                                <View style={styles.actionNowEmptyIconWrap}>
                                  <Ionicons
                                    name={item.icon.name}
                                    size={28}
                                    color={Colors.textMuted}
                                  />
                                </View>
                                <Text style={styles.actionNowEmptyTitle}>{item.title}</Text>
                                <Text style={styles.actionNowEmptySubtitle} numberOfLines={2}>
                                  {item.subtitle}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View style={[styles.actionNowCard, { width: ACTION_CARD_W, marginRight: 12 }]}>
                          <View style={styles.actionNowBody}>
                            <View style={styles.actionNowTopRow}>
                              <View style={styles.actionNowIconWrap}>
                                <Ionicons name={item.icon.name} size={18} color={item.icon.color} />
                              </View>

                              <View style={{ flex: 1 }}>
                                <Text style={styles.actionNowTitle} numberOfLines={1}>
                                  {item.title}
                                </Text>
                                <Text style={styles.actionNowSubtitle} numberOfLines={1}>
                                  {item.subtitle}
                                </Text>
                                {!!item.detail && (
                                  <Text style={styles.actionNowDetail} numberOfLines={1}>
                                    {item.detail}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {(!!item.when || !!item.meta) && (
                              <View style={styles.actionNowPillsRow}>
                                {!!item.when && (
                                  <View style={styles.actionNowPill}>
                                    <Ionicons
                                      name="calendar-outline"
                                      size={14}
                                      color={Colors.textMuted}
                                    />
                                    <Text style={styles.actionNowPillText} numberOfLines={1}>
                                      {item.when}
                                    </Text>
                                  </View>
                                )}
                                {!!item.meta && (
                                  <View style={styles.actionNowPill}>
                                    <Ionicons
                                      name="people-outline"
                                      size={14}
                                      color={Colors.textMuted}
                                    />
                                    <Text style={styles.actionNowPillText} numberOfLines={1}>
                                      {item.meta}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {(!!item.detail || !!item.when || !!item.meta) && (
                              <View style={styles.actionNowDivider} />
                            )}

                            {!!primaryLabel && (
                              <TouchableOpacity
                                style={[
                                  styles.actionNowPrimaryBtn,
                                  primaryVariant === "gold" && { backgroundColor: Colors.accentGold },
                                  primaryDisabled && { opacity: 0.55 },
                                ]}
                                onPress={onPrimaryPress}
                                activeOpacity={0.9}
                                disabled={primaryDisabled}
                              >
                                <Text
                                  style={[
                                    styles.actionNowPrimaryText,
                                    primaryVariant === "gold" && { color: "#111827" },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {primaryLabel}
                                </Text>
                                <Ionicons
                                  name="chevron-forward"
                                  size={18}
                                  color={primaryVariant === "gold" ? "#111827" : "white"}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    }}
                  />
                );
              })()}
            </View>

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
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.squadListContent}
                renderItem={renderSquadMember}
              />
            </View>

            {(stats?.recentMatches?.length ?? 0) > 0 ? (
              <View>
                <StatsSummaryCard
                  stats={stats}
                  loading={loading}
                  leagueId={leagueId}
                />
              </View>
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


            <AINewsTeaser />

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


            <NativeAdCardWrapper
              style={{ marginTop: 16, marginBottom: 16 }}
              isPro={planType === "PRO"}
            />

                <PredictionsBanner leagueId={leagueId} />


            {loading ? (
              <View style={{ marginTop: 10 }}>
                <MatchCardSkeleton />
              </View>
            ) : (
              <>
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
                                    pathname: "/(main)/league/match/[id]",
                                    params: { id: nextMatch.id, userRole },
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

              </>
            )}
          </>
        )}
      </ScrollView>

      {loading ? (
        <View pointerEvents="auto" style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.accentGold} />
            <Text style={styles.loadingTitle}>Cargando liga…</Text>
            <Text style={styles.loadingSub} numberOfLines={2}>
              Preparando tu inicio
            </Text>
          </View>
        </View>
      ) : null}

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

      {/* POPUP: Recompensa mensual (one-shot) */}
      <Modal
        visible={monthlyRewardVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthlyRewardVisible(false)}
      >
        <TouchableOpacity
          style={styles.monthlyRewardOverlay}
          activeOpacity={1}
          onPress={() => setMonthlyRewardVisible(false)}
        >
          <View style={styles.monthlyRewardCard}>
            <View style={styles.monthlyRewardHeader}>
              <View style={styles.monthlyRewardIcon}>
                <Ionicons name="trophy-outline" size={18} color={Colors.accentGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthlyRewardTitle}>RECOMPENSA MENSUAL</Text>
                <Text style={styles.monthlyRewardSubtitle}>
                  {monthlyRewardPeriodKey
                    ? `Predicciones ${monthlyRewardPeriodKey}`
                    : "Predicciones mensuales"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMonthlyRewardVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthlyRewardBody}>
              <Text style={styles.monthlyRewardAmount}>
                +{Math.max(0, monthlyRewardAmount)} TTP
              </Text>
              <Text style={styles.monthlyRewardBodyText}>
                Ya acreditamos tus TTP por las predicciones del mes anterior.
              </Text>
              {monthlyRewardMeta ? (
                <View style={styles.monthlyRewardBreakdown}>
                  {Number(monthlyRewardMeta.easyCorrect ?? 0) > 0 ? (
                    <View style={styles.monthlyRewardBreakdownRow}>
                      <Text style={styles.monthlyRewardBreakdownLabel}>
                        EASY · {Number(monthlyRewardMeta.easyCorrect)} acierto(s)
                      </Text>
                      <Text style={styles.monthlyRewardBreakdownValue}>
                        +{Number(monthlyRewardMeta.easyTtp ?? 0)} TTP
                      </Text>
                    </View>
                  ) : null}
                  {Number(monthlyRewardMeta.mediumCorrect ?? 0) > 0 ? (
                    <View style={styles.monthlyRewardBreakdownRow}>
                      <Text style={styles.monthlyRewardBreakdownLabel}>
                        MEDIUM · {Number(monthlyRewardMeta.mediumCorrect)} acierto(s)
                      </Text>
                      <Text style={styles.monthlyRewardBreakdownValue}>
                        +{Number(monthlyRewardMeta.mediumTtp ?? 0)} TTP
                      </Text>
                    </View>
                  ) : null}
                  {Number(monthlyRewardMeta.hardCorrect ?? 0) > 0 ? (
                    <View style={styles.monthlyRewardBreakdownRow}>
                      <Text style={styles.monthlyRewardBreakdownLabel}>
                        HARD · {Number(monthlyRewardMeta.hardCorrect)} acierto(s)
                      </Text>
                      <Text style={styles.monthlyRewardBreakdownValue}>
                        +{Number(monthlyRewardMeta.hardTtp ?? 0)} TTP
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.monthlyRewardCta}
              onPress={() => {
                setMonthlyRewardVisible(false);
                router.push({
                  pathname: "/(main)/league/predictions",
                  params: { leagueId },
                } as any);
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.monthlyRewardCtaText}>IR A PREDECIR ESTE MES</Text>
              <Ionicons name="chevron-forward" size={18} color="#111827" />
            </TouchableOpacity>
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
    minHeight: 152,
  },
  actionNowWrap: { marginBottom: 18 },
  actionNowHint: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: -4,
    marginBottom: 12,
    marginLeft: 5,
  },
  actionNowCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  actionNowBody: {
    padding: 16,
    minHeight: 150,
    justifyContent: "space-between",
  },
  actionNowEmptyBody: {
    justifyContent: "space-between",
  },
  actionNowEmptyTop: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  actionNowEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  actionNowEmptyTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  actionNowEmptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
  actionNowTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  actionNowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionNowTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  actionNowSubtitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 19,
  },
  actionNowDetail: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  actionNowPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  actionNowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    opacity: 0.7,
    marginBottom: 12,
  },
  actionNowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceElevated,
    maxWidth: "100%",
  },
  actionNowPillText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  actionNowPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionNowPrimaryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  actionNowSecondaryBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceElevated,
  },
  actionNowSecondaryText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
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
  squadAvatarSlot: {
    width: SQUAD_AVATAR_SIZE,
    height: SQUAD_AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  squadAvatarFrameOverlay: {
    position: "absolute",
    width: SQUAD_FRAME_OVERLAY_SIZE,
    height: SQUAD_FRAME_OVERLAY_SIZE,
    borderRadius: SQUAD_FRAME_OVERLAY_SIZE / 2,
    top: (SQUAD_AVATAR_SIZE - SQUAD_FRAME_OVERLAY_SIZE) / 2,
    left: (SQUAD_AVATAR_SIZE - SQUAD_FRAME_OVERLAY_SIZE) / 2,
  },
  squadAvatarBorderOverlay: {
    position: "absolute",
    width: SQUAD_AVATAR_SIZE,
    height: SQUAD_AVATAR_SIZE,
    borderRadius: SQUAD_AVATAR_SIZE / 2,
  },
  squadListContent: {
    paddingHorizontal: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: SQUAD_GAP,
  },
  squadItem: {
    alignItems: "center",
    justifyContent: "center",
    width: SQUAD_AVATAR_SIZE + 18,
    minHeight: SQUAD_FRAME_OVERLAY_SIZE + 22,
  },
  squadItemName: {
    marginTop: 11,
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 82,
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

  // --- POPUP RECOMPENSA MENSUAL (ONE-SHOT) ---
  monthlyRewardOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  monthlyRewardCard: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
  },
  monthlyRewardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  monthlyRewardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
  },
  monthlyRewardTitle: {
    color: Colors.accentGold,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  monthlyRewardSubtitle: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  monthlyRewardBody: {
    paddingVertical: 6,
    gap: 6,
    marginBottom: 12,
  },
  monthlyRewardBreakdown: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.10)",
    gap: 6,
  },
  monthlyRewardBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthlyRewardBreakdownLabel: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "700",
  },
  monthlyRewardBreakdownValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  monthlyRewardAmount: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  monthlyRewardBodyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  monthlyRewardCta: {
    backgroundColor: Colors.accentGold,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  monthlyRewardCtaText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
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
  leagueAvatarImage: { width: 44, height: 44, borderRadius: 22 },
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#0B1220",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  loadingTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  loadingSub: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
});
