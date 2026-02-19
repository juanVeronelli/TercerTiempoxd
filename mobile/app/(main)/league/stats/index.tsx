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
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { NativeAdCardWrapper } from "../../../../src/components/ads/NativeAdCardWrapper";
import apiClient from "../../../../src/api/apiClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

// --- UTILS ---
const getPositionAbbr = (pos: string) => {
  if (!pos) return "N/A";
  // Mapeo directo a inglés como solicitado, o usa las primeras 3 letras si no encuentra coincidencia
  const map: Record<string, string> = {
    GK: "GK",
    DEF: "DEF",
    MID: "MID",
    FWD: "FWD",
    PORTERO: "GK",
    DEFENSA: "DEF",
    MEDIO: "MID",
    DELANTERO: "FWD",
  };
  return map[pos.toUpperCase()] || pos.substring(0, 3).toUpperCase();
};

// --- COMPONENTE: NUEVA CARTA PRO (Diseño Limpio y Orgánico) ---
const ProPlayerCard = ({
  user,
  averages,
  rating,
}: {
  user: any;
  averages: any;
  rating: string;
}) => {
  // Convertimos escala 0-10 a 0-99
  const getStat = (val: number) =>
    Math.min(99, Math.round((Number(val) || 5) * 10));
  const overall = Math.round(Number(rating) * 10) || 75;
  const position = getPositionAbbr(user?.mainPosition);

  const StatBox = ({ label, value }: { label: string; value: number }) => (
    <View style={styles.proStatBox}>
      <Text style={styles.proStatValue}>{value}</Text>
      <Text style={styles.proStatLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.proCard}>
        {/* Cabecera con Foto y Rating (Sin marca de agua) */}
        <View style={styles.cardHeader}>
          <View style={styles.photoRingContainer}>
            <UserAvatar
              imageUrl={user?.photo}
              name={user?.fullName || user?.username || "Jugador"}
              size={150}
            />
          </View>
          {/* Insignia superpuesta organicamente */}
          <View style={styles.ratingInsignia}>
            <Text style={styles.insigniaValue}>{overall}</Text>
            <View style={styles.insigniaSeparator} />
            <Text style={styles.insigniaPos}>{position}</Text>
          </View>
        </View>

        {/* Nombre del Jugador */}
        <View style={styles.nameContainer}>
          <Text style={styles.proName} numberOfLines={1} ellipsizeMode="tail">
            {user?.fullName?.toUpperCase() ||
              user?.username?.toUpperCase() ||
              "PRO PLAYER"}
          </Text>
        </View>

        {/* Grilla de Stats Limpia */}
        <View style={styles.proStatsGrid}>
          <StatBox label="RIT" value={getStat(averages.pace)} />
          <StatBox label="TIR" value={getStat(averages.attack)} />
          <StatBox label="PAS" value={getStat(averages.technique)} />
          <StatBox label="REG" value={getStat(averages.technique)} />
          <StatBox label="DEF" value={getStat(averages.defense)} />
          <StatBox label="FIS" value={getStat(averages.physical)} />
        </View>
      </View>
    </View>
  );
};

// --- GRÁFICO TENDENCIA ---
const TrendChart = ({
  matches,
  leagueAvg,
}: {
  matches: any[];
  leagueAvg: number;
}) => {
  const h = 80;
  const w = SCREEN_WIDTH - 80;
  if (matches.length < 2)
    return <Text style={styles.emptyText}>Necesitas jugar más partidos</Text>;

  const getX = (i: number) => (i / (matches.length - 1)) * w;
  const getY = (val: number) => h - (val / 10) * h;
  const points = matches
    .map((m, i) => `${getX(i)},${getY(Number(m.rating))}`)
    .join(" ");
  const leagueY = getY(leagueAvg);

  return (
    <View style={styles.chartWrapper}>
      <Svg height={h + 25} width={w}>
        <Line
          x1="0"
          y1={leagueY}
          x2={w}
          y2={leagueY}
          stroke="#4B5563"
          strokeWidth="1"
          strokeDasharray="4"
        />
        <SvgText
          x={0}
          y={leagueY - 6}
          fill="#6B7280"
          fontSize="8"
          fontWeight="bold"
        >
          LIGA ({leagueAvg})
        </SvgText>
        <Polyline
          points={points}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="3"
        />
        {matches.map((m, i) => (
          <React.Fragment key={i}>
            <Circle
              cx={getX(i)}
              cy={getY(Number(m.rating))}
              r="4"
              fill={Colors.primary}
            />
            <SvgText
              x={getX(i)}
              y={getY(Number(m.rating)) - 12}
              fill="white"
              fontSize="10"
              fontWeight="900"
              textAnchor="middle"
            >
              {m.rating}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

// --- GRÁFICO RADAR ---
const RadarChart = ({
  userData,
  leagueData,
}: {
  userData: any;
  leagueData: any;
}) => {
  const size = 180;
  const center = size / 2;
  const radius = size * 0.35;
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
    <View style={styles.radarContainer}>
      <Svg height={size} width={size}>
        {[0.2, 0.4, 0.6, 0.8, 1].map((r, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius * r}
            fill="none"
            stroke="#334155"
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
                stroke="#334155"
                strokeWidth="1"
              />
              <SvgText
                x={center + (radius + 20) * Math.cos(angle)}
                y={center + (radius + 15) * Math.sin(angle)}
                fill="#9CA3AF"
                fontSize="9"
                fontWeight="900"
                textAnchor="middle"
              >
                {labels[i]}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Polygon
          points={getPoints(leagueData)}
          fill="rgba(148, 163, 184, 0.1)"
          stroke="#64748B"
          strokeWidth="1"
          strokeDasharray="3"
        />
        <Polygon
          points={getPoints(userData)}
          fill={`${Colors.primary}40`}
          stroke={Colors.primary}
          strokeWidth="2"
        />
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: Colors.primary }]}
          />
          <Text style={styles.legendText}>TÚ</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#64748B" }]} />
          <Text style={styles.legendText}>LIGA</Text>
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
        <ScreenHeader title="MI RENDIMIENTO" showBack />
        <View style={styles.softLockContainer}>
          <EmptyState
            title="Sin estadísticas aún"
            message="Juega tu primer partido para desbloquear tus tarjetas de rendimiento y evolución."
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
      <ScreenHeader title="MI RENDIMIENTO" showBack />

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
        {/* KPIS */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="time-outline" size={14} color="#9CA3AF" />
              <Text style={styles.kpiLabel}>HISTÓRICO</Text>
            </View>
            <Text style={styles.kpiValueMain}>
              {stats?.historicalAvg || "0.0"}
            </Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: Colors.primary }]}>
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

        {/* RACHA */}
        {stats?.form && stats.form.length > 0 && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionHeader}>RACHA ACTUAL</Text>
            <View style={styles.formBubbles}>
              {stats.form.map((res: string, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.formBubble,
                    res === "W"
                      ? styles.bgW
                      : res === "L"
                        ? styles.bgL
                        : styles.bgD,
                  ]}
                >
                  <Text
                    style={[
                      styles.formText,
                      res === "W"
                        ? styles.textW
                        : res === "L"
                          ? styles.textL
                          : styles.textD,
                    ]}
                  >
                    {res === "W" ? "V" : res === "L" ? "D" : "E"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* HISTORIAL */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>HISTORIAL RECIENTE</Text>
        </View>
        {matchesToShow.length > 0 ? (
          matchesToShow.map((stat: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={styles.matchCard}
              onPress={() =>
                router.push({
                  pathname: "/(main)/league/match/results",
                  params: { matchId: stat.matches.id, returnTo: "stats" },
                })
              }
            >
              <View style={styles.matchInfo}>
                <Text style={styles.matchDate}>
                  {format(new Date(stat.matches.date_time), "dd MMM", {
                    locale: es,
                  }).toUpperCase()}
                </Text>
                <Text style={styles.matchLocation}>
                  {stat.matches.location_name}
                </Text>
              </View>
              <View
                style={[
                  styles.ratingBadge,
                  Number(stat.rating) >= 8
                    ? styles.bgGreen
                    : Number(stat.rating) >= 6
                      ? styles.bgYellow
                      : styles.bgRed,
                ]}
              >
                <Text
                  style={[
                    styles.ratingText,
                    Number(stat.rating) >= 8
                      ? styles.textGreen
                      : Number(stat.rating) >= 6
                        ? styles.textYellow
                        : styles.textRed,
                  ]}
                >
                  {stat.rating}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4B5563" />
            </TouchableOpacity>
          ))
        ) : (
          <EmptyState
            title="No hay partidos recientes"
            message="Juega partidos para ver tu historial y estadísticas aquí."
            iconName="activity"
          />
        )}

        <NativeAdCardWrapper
          style={{ marginTop: 20, marginBottom: 20 }}
          isPro={isPro}
        />

        {/* --- SECCIÓN PRO --- */}
        <View style={styles.sectionHeaderBox}>
          <Text style={[styles.sectionHeader, { color: PRO_GOLD }]}>
            ANÁLISIS PRO
          </Text>
        </View>

        {isPro ? (
          <>
            {/* GRÁFICOS */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>TENDENCIA DE RATING</Text>
              <TrendChart
                matches={stats?.recentMatches || []}
                leagueAvg={Number(leagueAvg.rating)}
              />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>PERFIL TÉCNICO VS LIGA</Text>
              <RadarChart userData={averages} leagueData={leagueAvg} />
              <View style={styles.statGrid}>
                {["pace", "defense", "technique", "physical", "attack"].map(
                  (key, i) => (
                    <View key={i} style={styles.statLabelItem}>
                      <Text style={styles.statLabelText}>
                        {["RIT", "DEF", "TEC", "FIS", "ATA"][i]}:{" "}
                        <Text style={styles.statValueText}>
                          {averages[key as keyof typeof averages]}
                        </Text>
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.proUnlockCard}
            activeOpacity={0.9}
            onPress={() =>
              showAlert(
                "Plan PRO",
                "Mejora tu plan para desbloquear estadísticas PRO, comparativas de liga y evolución histórica.",
              )
            }
          >
            <View style={styles.proBadgeIcon}>
              <MaterialCommunityIcons
                name="shield-star"
                size={30}
                color={PRO_GOLD}
              />
            </View>
            <View style={styles.proTextContainer}>
              <Text style={styles.proUnlockTitle}>ESTADÍSTICAS PRO</Text>
              <Text style={styles.proUnlockDesc}>
                Desbloquea estadísticas PRO, comparativas de liga y evolución
                histórica.
              </Text>
            </View>
            <Ionicons name="lock-closed" size={18} color={PRO_GOLD} />
          </TouchableOpacity>
        )}
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
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  matchInfo: { flex: 1 },
  matchDate: { color: "white", fontSize: 14, fontWeight: "bold" },
  matchLocation: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  ratingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  ratingText: { fontWeight: "900", fontSize: 12 },
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
  proUnlockCard: {
    backgroundColor: "#111827",
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: PRO_GOLD,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  proBadgeIcon: {
    width: 50,
    height: 50,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  proTextContainer: { flex: 1 },
  proUnlockTitle: { color: PRO_GOLD, fontSize: 13, fontWeight: "900" },
  proUnlockDesc: { color: "#9CA3AF", fontSize: 10, lineHeight: 14 },
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

  // --- NUEVOS ESTILOS CARTA PRO (ORGÁNICA & LIMPIA) ---
  cardWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  proCard: {
    width: 280,
    backgroundColor: "#1A2233", // Fondo ligeramente más claro que el modal
    borderRadius: 24,
    overflow: "hidden",
    // SIN BORDER WIDTH/COLOR para que se sienta orgánica
    position: "relative",
    paddingBottom: 25,
    alignItems: "center",
  },
  cardHeader: {
    alignItems: "center",
    marginTop: 35,
    position: "relative",
    marginBottom: 10,
  },
  photoRingContainer: {
    padding: 4,
    backgroundColor: "#1A2233",
    borderRadius: 70,
    borderWidth: 2,
    borderColor: PRO_GOLD,
    shadowColor: PRO_GOLD,
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  proPhoto: { width: 120, height: 120, borderRadius: 60 },
  ratingInsignia: {
    position: "absolute",
    bottom: -14,
    backgroundColor: PRO_GOLD,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  insigniaValue: { color: "#1C1C1C", fontSize: 22, fontWeight: "900" },
  insigniaSeparator: {
    width: 1,
    height: 16,
    backgroundColor: "#1C1C1C",
    opacity: 0.3,
  },
  insigniaPos: { color: "#1C1C1C", fontSize: 14, fontWeight: "bold" },
  nameContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  proName: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  proStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  proStatBox: {
    width: "31%",
    backgroundColor: "#111827", // Fondo más oscuro para contraste interno
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    // Sin borde duro
  },
  proStatValue: { color: PRO_GOLD, fontSize: 20, fontWeight: "900" },
  proStatLabel: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
