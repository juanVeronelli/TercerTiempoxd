import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { UserAvatar } from "../../src/components/ui/UserAvatar";
import { NativeAdCardWrapper } from "../../src/components/ads/NativeAdCardWrapper";
import { PurchaseManager } from "../../src/services/PurchaseManager";
import { useCustomAlert } from "../../src/context/AlertContext";
import apiClient from "../../src/api/apiClient";
import * as SecureStore from "expo-secure-store";
import { getRoleConfig } from "../../src/utils/roleUtils";

export default function HomeScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [userData, setUserData] = useState<any>(null);
  const [userLeagues, setUserLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- LOGICA DE DATOS ---
  const fetchUserData = async () => {
    try {
      const response = await apiClient.get("/auth/me");

      const rawUser = response.data.user;

      setUserData({
        ...rawUser,
        photoUrl:
          rawUser.photo ||
          rawUser.photoUrl ||
          rawUser.profile_photo_url ||
          null,
      });

      // Importante: Asegúrate que el backend de /auth/me incluya el campo 'role' en cada liga
      setUserLeagues(response.data.leagues);
    } catch (error) {
      console.error("Error fetching user:", error);
      showAlert("Error", "No pudimos cargar tu perfil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const handleLogout = async () => {
    showAlert("Cerrar Sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            try {
              await PurchaseManager.logOut();
            } catch {}
            await SecureStore.deleteItemAsync("userToken");
            router.replace("/(auth)/login");
          },
        },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isPro = userData?.planType !== "FREE";
  const slots = [0, 1, 2, 3];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.push("/(main)/league/profile")}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <UserAvatar
                imageUrl={userData?.photoUrl}
                name={userData?.full_name || userData?.username || "Usuario"}
                size={48}
              />
            </View>
          </TouchableOpacity>

          <View>
            <Text style={styles.headerSubtitle}>BIENVENIDO</Text>
            <Text style={styles.headerTitle}>
              {userData?.username || "JUGADOR"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={Colors.status.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>MIS COMPETICIONES</Text>
          <View
            style={[
              styles.planBadge,
              isPro ? styles.badgePro : styles.badgeFree,
            ]}
          >
            <Text
              style={[
                styles.planText,
                isPro ? styles.textPro : styles.textFree,
              ]}
            >
              PLAN {userData?.planType || "FREE"}
            </Text>
          </View>
        </View>

        {/* GRID DE LIGAS */}
        <View style={styles.grid}>
          {slots.map((index) => {
            const league = userLeagues[index];
            const isLocked = !isPro && index > 0;

            if (isLocked) {
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.card, styles.lockedCard]}
                  activeOpacity={0.9}
                  onPress={() =>
                    showAlert("Premium", "Mejora a PRO para más ligas.")
                  }
                >
                  <View style={styles.lockedIconCircle}>
                    <Ionicons
                      name="lock-closed"
                      size={24}
                      color={Colors.accentGold}
                    />
                  </View>
                  <Text style={styles.lockedText}>SLOT PRO</Text>
                </TouchableOpacity>
              );
            }

            if (league) {
              // AQUÍ USAMOS LA LÓGICA DINÁMICA DE ROL
              const roleConfig = getRoleConfig(league.role);

              return (
                <TouchableOpacity
                  key={league.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/league/home",
                      params: { leagueName: league.name, leagueId: league.id },
                    })
                  }
                >
                  <View style={styles.leagueIconCircle}>
                    <Text style={styles.leagueIconText}>
                      {league.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.cardContent}>
                    <Text style={styles.leagueName} numberOfLines={2}>
                      {league.name}
                    </Text>

                    {/* BADGE DE ROL DINÁMICO SEGÚN ROL DE LA DB */}
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          borderColor: roleConfig.color + "40",
                          backgroundColor: roleConfig.color + "10",
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={roleConfig.icon}
                        size={12}
                        color={roleConfig.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.roleText, { color: roleConfig.color }]}
                      >
                        {roleConfig.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={`empty-${index}`}
                style={[styles.card, styles.emptyCard]}
                onPress={() => router.push("/(main)/create-league")}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={32}
                  color={Colors.textSecondary}
                />
                <Text style={styles.emptyText}>CREAR / UNIRSE</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Native Ad (solo usuarios FREE; PRO no ven anuncios) */}
        <NativeAdCardWrapper style={styles.adCard} isPro={isPro} />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BANNER PRO */}
      {!isPro && (
        <View style={styles.proBanner}>
          <View style={styles.proContent}>
            <View style={styles.proIconBox}>
              <MaterialCommunityIcons
                name="crown"
                size={22}
                color={Colors.accentGold}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>HAZTE PRO</Text>
              <Text style={styles.proDesc}>
                Ligas ilimitadas y estadísticas avanzadas.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={() => router.push("/(main)/paywall")}
            >
              <Text style={styles.proBtnText}>VER</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  scrollContent: { paddingHorizontal: 20 },
  adCard: { marginTop: 24, marginBottom: 8 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  sectionHeaderBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  planBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeFree: { backgroundColor: "rgba(156, 163, 175, 0.15)" },
  badgePro: { backgroundColor: "rgba(245, 158, 11, 0.15)" },
  planText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  textFree: { color: Colors.textSecondary },
  textPro: { color: Colors.accentGold },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  leagueIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  leagueIconText: { color: Colors.textPrimary, fontSize: 22, fontWeight: "900" },
  cardContent: { alignItems: "center", width: "100%" },
  leagueName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    height: 36,
    textAlignVertical: "center",
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  lockedCard: { backgroundColor: Colors.surfaceDark, opacity: 0.9 },
  lockedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockedText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  emptyCard: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderWidth: 2,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: 0.5,
  },

  proBanner: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.accentGold,
    elevation: 5,
  },
  proContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  proIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  proTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "bold",
    fontStyle: "italic",
  },
  proDesc: { color: Colors.textSecondary, fontSize: 10 },
  proBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentGold,
  },
  proBtnText: { color: Colors.accentGold, fontSize: 10, fontWeight: "900" },
});
