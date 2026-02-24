import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AchievementCard } from "../../../../src/components/profile/AchievementCard";
import { Colors } from "../../../../src/constants/Colors";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import apiClient from "../../../../src/api/apiClient";

// Habilitar LayoutAnimation en Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THEME = {
  bg: Colors.background,
  cardBg: "#1F2937",
  cardBorder: "#374151",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  accentGold: "#F59E0B",
  goldDark: "#D97706",
  accentBlue: Colors.primary,
  proGradient: ["#F59E0B", "#D97706", "#B45309"] as const,
};

type FilterTab = "todos" | "en_progreso" | "completados";

const CATEGORY_LABELS: Record<string, string> = {
  MATCH: "RENDIMIENTO",
  STREAK: "RACHAS",
  SOCIAL: "SOCIAL & COMUNIDAD",
  RANKING: "RANKING",
};

const CATEGORY_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  MATCH: "trophy",
  STREAK: "fire",
  SOCIAL: "account-group",
  RANKING: "podium",
};

const CONDITION_LABELS: Record<string, string> = {
  MATCHES_PLAYED: "partidos",
  MATCHES_WON: "victorias",
  WIN_STREAK: "victorias seguidas",
  LOSS_STREAK: "derrotas seguidas",
  MVP_COUNT: "MVPs",
  TRONCO_COUNT: "Troncos",
  FANTASMA_COUNT: "Fantasmas",
  DUEL_WINS: "duelos ganados",
  MATCHES_ORGANIZED: "partidos organizados",
  VOTES_CAST: "votos emitidos",
  PREDICTION_CORRECT: "predicciones acertadas",
  CLEAN_SHEET_COUNT: "vallas invictas",
  TRONCO_THEN_MVP: "Fénix",
  SAME_PARTNER_WINS: "partidos con el mismo compañero",
  WEEKS_ACTIVE_STREAK: "semanas activas",
  LEAGUE_RANK_REACHED: "posición en ranking",
  AVG_RATING_OVER_MATCHES: "promedio de rating",
  MATCHES_CONFIRMED: "asistencias confirmadas",
  ACHIEVEMENTS_UNLOCKED: "logros desbloqueados",
  COSMETIC_ACHIEVEMENTS_CLAIMED: "cosméticos reclamados",
  MATCHES_NO_FANTASMA_STREAK: "partidos sin fantasma",
  DEFENSE_SINGLE: "defensa en un partido",
  ATTACK_SINGLE: "ataque en un partido",
  PACE_SINGLE: "ritmo en un partido",
  TECHNIQUE_SINGLE: "técnica en un partido",
  PHYSICAL_SINGLE: "físico en un partido",
  OVERALL_SINGLE: "promedio en un partido",
  MULTI_STAT_8_SINGLE: "stats a 8+",
  COMEBACK_WIN: "remontadas",
  RANK_OVERTAKE: "superaciones en ranking",
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition_type: string;
  condition_value: number;
  reward_type: string;
  reward_value: any;
  is_pro_exclusive: boolean;
  user_achievement?: {
    current_progress: number;
    is_completed: boolean;
    claimed_at: string | null;
  } | null;
};

type Section = { title: string; key: string; data: Achievement[] };

export default function AchievementsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [planType, setPlanType] = useState("FREE");
  const [activeTab, setActiveTab] = useState<FilterTab>("todos");
  const isPro = planType === "PRO";

  const fetchData = async () => {
    try {
      const [achRes, meRes] = await Promise.all([
        apiClient.get("/achievements/me"),
        apiClient.get("/auth/me"),
      ]);
      setAchievements(achRes.data ?? []);
      setPlanType(meRes.data?.user?.planType ?? "FREE");
    } catch (e) {
      console.error("Error loading achievements:", e);
      setAchievements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const filteredByTab = React.useMemo(() => {
    switch (activeTab) {
      case "completados":
        return achievements.filter((a) => a.user_achievement?.is_completed);
      case "en_progreso":
        return achievements.filter((a) => !a.user_achievement?.is_completed);
      default:
        return achievements;
    }
  }, [achievements, activeTab]);

  const sections: Section[] = React.useMemo(() => {
    const grouped = filteredByTab.reduce<Record<string, Achievement[]>>(
      (acc, a) => {
        const cat = a.category || "MATCH";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(a);
        return acc;
      },
      {},
    );
    const categoryOrder = ["MATCH", "STREAK", "SOCIAL", "RANKING"];
    return categoryOrder
      .filter((c) => grouped[c]?.length)
      .map((c) => ({
        title: CATEGORY_LABELS[c] || c,
        key: c,
        data: grouped[c],
      }));
  }, [filteredByTab]);

  const handleTabChange = (tab: FilterTab) => {
    if (tab === activeTab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons
        name={CATEGORY_ICONS[section.key] || "trophy"}
        size={14}
        color={THEME.accentGold + "CC"}
      />
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Achievement }) => (
    <AchievementCard achievement={item} isPro={isPro} />
  );

  const ListEmptyComponent = (
    <View style={styles.empty}>
      <MaterialCommunityIcons
        name={
          activeTab === "completados"
            ? "trophy-outline"
            : activeTab === "en_progreso"
              ? "progress-clock"
              : "trophy-outline"
        }
        size={48}
        color={THEME.textSecondary}
      />
      <Text style={styles.emptyText}>
        {activeTab === "completados"
          ? "Aún no completaste ningún logro"
          : activeTab === "en_progreso"
            ? "No hay misiones en progreso"
            : "No hay logros disponibles"}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
        <ScreenHeader title="Logros" showBack onBackPress={() => router.back()} showBell={false} />
        <View style={styles.content}>
          <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={100} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <ScreenHeader title="Logros" showBack onBackPress={() => router.back()} />

      {/* Segmented Control */}
      <View style={styles.segmentedWrap}>
        <TouchableOpacity
          style={[styles.segmentedBtn, activeTab === "todos" && styles.segmentedBtnActive]}
          onPress={() => handleTabChange("todos")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentedLabel,
              activeTab === "todos" && styles.segmentedLabelActive,
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentedBtn, activeTab === "en_progreso" && styles.segmentedBtnActive]}
          onPress={() => handleTabChange("en_progreso")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentedLabel,
              activeTab === "en_progreso" && styles.segmentedLabelActive,
            ]}
          >
            En Progreso
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentedBtn, activeTab === "completados" && styles.segmentedBtnActive]}
          onPress={() => handleTabChange("completados")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentedLabel,
              activeTab === "completados" && styles.segmentedLabelActive,
            ]}
          >
            Completados
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={THEME.accentGold}
          />
        }
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 20 },
  segmentedWrap: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentedBtnActive: {
    backgroundColor: THEME.accentGold + "25",
    borderWidth: 1,
    borderColor: THEME.accentGold + "50",
  },
  segmentedLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.textSecondary,
  },
  segmentedLabelActive: {
    color: THEME.accentGold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  sectionSeparator: { height: 20 },
  itemSeparator: { height: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingTop: 4,
  },
  sectionTitle: {
    color: THEME.accentGold + "CC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: THEME.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});
