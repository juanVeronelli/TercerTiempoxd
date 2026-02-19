import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { ScreenHeader } from "../../../src/components/ui/ScreenHeader";
import { UserAvatar } from "../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../src/components/ui/Skeleton";
import apiClient from "../../../src/api/apiClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PRESET_BANNERS, AVATAR_FRAMES } from "../../../src/components/profile/profileConstants";
import type { AvatarFramePreset } from "../../../src/components/profile/profileConstants";

const { width } = Dimensions.get("window");

// Configuración de Items de Vitrina
const SHOWCASE_CONFIG: any = {
  mvp: { label: "MVP Ganados", icon: "trophy" },
  matches: { label: "Partidos Jugados", icon: "soccer" },
  avg_hist: { label: "Prom. Histórico", icon: "chart-line" },
  best_rating: { label: "Mejor Nota", icon: "star" },
  last_match: { label: "Último Partido", icon: "history" },
  tronco: { label: "Troncos", icon: "tree" },
  duel: { label: "Duelos Ganados", icon: "sword-cross" },
  oracle: { label: "Oracles (Prode)", icon: "crystal-ball" },
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);

  // Datos del Usuario
  const [user, setUser] = useState<any>(null);
  const [careerStats, setCareerStats] = useState<any>(null);
  const [trophyCase, setTrophyCase] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  // ESTÉTICA DINÁMICA (Defaults)
  const [activeAccent, setActiveAccent] = useState(Colors.primary);
  const [activeFrame, setActiveFrame] = useState<AvatarFramePreset>(AVATAR_FRAMES[1]); // Default Básico
  const [showcaseSelection, setShowcaseSelection] = useState<string[]>([
    "mvp",
    "matches",
    "avg_hist",
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await apiClient.get(`/auth/profile/global/${id}`);
      const data = res.data;
      const rawUser = data.profile;

      const fullName =
        rawUser.full_name || rawUser.fullName || rawUser.username || "Usuario";
      const [firstName, ...restName] = fullName.trim().split(" ");

      const formattedUser = {
        ...rawUser,
        photoUrl:
          rawUser.profile_photo_url || rawUser.photo || rawUser.photoUrl || null,
        name: firstName || "Usuario",
        surname: restName.join(" "),
        bannerUrl: rawUser.banner_url || rawUser.bannerUrl || null,
        mainPosition: rawUser.main_position || rawUser.mainPosition || "MID",
        planType: rawUser.plan_type || rawUser.planType || "FREE",
      };

      setUser(formattedUser);
      setCareerStats(data.careerStats);
      setTrophyCase(data.trophyCase);
      setRecentMatches(data.recentMatches);

      // --- APLICAR PERSONALIZACIÓN VISUAL DESDE LA DB ---

      // 1. Color de Acento
      if (rawUser.accent_color) {
        setActiveAccent(rawUser.accent_color);
      } else {
        setActiveAccent(Colors.primary);
      }

      // 2. Marco de Avatar (ID de la DB → preset con source para overlay)
      if (rawUser.avatar_frame) {
        const foundFrame = AVATAR_FRAMES.find(
          (f) => f.id === rawUser.avatar_frame,
        );
        if (foundFrame) setActiveFrame(foundFrame);
      }

      // 3. Vitrina
      if (
        rawUser.showcase_items &&
        Array.isArray(rawUser.showcase_items) &&
        rawUser.showcase_items.length > 0
      ) {
        setShowcaseSelection(rawUser.showcase_items);
      }
    } catch (error) {
      console.error(error);
      showAlert("Error", "No se pudo cargar el perfil.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) fetchData();
    }, [id]),
  );

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return Colors.status.success;
    if (rating >= 6) return Colors.accentGold;
    return Colors.status.error;
  };

  const getShowcaseValue = (id: string) => {
    if (!careerStats || !trophyCase) return "-";
    switch (id) {
      case "mvp":
        return trophyCase.mvp || 0;
      case "matches":
        return careerStats.totalMatches || 0;
      case "avg_hist":
        return Number(careerStats.averageRating || 0).toFixed(1);
      case "best_rating":
        return Number(careerStats.highestRating || 0).toFixed(1);
      case "tronco":
        return trophyCase.tronco || 0;
      case "duel":
        return trophyCase.duel ?? 0;
      case "last_match":
        const last = recentMatches[0];
        return last ? Number(last.rating || 0).toFixed(1) : "-";
      case "oracle":
        return trophyCase.oracle ?? 0;
      default:
        return "-";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.header}>
          <Skeleton width="100%" height={56} borderRadius={12} style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Skeleton width="100%" height={360} borderRadius={24} style={{ marginBottom: 24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isPro = user?.planType === "PRO";
  const bannerDef = user?.bannerUrl
    ? PRESET_BANNERS.find((b) => b.id === user.bannerUrl)
    : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScreenHeader title="JUGADOR" showBack showBell={false} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. CARD PERFIL */}
        <View style={styles.profileCard}>
          <View style={styles.bannerContainer}>
            {bannerDef ? (
              <Image
                source={bannerDef.source}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.defaultBanner}>
                <Ionicons
                  name="image-outline"
                  size={40}
                  color="rgba(255,255,255,0.1)"
                />
              </View>
            )}
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <View
                style={[
                  styles.avatarFrame,
                  !activeFrame.source && {
                    borderColor:
                      activeFrame.color === "accent"
                        ? activeAccent
                        : activeFrame.color,
                    borderWidth: activeFrame.width,
                  },
                ]}
              >
                <UserAvatar
                  imageUrl={user?.photoUrl}
                  name={[user?.name, user?.surname].filter(Boolean).join(" ") || "Usuario"}
                  size={100}
                />
                {activeFrame.source ? (
                  <Image
                    source={activeFrame.source}
                    style={styles.avatarFrameOverlay}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
            </View>

            <Text style={styles.userName}>
              {user?.name} {user?.surname}
            </Text>
            <Text style={styles.userHandle}>
              @{user?.username || "usuario"}
            </Text>

            {/* BADGE CON COLOR DE ACENTO */}
            <View
              style={[
                styles.positionBadge,
                {
                  borderColor: activeAccent + "40",
                  backgroundColor: activeAccent + "15",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="soccer-field"
                size={14}
                color={activeAccent}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.positionText, { color: activeAccent }]}>
                {user?.mainPosition || "Posición no definida"}
              </Text>
            </View>

            <Text style={styles.bioText}>{user?.bio || "Sin biografía."}</Text>
          </View>
        </View>

        {/* 2. VITRINA (SOLO SI ES PRO) */}
        {isPro ? (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionHeader}>VITRINA DE JUGADOR</Text>
            </View>

            <View style={styles.showcaseContainer}>
              {showcaseSelection.map((itemId) => {
                const itemConfig = SHOWCASE_CONFIG[itemId];
                if (!itemConfig) return null;
                return (
                  <View key={itemId} style={styles.showcaseSlot}>
                    <View
                      style={[
                        styles.showcaseIconBox,
                        { borderColor: activeAccent },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={itemConfig.icon as any}
                        size={24}
                        color={activeAccent}
                      />
                    </View>
                    <Text style={styles.showcaseValue}>
                      {getShowcaseValue(itemId)}
                    </Text>
                    <Text style={styles.showcaseLabel} numberOfLines={1}>
                      {itemConfig.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.freeUserBadge}>
            <Text style={styles.freeUserText}>Perfil de Jugador Estándar</Text>
          </View>
        )}

        {/* 3. HISTORIAL */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>HISTORIAL RECIENTE</Text>
        </View>

        {recentMatches && recentMatches.length > 0 ? (
          recentMatches.map((match: any) => {
            const rating = parseFloat(match.rating) || 0;
            return (
              <View key={match.matchId} style={styles.matchRow}>
                <View style={styles.matchLeft}>
                  <View style={styles.leagueIcon}>
                    <Ionicons
                      name="trophy-outline"
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </View>
                  <View>
                    <Text style={styles.matchLocation}>{match.location}</Text>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {/* Nombre de la liga con el color de acento */}
                      <Text
                        style={[styles.matchLeague, { color: activeAccent }]}
                      >
                        {match.leagueName}
                      </Text>
                      <Text style={styles.matchDate}>
                        {" "}
                        •{" "}
                        {format(new Date(match.date), "dd MMM", { locale: es })}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.matchRight}>
                  <View
                    style={[
                      styles.ratingBox,
                      { backgroundColor: getRatingColor(rating) },
                    ]}
                  >
                    <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title="Sin historial"
            message="Este jugador aún no ha participado en ningún partido."
            iconName="activity"
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    color: Colors.textPrimary,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  content: { paddingHorizontal: 20 },

  // Profile Card
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 25,
  },
  bannerContainer: {
    height: 140,
    backgroundColor: Colors.surfaceDark,
    position: "relative",
  },
  bannerImage: { width: "100%", height: "100%" },
  defaultBanner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceElevated,
  },
  proBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.accentGold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proText: { fontSize: 10, fontWeight: "900", color: "black" },

  profileInfo: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 25,
    marginTop: -25,
  },

  // AVATAR SYSTEM (igual que profile/ProfileHeaderCard)
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatarFrame: {
    padding: 0,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarFrameOverlay: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 54,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 0,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 40, fontWeight: "bold", color: Colors.textSecondary },

  userName: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 2,
    textAlign: "center",
  },
  userHandle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },

  // Badge Dinámico
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 15,
  },
  positionText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  bioText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Vitrina Section
  sectionContainer: { marginBottom: 25 },
  sectionHeaderBox: {
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  showcaseContainer: { flexDirection: "row", justifyContent: "space-between" },
  showcaseSlot: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  showcaseIconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    backgroundColor: Colors.background,
  },
  showcaseValue: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2,
  },
  showcaseLabel: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  freeUserBadge: {
    alignSelf: "center",
    paddingVertical: 5,
    paddingHorizontal: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    marginBottom: 25,
  },
  freeUserText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "bold",
  },

  // Matches
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  matchLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  leagueIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  matchLocation: { color: "white", fontSize: 14, fontWeight: "bold" },
  matchLeague: { fontSize: 11, fontWeight: "700" },
  matchDate: { color: Colors.textSecondary, fontSize: 11 },
  matchRight: { alignItems: "flex-end" },
  ratingBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingValue: { color: "black", fontSize: 14, fontWeight: "900" },

  emptyState: { alignItems: "center", padding: 30 },
  emptyStateText: {
    color: Colors.textSecondary,
    marginTop: 10,
    fontStyle: "italic",
    textAlign: "center",
  },
});
