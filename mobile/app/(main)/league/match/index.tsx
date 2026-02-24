import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter, useGlobalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { SafeAreaView } from "react-native-safe-area-context";
import apiClient from "../../../../src/api/apiClient";
import { useCurrentUser } from "../../../../src/hooks/useCurrentUser";
import { NextMatchCard } from "../../../../src/components/NextMatchCard";
import { NotificationBell } from "../../../../src/components/NotificationBell";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { EmptyState } from "../../../../src/components/ui/EmptyState";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { useCoachmark, useCoachmarkReady } from "../../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../../src/constants/CoachmarkKeys";
import { CoachmarkModal } from "../../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../../src/components/coachmark/CoachmarkHighlight";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as Clipboard from "expo-clipboard";

const THEME = {
  bg: Colors.background,
  cardBg: "#1F2937",
  cardBorder: "#374151",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  accentGold: "#F59E0B",
  accentGreen: "#10B981",
  accentBlue: Colors.primary,
  adminCardBg: "#3b3ea5",
};

export default function MatchScreen() {
  const router = useRouter();
  const { leagueId } = useGlobalSearchParams();
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();

  // LÓGICA DE ROLES
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [leagueData, setLeagueData] = useState<any>(null);
  const [adminMatches, setAdminMatches] = useState<any[]>([]);
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [votingMatches, setVotingMatches] = useState<any[]>([]);
  const [recentResultsMatches, setRecentResultsMatches] = useState<any[]>([]);

  const { shouldShow: showMatchCoachmark, markSeen: markMatchCoachmark } =
    useCoachmark(CoachmarkKeys.MATCH);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const canShowCoachmark = useCoachmarkReady(
    !loading && showMatchCoachmark && !dismissedThisSession,
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

  const MATCH_ADMIN_STEPS = useMemo(
    () => [
      {
        title: "Programar partido",
        body: "Acá podés crear y programar un partido: definí fecha, hora y convocá al equipo.",
      },
      {
        title: "Administrar partidos",
        body: "Acá se muestra el partido más próximo que tengas y los que hayas creado. Tocá uno para ver detalle o convocar.",
      },
    ],
    [],
  );
  const MATCH_MEMBER_STEPS = useMemo(
    () => [
      {
        title: "Tu próximo partido",
        body: "Acá se muestra el partido más próximo que tengas. Cuando un admin programe uno, aparecerá aquí.",
      },
    ],
    [],
  );
  const matchCoachmarkSteps = isAdmin ? MATCH_ADMIN_STEPS : MATCH_MEMBER_STEPS;

  const fetchData = async () => {
    try {
      if (!leagueId || !userId) return;

      // 1. OBTENER LIGA Y ROL (Inyectado por el back)
      const leagueRes = await apiClient.get(`/leagues/${leagueId}`);
      const data = leagueRes.data;
      setLeagueData(data);

      // LÓGICA: Solo ADMIN u OWNER pueden ver/uso Gestionar
      const role = (data.userRole || "").toString().toUpperCase();
      const userHasPower = role === "ADMIN" || role === "OWNER";
      setIsAdmin(userHasPower);
      setUserRole(role);

      // --- CARGA DE PARTIDOS ---
      if (userHasPower) {
        const allRes = await apiClient.get(`/match/${leagueId}/all`);
        const processedMatches = allRes.data.map((match: any) => {
          const myPlayerRecord = match.match_players?.find(
            (p: any) => String(p.user_id) === String(userId),
          );
          if (myPlayerRecord) {
            return {
              ...match,
              has_confirmed: myPlayerRecord.has_confirmed,
              user_status: myPlayerRecord.has_confirmed
                ? "CONFIRMED"
                : "PENDING",
            };
          }
          return match;
        });
        setAdminMatches(processedMatches);
      } else {
        const nextRes = await apiClient.get(`/match/${leagueId}/next`);
        setNextMatch(nextRes.data);
      }

      const [voteRes, resultsRes] = await Promise.all([
        apiClient.get(`/match/${leagueId}/voting`),
        apiClient.get(`/match/${leagueId}/recent-results`),
      ]);

      setVotingMatches(voteRes.data);
      setRecentResultsMatches(resultsRes.data);
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message ?? error?.response?.data?.error;
      if (status === 429) {
        showAlert(
          "Demasiadas peticiones",
          message || "Has hecho muchas peticiones. Espera un momento y desliza para actualizar.",
          [{ text: "Entendido" }]
        );
      }
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [leagueId, userId]),
  );

  const handleConfirm = async (matchId: string) => {
    const targetId = matchId || nextMatch?.id;
    try {
      await apiClient.post(`/match/${targetId}/confirm`, {});
      fetchData();
    } catch (error) {
      showAlert("Error", "No se pudo confirmar.");
    }
  };

  const handleCancel = async (matchId: string) => {
    showAlert("Cancelar Asistencia", "¿Seguro que quieres cancelar?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí",
        style: "destructive",
        onPress: async () => {
          const targetId = matchId || nextMatch?.id;
          try {
            await apiClient.post(`/match/${targetId}/unconfirm`, {});
            fetchData();
          } catch (e) {
            showAlert("Error", "No se pudo cancelar.");
          }
        },
      },
    ]);
  };

  const copyInviteCode = async () => {
    if (leagueData?.invite_code) {
      await Clipboard.setStringAsync(leagueData.invite_code);
      showAlert("Copiado", `Código ${leagueData.invite_code} copiado.`);
    }
  };

  const latestResultMatch =
    recentResultsMatches.length > 0 ? recentResultsMatches[0] : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      <ScreenHeader
        title={leagueData ? leagueData.name.toUpperCase() : "PARTIDOS"}
        showBack={false}
      />

      {canShowCoachmark && (
        <CoachmarkModal
          visible={true}
          steps={matchCoachmarkSteps}
          onFinish={() => {
            setDismissedThisSession(true);
            setCoachmarkStep(-1);
            setTargetFrame(null);
            markMatchCoachmark();
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchData}
            tintColor={THEME.accentBlue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.skeletonWrapper}>
            <Skeleton width="100%" height={420} borderRadius={20} style={{ alignSelf: "stretch" }} />
          </View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(320)}
            style={styles.contentAnimated}
          >
            {/* HERO SECTION ORIGINAL */}
            {isAdmin ? (
              <CoachmarkHighlight
                highlighted={canShowCoachmark && coachmarkStep === 0}
                style={{ marginBottom: 15 }}
                onMeasure={(frame) => coachmarkStep === 0 && setTargetFrame(frame)}
              >
                <TouchableOpacity
                  style={styles.heroCardAdmin}
                  onPress={() => router.push("/(main)/league/match/create")}
                  activeOpacity={0.9}
                  testID="e2e-match-index-programar"
                >
                  <View style={styles.heroContent}>
                    <View style={styles.adminIconBox}>
                      <Ionicons name="add" size={32} color={THEME.accentBlue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.heroTitle, { color: THEME.accentBlue }]}
                      >
                        PROGRAMAR PARTIDO
                      </Text>
                      <Text style={styles.heroSubtitle}>
                        Define fecha, hora y convoca al equipo.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color={THEME.textSecondary}
                    />
                  </View>
                  <Ionicons
                    name="calendar"
                    size={120}
                    color={THEME.accentBlue}
                    style={styles.adminWatermark}
                  />
                </TouchableOpacity>
              </CoachmarkHighlight>
            ) : (
              <View style={styles.heroCardMember}>
                <View style={styles.leagueInfoContent}>
                  <View style={styles.leagueAvatar}>
                    <Text style={styles.leagueAvatarText}>
                      {leagueData?.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leagueName}>{leagueData?.name}</Text>
                    <View style={styles.statsRow}>
                      <Ionicons
                        name="people"
                        size={14}
                        color={THEME.textSecondary}
                      />
                      <Text style={styles.statsText}>
                        Invita a tus compañeros
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={copyInviteCode}
                  >
                    <Ionicons
                      name="share-social"
                      size={20}
                      color={THEME.accentBlue}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* SECCIONES DE ACCIÓN */}
            {latestResultMatch && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderBox}>
                  <Text
                    style={[styles.sectionHeader, { color: THEME.accentGreen }]}
                  >
                    RESULTADOS DISPONIBLES
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionCard,
                    {
                      borderColor: THEME.accentGreen,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                    },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/league/match/results",
                      params: { matchId: latestResultMatch.id },
                    })
                  }
                >
                  <View style={styles.cardContent}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.cardTitle, { color: THEME.accentGreen }]}
                      >
                        VER RESULTADOS
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {latestResultMatch.location_name} •{" "}
                        {format(
                          new Date(latestResultMatch.date_time),
                          "d MMM",
                          { locale: es },
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: "rgba(16, 185, 129, 0.2)" },
                      ]}
                    >
                      <Ionicons
                        name="stats-chart"
                        size={24}
                        color={THEME.accentGreen}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {votingMatches.map((match) => (
              <View key={match.id} style={styles.sectionContainer}>
                <View style={styles.sectionHeaderBox}>
                  <Text
                    style={[styles.sectionHeader, { color: THEME.accentGold }]}
                  >
                    PARTIDO TERMINADO
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionCard,
                    {
                      borderColor: THEME.accentGold,
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                    },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/league/match/vote",
                      params: { matchId: match.id },
                    })
                  }
                >
                  <View style={styles.cardContent}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.cardTitle, { color: THEME.accentGold }]}
                      >
                        MANDA TUS VOTOS
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {match.location_name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: "rgba(245, 158, 11, 0.2)" },
                      ]}
                    >
                      <Ionicons
                        name="star"
                        size={24}
                        color={THEME.accentGold}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            <CoachmarkHighlight
              highlighted={
                canShowCoachmark &&
                (isAdmin ? coachmarkStep === 1 : coachmarkStep === 0)
              }
              style={{ marginBottom: 8 }}
              onMeasure={(frame) =>
                (isAdmin ? coachmarkStep === 1 : coachmarkStep === 0) &&
                setTargetFrame(frame)
              }
            >
              <View style={styles.sectionHeaderBox}>
                <Text style={styles.sectionHeader}>
                  {isAdmin ? "ADMINISTRAR PARTIDOS" : "TU PRÓXIMO PARTIDO"}
                </Text>
              </View>

              {isAdmin ? (
                adminMatches.length > 0 ? (
                  adminMatches.map((match) => (
                    <View key={match.id} style={{ marginBottom: 15 }}>
                      <NextMatchCard
                        match={match}
                        isAdmin={true}
                        userRole={userRole}
                        onConfirm={() => handleConfirm(match.id)}
                        onCancel={() => handleCancel(match.id)}
                        onEdit={() =>
                          router.push({
                            pathname: `/(main)/league/match/${match.id}`,
                            params: { userRole },
                          })
                        }
                      />
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No hay partidos programados"
                    message="Crea el primer partido de la liga y convoca a tu equipo."
                    iconName="calendar"
                    actionLabel="Crear Partido"
                    onAction={() =>
                      router.push({
                        pathname: "/(main)/league/match/create",
                        params: { leagueId },
                      })
                    }
                  />
                )
              ) : nextMatch ? (
                <NextMatchCard
                  match={nextMatch}
                  isAdmin={false}
                  onConfirm={() => handleConfirm(nextMatch.id)}
                  onCancel={() => handleCancel(nextMatch.id)}
                />
              ) : (
                <EmptyState
                  title="Esperando convocatoria"
                  message="Aún no hay partidos para este periodo. Cuando un admin programe uno, aparecerá aquí."
                  iconName="calendar"
                />
              )}
            </CoachmarkHighlight>
          </Animated.View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.white,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  headerRight: { flexDirection: "row" },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  skeletonWrapper: { paddingHorizontal: 20 },
  contentAnimated: {},

  heroCardAdmin: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    minHeight: 100,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: THEME.accentBlue,
    shadowColor: THEME.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    position: "relative",
    zIndex: 10,
  },
  adminIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  heroSubtitle: { color: THEME.textSecondary, fontSize: 12 },
  adminWatermark: {
    position: "absolute",
    right: -30,
    bottom: -30,
    opacity: 0.05,
    transform: [{ rotate: "-15deg" }],
  },

  heroCardMember: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  leagueInfoContent: { flexDirection: "row", alignItems: "center", gap: 15 },
  leagueAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  leagueAvatarText: { color: "white", fontSize: 20, fontWeight: "900" },
  leagueName: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsText: { color: THEME.textSecondary, fontSize: 12 },
  inviteButton: {
    padding: 10,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },

  sectionContainer: { marginBottom: 20 },
  sectionHeaderBox: { marginBottom: 12, marginTop: 10 },
  sectionHeader: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  actionCard: {
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 2,
  },
  cardSubtitle: { color: THEME.textSecondary, fontSize: 12 },
});
