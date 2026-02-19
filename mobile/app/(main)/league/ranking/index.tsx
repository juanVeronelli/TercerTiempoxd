import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useRouter, useGlobalSearchParams } from "expo-router";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { EmptyState } from "../../../../src/components/ui/EmptyState";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { useCurrentUser } from "../../../../src/hooks/useCurrentUser";
import apiClient from "../../../../src/api/apiClient";
import { NativeAdCardWrapper } from "../../../../src/components/ads/NativeAdCardWrapper";

const { width } = Dimensions.get("window");

export default function RankingHubScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ leagueId?: string }>();
  const leagueId = useCurrentLeagueId(params.leagueId ?? null);
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [planType, setPlanType] = useState("FREE");
  const [hasCompletedMatch, setHasCompletedMatch] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await apiClient.get("/auth/me");

        const currentPlan = response.data.user?.planType;
        setPlanType(currentPlan || "FREE");

        const leagues = response.data?.leagues ?? [];
        const currentLeague = leagueId
          ? leagues.find((l: any) => l.id === leagueId)
          : null;
        setIsAdmin(
          currentLeague?.role === "ADMIN" || currentLeague?.role === "OWNER"
        );
      } catch (error) {
        console.error("Error fetching plan:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchUserPlan();
  }, [userId, leagueId]);

  useEffect(() => {
    const fetchRecentResults = async () => {
      if (!leagueId) return;
      try {
        const res = await apiClient.get(
          `/match/${leagueId}/recent-results`,
        );
        const list = res.data ?? [];
        setHasCompletedMatch(Array.isArray(list) && list.length > 0);
      } catch {
        setHasCompletedMatch(false);
      }
    };
    fetchRecentResults();
  }, [leagueId]);

  const isPro = planType?.toUpperCase() === "PRO";
  const isRankingLocked = !hasCompletedMatch;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScreenHeader title="COMPETENCIA" showBack />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Skeleton width="100%" height={82} borderRadius={16} style={{ marginBottom: 15 }} />
          <Skeleton width="100%" height={82} borderRadius={16} style={{ marginBottom: 15 }} />
          <Skeleton width="100%" height={82} borderRadius={16} style={{ marginBottom: 15 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isRankingLocked) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScreenHeader title="COMPETENCIA" showBack />
        <View style={styles.softLockContainer}>
          <EmptyState
            title="La Tabla está vacía"
            message="El ranking se activará después del primer partido con votación completada de la liga."
            iconName="award"
            actionLabel={isAdmin ? "Invitar Jugadores" : undefined}
            onAction={
              isAdmin && leagueId
                ? () =>
                    router.push({
                      pathname: "/(main)/league/settings",
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
      <ScreenHeader title="COMPETENCIA" showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>TABLAS OFICIALES</Text>

        <TouchableOpacity
            style={styles.navCard}
            onPress={() =>
              leagueId
                ? router.push({
                    pathname: "/(main)/league/ranking/table",
                    params: { leagueId },
                  })
                : router.push("/(main)/league/ranking/table")
            }
          >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: "rgba(16, 185, 129, 0.15)" },
            ]}
          >
            <Ionicons name="stats-chart" size={32} color="#10B981" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>RANKING GENERAL</Text>
            <Text style={styles.cardDesc}>
              Mira todos los puntajes de tu liga hasta hoy.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#4B5563" />
        </TouchableOpacity>

        <NativeAdCardWrapper
          style={{ marginTop: 16, marginBottom: 16 }}
          isPro={isPro}
        />

        <TouchableOpacity
          style={styles.navCard}
          onPress={() =>
            leagueId
              ? router.push({
                  pathname: "/(main)/league/ranking/honors",
                  params: { leagueId },
                })
              : router.push("/(main)/league/ranking/honors")
          }
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: "rgba(245, 158, 11, 0.15)" },
            ]}
          >
            <Ionicons name="trophy" size={32} color="#F59E0B" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={[styles.cardTitle, { color: "#F59E0B" }]}>
              SALÓN DE LA FAMA
            </Text>
            <Text style={styles.cardDesc}>
              El medallero histórico de MVPs y Troncos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#4B5563" />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>
          ANÁLISIS AVANZADO
        </Text>

        {isPro ? (
          <TouchableOpacity
            style={styles.navCard}
            onPress={() => {
              router.push({
                pathname: "/(main)/league/ranking/advanced-stats",
                params: { leagueId: leagueId }, // <-- Pasamos el ID por aquí
              });
            }}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: "rgba(59, 130, 246, 0.15)" },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={32}
                color={Colors.primary}
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: Colors.primary }]}>
                RIVALES & SOCIOS
              </Text>
              <Text style={styles.cardDesc}>
                Análisis avanzado de tus mejores duplas y rivales.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#4B5563" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.proUnlockCard}
            activeOpacity={0.9}
            onPress={() =>
              showAlert(
                "PRO",
                "Desbloquea estadísticas avanzadas con el plan PRO.",
              )
            }
          >
            <View style={styles.proBadgeIcon}>
              <MaterialCommunityIcons
                name="human-male-child"
                size={30}
                color="#F59E0B"
              />
            </View>
            <View style={styles.proTextContainer}>
              <Text style={styles.proUnlockTitle}>RIVALES & SOCIOS</Text>
              <Text style={styles.proUnlockDesc}>
                Unete al plan PRO y conoce con quién juegas mejor o a quién
                tienes de hijo.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos se mantienen iguales...
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
  content: { paddingHorizontal: 20 },
  adContainer: {
    width: "100%",
    height: 100,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    borderStyle: "dashed",
    marginBottom: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  adContent: { alignItems: "center", opacity: 0.5 },
  adText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: 1,
  },
  adSubText: { color: "#6B7280", fontSize: 10 },
  sectionTitle: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  skeletonSectionTitle: { marginBottom: 15 },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  cardTextContainer: { flex: 1, paddingRight: 10 },
  cardTitle: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 4,
  },
  cardDesc: { color: "#9CA3AF", fontSize: 12, lineHeight: 16 },
  proUnlockCard: {
    backgroundColor: "#111827",
    borderRadius: 15,
    padding: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "center",
  },
  proBadgeIcon: {
    width: 50,
    height: 60,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  proTextContainer: { flex: 1 },
  proUnlockTitle: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 2,
  },
  proUnlockDesc: {
    color: "#9CA3AF",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
});
