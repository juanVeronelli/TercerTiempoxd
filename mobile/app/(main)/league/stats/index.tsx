import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  Share,
} from "react-native";
import { useRouter, useGlobalSearchParams, useFocusEffect } from "expo-router";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { NotificationBell } from "../../../../src/components/NotificationBell";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { EmptyState } from "../../../../src/components/ui/EmptyState";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { NativeAdCardWrapper } from "../../../../src/components/ads/NativeAdCardWrapper";
import apiClient from "../../../../src/api/apiClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCoachmark, useCoachmarkReady } from "../../../../src/hooks/useCoachmark";
import { CoachmarkKeys } from "../../../../src/constants/CoachmarkKeys";
import { CoachmarkModal } from "../../../../src/components/coachmark/CoachmarkModal";
import { CoachmarkHighlight } from "../../../../src/components/coachmark/CoachmarkHighlight";
import Svg, {
  Polygon,
  Line,
  Text as SvgText,
  Circle,
  Polyline,
} from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Color dorado para acentos PRO
const PRO_GOLD = "#D4AF37";

const STATS_COACHMARK_STEPS = [
  {
    title: "Tu racha",
    body: "Acá ves tu racha: G (ganado), P (perdido), E (empatado). Son los últimos partidos que jugaste.",
  },
  {
    title: "Promedios",
    body: "Tu promedio histórico y el del mes. Compará cómo venís en el tiempo.",
  },
  {
    title: "Historial reciente",
    body: "Tocá cualquier partido para ver el detalle. Si tenés PRO, más abajo ves gráficos de tendencia y perfil técnico vs la liga.",
  },
];

// --- Gráfico de tendencia PRO (diseño limpio) ---
const CHART_PADDING = { left: 24, right: 12, top: 8, bottom: 20 };
const TREND_H = 120;
const TREND_W = SCREEN_WIDTH - 72;

const TrendChartPro = ({
  matches,
  leagueAvg,
}: {
  matches: any[];
  leagueAvg: number;
}) => {
  const w = TREND_W - CHART_PADDING.left - CHART_PADDING.right;
  const h = TREND_H - CHART_PADDING.top - CHART_PADDING.bottom;

  if (matches.length < 2) {
    return (
      <View style={styles.trendEmpty}>
        <Ionicons name="analytics-outline" size={28} color="#64748B" />
        <Text style={styles.trendEmptyText}>Mínimo 2 partidos para ver evolución</Text>
      </View>
    );
  }

  const getX = (i: number) =>
    CHART_PADDING.left + (i / Math.max(1, matches.length - 1)) * w;
  const getY = (val: number) =>
    CHART_PADDING.top + h - (Number(val) / 10) * h;
  const points = matches
    .map((m, i) => `${getX(i)},${getY(Number(m.rating))}`)
    .join(" ");
  const areaPoints = [
    `${CHART_PADDING.left},${CHART_PADDING.top + h}`,
    ...matches.map((m, i) => `${getX(i)},${getY(Number(m.rating))}`),
    `${CHART_PADDING.left + w},${CHART_PADDING.top + h}`,
    `${CHART_PADDING.left},${CHART_PADDING.top + h}`,
  ].join(" ");
  const leagueY = getY(leagueAvg);

  return (
    <View style={styles.trendChartOuter}>
      <Svg width={TREND_W} height={TREND_H + 16}>
        <Polygon points={areaPoints} fill="rgba(212, 175, 55, 0.08)" stroke="none" />
        <Line
          x1={CHART_PADDING.left}
          y1={leagueY}
          x2={CHART_PADDING.left + w}
          y2={leagueY}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="5 4"
        />
        <Polyline
          points={points}
          fill="none"
          stroke={PRO_GOLD}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {matches.map((m, i) => (
          <Circle
            key={i}
            cx={getX(i)}
            cy={getY(Number(m.rating))}
            r="4"
            fill="#0F172A"
            stroke={PRO_GOLD}
            strokeWidth="1.5"
          />
        ))}
      </Svg>
      <View style={styles.trendLegend}>
        <View style={styles.trendLegendItem}>
          <View style={[styles.trendLegendDot, { backgroundColor: PRO_GOLD }]} />
          <Text style={styles.trendLegendText}>Tu nota</Text>
        </View>
        <View style={styles.trendLegendItem}>
          <View style={[styles.trendLegendLine]} />
          <Text style={styles.trendLegendText}>Liga {leagueAvg.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
};

// --- Radar PRO (spider limpio) ---
const RADAR_SIZE = 160;
const RadarChart = ({
  userData,
  leagueData,
}: {
  userData: any;
  leagueData: any;
}) => {
  const center = RADAR_SIZE / 2;
  const radius = RADAR_SIZE * 0.36;
  const labels = ["RIT", "DEF", "TEC", "FIS", "ATA"];
  const keys = ["pace", "defense", "technique", "physical", "attack"];
  const getPoints = (data: any) =>
    keys
      .map((key, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        const value = (Number(data?.[key]) || 0) / 10;
        return `${center + radius * value * Math.cos(angle)},${center + radius * value * Math.sin(angle)}`;
      })
      .join(" ");

  return (
    <View style={styles.radarWrap}>
      <Svg height={RADAR_SIZE} width={RADAR_SIZE}>
        {[0.25, 0.5, 0.75, 1].map((r, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius * r}
            fill="none"
            stroke="#2D3A4A"
            strokeWidth="1"
          />
        ))}
        {keys.map((_, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          return (
            <React.Fragment key={i}>
              <Line
                x1={center}
                y1={center}
                x2={center + radius * Math.cos(angle)}
                y2={center + radius * Math.sin(angle)}
                stroke="#2D3A4A"
                strokeWidth="1"
              />
              <SvgText
                x={center + (radius + 18) * Math.cos(angle)}
                y={center + (radius + 12) * Math.sin(angle)}
                fill="#64748B"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
              >
                {labels[i]}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Polygon
          points={getPoints(leagueData)}
          fill="rgba(100, 116, 139, 0.12)"
          stroke="#64748B"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <Polygon
          points={getPoints(userData)}
          fill="rgba(212, 175, 55, 0.2)"
          stroke={PRO_GOLD}
          strokeWidth="2"
        />
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PRO_GOLD }]} />
          <Text style={styles.legendText}>Tú</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#64748B" }]} />
          <Text style={styles.legendText}>Liga</Text>
        </View>
      </View>
    </View>
  );
};

export default function MyStatsScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const { showAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leagueName, setLeagueName] = useState<string>("");

  const fetchData = async () => {
    try {
      if (!leagueId) return;
      const [sRes, uRes] = await Promise.all([
        apiClient.get(`/leagues/${leagueId}/my-stats`),
        apiClient.get("/auth/me"),
      ]);
      setStats(sRes.data);
      setUserData(uRes.data.user);
      const leagues = uRes.data?.leagues ?? [];
      const currentLeague = leagues.find((l: any) => l.id === leagueId);
      setLeagueName(currentLeague?.name ?? "");
      setIsAdmin(
        currentLeague?.role === "ADMIN" || currentLeague?.role === "OWNER"
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [leagueId]),
  );

  const isPro = userData?.planType !== "FREE";
  const averages = stats?.averages || {
    pace: 0,
    defense: 0,
    technique: 0,
    physical: 0,
    attack: 0,
  };
  const leagueAvg = stats?.leagueAverages || {
    pace: 0,
    defense: 0,
    technique: 0,
    physical: 0,
    attack: 0,
    rating: 6,
  };
  const matchesToShow = useMemo(() => {
    const list = stats?.recentMatches || [];
    const reversedList = [...list].reverse();
    return reversedList.slice(0, 5);
  }, [stats]);

  const matches = stats?.recentMatches ?? [];
  const isStatsLocked = matches.length === 0;
  const { shouldShow: showStatsCoachmark, markSeen: markStatsCoachmark } =
    useCoachmark(CoachmarkKeys.STATS);
  const [coachmarkStep, setCoachmarkStep] = useState(-1);
  const [targetFrame, setTargetFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const canShowCoachmark = useCoachmarkReady(
    showStatsCoachmark && !dismissedThisSession,
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

  if (loading)
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.header}>
          <Skeleton width="100%" height={56} borderRadius={12} style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Skeleton width="100%" height={400} borderRadius={20} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    );

  if (isStatsLocked) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScreenHeader title="MI RENDIMIENTO" showBack={false} />
        <View style={styles.softLockContainer}>
          <EmptyState
            title="Sin estadísticas aún"
            message="Juega tu primer partido en cancha (fútbol real) para desbloquear tus tarjetas de rendimiento y evolución."
            iconName="activity"
            actionLabel={isAdmin ? "Crear Partido" : undefined}
            onAction={
              isAdmin && leagueId
                ? () =>
                    router.push({
                      pathname: "/(main)/league/match/create",
                      params: { leagueId },
                    })
                : undefined
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScreenHeader title="MI RENDIMIENTO" showBack={false} />
      {canShowCoachmark && (
        <CoachmarkModal
          visible={true}
          steps={STATS_COACHMARK_STEPS}
          onFinish={() => {
            setDismissedThisSession(true);
            setCoachmarkStep(-1);
            setTargetFrame(null);
            markStatsCoachmark();
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.subtitleBlock}>
          <Text style={styles.subtitle} numberOfLines={2}>
            {leagueName
              ? `Tus estadísticas personales en todos los partidos de ${leagueName}`
              : "Tus estadísticas personales en todos los partidos"}
          </Text>
        </View>

        {/* KPIS */}
        <CoachmarkHighlight
          highlighted={canShowCoachmark && coachmarkStep === 1}
          style={{ marginBottom: 16 }}
          onMeasure={(frame) => coachmarkStep === 1 && setTargetFrame(frame)}
        >
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabelAbove}>Promedio Histórico</Text>
              <View style={styles.kpiHeader}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={styles.kpiLabel}>HISTÓRICO</Text>
              </View>
              <Text style={styles.kpiValueMain}>
                {stats?.historicalAvg || "0.0"}
              </Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: Colors.primary }]}>
              <Text style={[styles.kpiLabelAbove, { color: Colors.primary }]}>
                Promedio del Mes
              </Text>
              <View style={styles.kpiHeader}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={Colors.primary}
                />
                <Text style={[styles.kpiLabel, { color: Colors.primary }]}>
                  ESTE MES
                </Text>
              </View>
              <Text style={[styles.kpiValueMain, { color: Colors.primary }]}>
                {stats?.monthAvg || "0.0"}
              </Text>
            </View>
          </View>
        </CoachmarkHighlight>

        {/* RACHA: G (Ganado), P (Perdido), E (Empatado) + Últimos N partidos */}
        {stats?.form && stats.form.length > 0 && (
          <CoachmarkHighlight
            highlighted={canShowCoachmark && coachmarkStep === 0}
            style={{ marginBottom: 20 }}
            onMeasure={(frame) => coachmarkStep === 0 && setTargetFrame(frame)}
          >
            <View style={styles.formContainer}>
              <Text style={styles.sectionHeader}>RACHA ACTUAL</Text>
              <View style={styles.formBubbles}>
                {stats.form.map((res: string, i: number) => {
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
                })}
              </View>
              <Text style={styles.formHint}>
                Últimos {stats.form.length} partido{stats.form.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </CoachmarkHighlight>
        )}

        {/* HISTORIAL */}
        <CoachmarkHighlight
          highlighted={canShowCoachmark && coachmarkStep === 2}
          style={{ marginBottom: 8 }}
          onMeasure={(frame) => coachmarkStep === 2 && setTargetFrame(frame)}
        >
          <View style={styles.sectionHeaderBox}>
            <Text style={styles.sectionHeader}>HISTORIAL RECIENTE</Text>
          </View>
          {matchesToShow.length > 0 ? (
          matchesToShow.map((stat: any, i: number) => {
            const matchDate = new Date(stat.matches.date_time);
            const today = new Date();
            const isToday =
              matchDate.getDate() === today.getDate() &&
              matchDate.getMonth() === today.getMonth() &&
              matchDate.getFullYear() === today.getFullYear();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday =
              matchDate.getDate() === yesterday.getDate() &&
              matchDate.getMonth() === yesterday.getMonth() &&
              matchDate.getFullYear() === yesterday.getFullYear();
            const dateLabel = isToday
              ? "Hoy"
              : isYesterday
                ? "Ayer"
                : format(matchDate, "dd/MM", { locale: es });
            const ratingNum = Number(stat.rating);
            const ratingTier =
              ratingNum >= 8 ? "green" : ratingNum >= 6 ? "yellow" : "red";
            return (
              <TouchableOpacity
                key={i}
                style={styles.matchCard}
                onPress={() =>
                  router.push({
                    pathname: "/(main)/league/match/results",
                    params: { matchId: stat.matches.id, returnTo: "stats" },
                  })
                }
                activeOpacity={0.85}
              >
                <View style={styles.matchCardAccent} />
                <View style={styles.matchCardBody}>
                  <View style={styles.matchCardMain}>
                    <View style={styles.matchCardMeta}>
                      <Text style={styles.matchCardDate}>
                        {format(matchDate, "dd MMM", { locale: es })}
                      </Text>
                      <View style={styles.matchCardPill}>
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.matchCardPillText}>
                          Jugado · {dateLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.matchCardLocationRow}>
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color="#9CA3AF"
                        style={styles.matchCardLocationIcon}
                      />
                      <Text
                        style={styles.matchCardLocation}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {stat.matches.location_name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.matchCardRight}>
                    <View
                      style={[
                        styles.matchCardRatingPill,
                        ratingTier === "green"
                          ? styles.ratingPillGreen
                          : ratingTier === "yellow"
                            ? styles.ratingPillYellow
                            : styles.ratingPillRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchCardRatingText,
                          ratingTier === "green"
                            ? styles.ratingTextGreen
                            : ratingTier === "yellow"
                              ? styles.ratingTextYellow
                              : styles.ratingTextRed,
                        ]}
                      >
                        {stat.rating}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#4B5563"
                      style={styles.matchCardChevron}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <EmptyState
            title="No hay partidos recientes"
            message="Juega partidos para ver tu historial y estadísticas aquí."
            iconName="activity"
          />
        )}
        </CoachmarkHighlight>

        <NativeAdCardWrapper
          style={{ marginTop: 20, marginBottom: 20 }}
          isPro={isPro}
        />

        {/* --- Widget Análisis PRO (diseño unificado) --- */}
        <View style={styles.proWidget}>
          <View style={styles.proWidgetHeader}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <Text style={styles.proWidgetTitle}>Análisis avanzado</Text>
          </View>

          {isPro ? (
            <View style={styles.proWidgetBody}>
              <View style={styles.proMetrics}>
                <View style={styles.proMetricCol}>
                  <Text style={styles.proMetricValue}>{stats?.historicalAvg ?? "—"}</Text>
                  <Text style={styles.proMetricLabel}>Tu promedio</Text>
                </View>
                <View style={styles.proMetricDivider} />
                <View style={styles.proMetricCol}>
                  <Text style={[styles.proMetricValue, styles.proMetricHighlight]}>
                    {Number(leagueAvg.rating ?? 0).toFixed(1)}
                  </Text>
                  <Text style={styles.proMetricLabel}>Liga</Text>
                </View>
                <View style={styles.proMetricDivider} />
                <View style={styles.proMetricCol}>
                  <Text style={styles.proMetricValue}>{matches.length}</Text>
                  <Text style={styles.proMetricLabel}>Partidos</Text>
                </View>
              </View>

              <View style={styles.proDivider} />

              <Text style={styles.proSectionLabel}>Evolución</Text>
              <TrendChartPro
                matches={[...(stats?.recentMatches ?? [])].reverse().slice(0, 10)}
                leagueAvg={Number(leagueAvg.rating ?? 6)}
              />

              <View style={styles.proDivider} />

              <Text style={styles.proSectionLabel}>Perfil técnico</Text>
              <RadarChart userData={averages} leagueData={leagueAvg} />
              <View style={styles.proStatStrip}>
                {[
                  { key: "pace", label: "RIT" },
                  { key: "defense", label: "DEF" },
                  { key: "technique", label: "TEC" },
                  { key: "physical", label: "FIS" },
                  { key: "attack", label: "ATA" },
                ].map(({ key, label }, i) => (
                  <Text key={i} style={styles.proStatStripItem}>
                    <Text style={styles.proStatStripLabel}>{label} </Text>
                    <Text style={styles.proStatStripValue}>
                      {Number(averages[key as keyof typeof averages]).toFixed(1)}
                    </Text>
                  </Text>
                ))}
              </View>

              {(() => {
                const dims = [
                  { key: "pace", label: "Ritmo" },
                  { key: "defense", label: "Defensa" },
                  { key: "technique", label: "Técnica" },
                  { key: "physical", label: "Físico" },
                  { key: "attack", label: "Ataque" },
                ] as const;
                const above = dims.filter(
                  (d) => Number(averages[d.key]) > Number(leagueAvg[d.key])
                );
                const below = dims.filter(
                  (d) => Number(averages[d.key]) < Number(leagueAvg[d.key])
                );
                if (above.length === 0 && below.length === 0) return null;
                return (
                  <>
                    <View style={styles.proDivider} />
                    <Text style={styles.proSectionLabel}>Resumen vs liga</Text>
                    <View style={styles.proInsightsStrip}>
                      {above.length > 0 && (
                        <View style={styles.proInsightChip}>
                          <Ionicons name="arrow-up" size={12} color="#22C55E" />
                          <Text style={styles.proInsightChipText}>
                            {above.map((d) => d.label).join(", ")}
                          </Text>
                        </View>
                      )}
                      {below.length > 0 && (
                        <View style={[styles.proInsightChip, styles.proInsightChipAlt]}>
                          <Ionicons name="arrow-down" size={12} color="#F59E0B" />
                          <Text style={styles.proInsightChipText}>
                            {below.map((d) => d.label).join(", ")}
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                );
              })()}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.proUnlock}
              activeOpacity={0.9}
              onPress={() =>
                showAlert(
                  "Plan PRO",
                  "Desbloquea evolución, perfil técnico vs liga e insights.",
                )
              }
            >
              <MaterialCommunityIcons name="chart-box-outline" size={36} color={PRO_GOLD} />
              <View style={styles.proUnlockText}>
                <Text style={styles.proUnlockTitle}>Análisis avanzado</Text>
                <Text style={styles.proUnlockDesc}>
                  Evolución, perfil técnico e insights vs tu liga
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  softLockContainer: {
    flex: 1,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "white",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  content: { paddingHorizontal: 20 },
  subtitleBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },

  kpiContainer: { flexDirection: "row", justifyContent: "space-between" },
  kpiCard: {
    width: "48%",
    backgroundColor: "#1F2937",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
    height: 100,
  },
  kpiLabelAbove: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 5,
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 10, fontWeight: "800" },
  kpiValueMain: { color: "white", fontSize: 32, fontWeight: "900" },
  sectionHeaderBox: { marginBottom: 12, marginTop: 25 },
  sectionHeader: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  formContainer: { marginTop: 25, alignItems: "center" },
  formBubbles: { flexDirection: "row", gap: 10, marginTop: 10 },
  formHint: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 8,
  },
  formBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  formText: { fontSize: 12, fontWeight: "900" },
  matchCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
    position: "relative",
    overflow: "hidden",
  },
  matchCardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  matchCardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 20,
  },
  matchCardMain: { flex: 1, minWidth: 0 },
  matchCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  matchCardDate: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
  },
  matchCardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  matchCardPillText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
  },
  matchCardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  matchCardLocationIcon: { marginRight: 6 },
  matchCardLocation: {
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  matchCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  matchCardRatingPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  matchCardRatingText: { fontSize: 16, fontWeight: "900" },
  matchCardChevron: { opacity: 0.8 },
  ratingPillGreen: { backgroundColor: "rgba(16, 185, 129, 0.2)" },
  ratingTextGreen: { color: "#10B981" },
  ratingPillYellow: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  ratingTextYellow: { color: "#F59E0B" },
  ratingPillRed: { backgroundColor: "rgba(239, 68, 68, 0.2)" },
  ratingTextRed: { color: "#EF4444" },
  chartCard: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
  },
  chartTitle: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "900",
    alignSelf: "flex-start",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  chartWrapper: { marginTop: 5 },
  radarContainer: { alignItems: "center", justifyContent: "center" },
  legendRow: { flexDirection: "row", gap: 20, marginTop: 15 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: "#9CA3AF", fontSize: 10, fontWeight: "900" },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  statLabelItem: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  statLabelText: { color: "#9CA3AF", fontSize: 9, fontWeight: "800" },
  statValueText: { color: Colors.primary, fontWeight: "900" },

  // --- Widget PRO (diseño unificado) ---
  proWidget: {
    marginTop: 16,
    marginBottom: 32,
    marginHorizontal: 4,
    backgroundColor: "#131B28",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  proWidgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  proBadge: {
    backgroundColor: PRO_GOLD,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  proWidgetTitle: {
    color: "#F1F5F9",
    fontSize: 16,
    fontWeight: "700",
  },
  proWidgetBody: {
    padding: 16,
  },
  proMetrics: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  proMetricValue: {
    color: "#E2E8F0",
    fontSize: 22,
    fontWeight: "800",
  },
  proMetricLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  proMetricCol: { alignItems: "center", flex: 1 },
  proMetricHighlight: { color: PRO_GOLD },
  proMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#1E293B",
    borderRadius: 1,
  },
  proDivider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginVertical: 16,
  },
  proSectionLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  trendChartOuter: {
    width: "100%",
    alignItems: "center",
  },
  trendLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 10,
  },
  trendLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trendLegendLine: {
    width: 14,
    height: 2,
    backgroundColor: "#475569",
    borderRadius: 1,
  },
  trendLegendText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  trendEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  trendEmptyText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
  },
  radarWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  proStatStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  proStatStripItem: { fontSize: 12 },
  proStatStripLabel: { color: "#64748B", fontWeight: "600" },
  proStatStripValue: { color: PRO_GOLD, fontWeight: "800" },
  proInsightsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  proInsightChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  proInsightChipAlt: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  proInsightChipText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  proUnlock: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
  },
  proUnlockText: { flex: 1 },
  proUnlockTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  proUnlockDesc: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  viewCardBtn: {
    backgroundColor: PRO_GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: PRO_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  viewCardText: {
    color: "#1C1C1C",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.9,
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 25,
    alignItems: "center",
  },
  modalTitle: {
    color: PRO_GOLD,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  shareBtn: {
    backgroundColor: PRO_GOLD,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
    marginTop: 25,
  },
  shareBtnText: {
    color: "#1C1C1C",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1,
  },
  emptyContainer: { alignItems: "center", marginVertical: 20 },
  emptyText: { color: "#6B7280", fontStyle: "italic", fontSize: 12 },
  bgW: { backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981" },
  textW: { color: "#10B981" },
  bgL: { backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "#EF4444" },
  textL: { color: "#EF4444" },
  bgD: { backgroundColor: "rgba(148, 163, 184, 0.1)", borderColor: "#94A3B8" },
  textD: { color: "#94A3B8" },
  bgGreen: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  textGreen: { color: "#10B981" },
  bgYellow: { backgroundColor: "rgba(245, 158, 11, 0.15)" },
  textYellow: { color: "#F59E0B" },
  bgRed: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  textRed: { color: "#EF4444" },
});
