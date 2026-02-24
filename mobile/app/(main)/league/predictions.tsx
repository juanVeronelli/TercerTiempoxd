import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import apiClient from "../../../src/api/apiClient";
import { ScreenHeader } from "../../../src/components/ui/ScreenHeader";
import { UserAvatar } from "../../../src/components/ui/UserAvatar";

// --- Design System (alineado con DuelCard y LeagueHome) ---
const THEME = {
  cardBg: "#1F2937",
  innerBg: "#111827",
  gold: "#F59E0B",
  goldLight: "rgba(245, 158, 11, 0.2)",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  borderColor: "#374151",
  pointsGreen: "rgba(16, 185, 129, 0.25)",
  pointsGreenBorder: "rgba(16, 185, 129, 0.5)",
};

const MAX_PICKS = 5;

type Option = { id: string; option_key: string; label: string; image_url?: string };
type Question = {
  id: string;
  question_key: string;
  label: string;
  points_reward: number;
  difficulty?: string;
  options: Option[];
  user_option_id: string | null;
};
type Group = {
  id: string;
  type: string;
  period_key: string | null;
  closes_at: string;
  match: {
    id: string;
    date_time: string;
    location_name: string | null;
  } | null;
  questions: Question[];
};

type PredictionsData = {
  match: Group[];
  monthly: Group[];
  season: Group[];
};

// --- Card "Próximamente" (Mensuales / Temporada) ---
const ComingSoonCard = ({
  icon,
  title,
  subtitle,
}: {
  icon: "calendar" | "trophy";
  title: string;
  subtitle: string;
}) => (
  <View style={[styles.cardBase, styles.comingSoonCard]}>
    <View style={styles.comingSoonBgIcon}>
      <MaterialCommunityIcons
        name={icon === "calendar" ? "calendar" : "trophy"}
        size={100}
        color="rgba(255,255,255,0.04)"
      />
    </View>
    <View style={styles.comingSoonContent}>
      <View style={styles.comingSoonIconBox}>
        <MaterialCommunityIcons
          name={icon === "calendar" ? "calendar-outline" : "trophy-outline"}
          size={36}
          color={THEME.gold}
        />
      </View>
      <Text style={styles.comingSoonTitle}>{title}</Text>
      <Text style={styles.comingSoonSubtitle}>{subtitle}</Text>
    </View>
  </View>
);

// --- Opción individual (jugador = avatar, equipo = escudo; fallback = inicial) ---
const OptionChip = ({
  opt,
  isSelected,
  disabled,
  isSubmitting,
  onPress,
  isPlayerType,
}: {
  opt: Option;
  isSelected: boolean;
  disabled: boolean;
  isSubmitting: boolean;
  onPress: () => void;
  isPlayerType?: boolean;
}) => {
  const avatarUri = (opt as any).avatar_url ?? (opt as any).image_url;
  const showAvatar = !!avatarUri;
  const initial = (opt.label || "?").charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionChip,
        isSelected && styles.optionChipSelected,
        disabled && !isSelected && styles.optionChipDisabled,
      ]}
    >
      {showAvatar ? (
        <UserAvatar
          imageUrl={avatarUri}
          name={opt.label || "?"}
          size={36}
        />
      ) : (
        <View style={[styles.optionIconCircle, isSelected && styles.optionIconCircleSelected]}>
          <MaterialCommunityIcons
            name={isPlayerType ? "account" : "shield"}
            size={18}
            color={isSelected ? "#000" : THEME.gold}
          />
        </View>
      )}
      <Text
        style={[
          styles.optionLabel,
          isSelected && styles.optionLabelSelected,
          disabled && !isSelected && styles.optionLabelDisabled,
        ]}
        numberOfLines={1}
      >
        {opt.label}
      </Text>
      {isSubmitting && isSelected ? (
        <ActivityIndicator size="small" color="#000" />
      ) : isSelected ? (
        <View style={styles.optionCheckmark}>
          <Ionicons name="checkmark" size={16} color="#000" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// --- Tarjeta de predicción individual (The Betting Card) ---
const PredictionCard = ({
  question,
  picksCount,
  isLocked,
  submittingId,
  ratingInputs,
  setRatingInputs,
  onSubmit,
  showAlert,
}: {
  question: Question;
  picksCount: number;
  isLocked: boolean;
  submittingId: string | null;
  ratingInputs: Record<string, string>;
  setRatingInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: (questionId: string, optionId: string, picksCount: number, isSelected: boolean) => void;
  showAlert: (title: string, message: string) => void;
}) => {
  const isSelected = question.user_option_id != null;
  const canPick = isSelected || picksCount < MAX_PICKS;
  const isRating = question.question_key.startsWith("EXACT_RATING");
  const isSubmitting = submittingId === question.id;

  const handleOptionPress = (optionId: string, selected: boolean) => {
    if (isLocked || (!selected && !canPick)) return;
    onSubmit(question.id, optionId, picksCount, selected);
  };

  const handleRatingConfirm = () => {
    const raw = ratingInputs[question.id] ?? question.options.find((o) => o.id === question.user_option_id)?.option_key ?? "";
    const num = Math.min(10, Math.max(0, parseFloat(raw) || 0));
    const rounded = Math.round(num * 2) / 2;
    const key = String(rounded);
    const opt = question.options.find((o) => o.option_key === key);
    if (opt) onSubmit(question.id, opt.id, picksCount, question.user_option_id === opt.id);
    else showAlert("Aviso", "Ingresá un número entre 0 y 10 (ej: 7.5)");
  };

  return (
    <View style={[styles.predictionCard, isLocked && styles.predictionCardLocked]}>
      {isLocked && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={28} color={THEME.textSecondary} />
          <Text style={styles.lockText}>Cerrado</Text>
        </View>
      )}

      {/* Header: pregunta + badge puntos */}
      <View style={styles.predictionCardHeader}>
        <Text style={styles.predictionCardQuestion} numberOfLines={2}>
          {question.label}
        </Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>+{question.points_reward} PTS</Text>
        </View>
      </View>

      {/* Badges dificultad */}
      {(question.difficulty === "HARD" || question.difficulty === "MEDIUM") && (
        <View style={styles.difficultyRow}>
          {question.difficulty === "HARD" && (
            <View style={[styles.difficultyBadge, styles.difficultyHard]}>
              <Text style={styles.difficultyHardText}>DIFÍCIL</Text>
            </View>
          )}
          {question.difficulty === "MEDIUM" && (
            <View style={[styles.difficultyBadge, styles.difficultyMedium]}>
              <Text style={styles.difficultyMediumText}>MEDIO</Text>
            </View>
          )}
        </View>
      )}

      {/* Cuerpo: opciones */}
      <View style={styles.predictionCardBody}>
        {isRating ? (
          <View style={styles.ratingRow}>
            <TextInput
              style={styles.ratingInput}
              placeholder="0 - 10"
              placeholderTextColor="#6B7280"
              keyboardType="decimal-pad"
              value={
                ratingInputs[question.id] ??
                (question.user_option_id
                  ? question.options.find((o) => o.id === question.user_option_id)?.option_key ?? ""
                  : "")
              }
              onChangeText={(t) =>
                setRatingInputs((prev) => ({ ...prev, [question.id]: t.replace(",", ".") }))
              }
              editable={canPick && !isLocked && !isSubmitting}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.ratingConfirmBtn,
                (!canPick || isLocked || isSubmitting) && styles.optionChipDisabled,
              ]}
              onPress={handleRatingConfirm}
              disabled={!canPick || isLocked || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.ratingConfirmText}>Listo</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.optionsGrid}>
            {question.options.map((opt) => {
              const optSelected = question.user_option_id === opt.id;
              const disabled = isSubmitting || isLocked || (!optSelected && !canPick);
              const isPlayerType = question.question_key.toLowerCase().includes("mvp") || question.question_key.toLowerCase().includes("jugador");
              return (
                <OptionChip
                  key={opt.id}
                  opt={opt}
                  isSelected={!!optSelected}
                  disabled={disabled}
                  isSubmitting={isSubmitting}
                  onPress={() => handleOptionPress(opt.id, optSelected)}
                  isPlayerType={isPlayerType}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

export default function PredictionsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const leagueId = (params.leagueId as string) ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<PredictionsData | null>(null);
  const [activeTab, setActiveTab] = useState<"match" | "monthly" | "season">("match");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ratingInputs, setRatingInputs] = useState<Record<string, string>>({});

  const fetchPredictions = async () => {
    if (!leagueId) return;
    try {
      const res = await apiClient.get(`/predictions/league/${leagueId}`);
      setData(res.data);
    } catch (e) {
      console.error("Error fetching predictions:", e);
      setData({ match: [], monthly: [], season: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (leagueId) fetchPredictions();
      else setLoading(false);
    }, [leagueId]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPredictions();
  };

  const submitPrediction = async (
    questionId: string,
    optionId: string,
    picksCount: number,
    isSelected: boolean,
  ) => {
    if (!isSelected && picksCount >= MAX_PICKS) {
      showAlert(
        "Límite de 5",
        `Solo podés elegir ${MAX_PICKS} predicciones por partido. Cambiá una que ya tengas si querés otra.`,
      );
      return;
    }
    setSubmittingId(questionId);
    try {
      const res = await apiClient.post(
        "/predictions/submit",
        { questionId, optionId },
      );
      if (res.data?.error && !res.data?.success) {
        showAlert("Aviso", res.data.error);
        return;
      }
      await fetchPredictions();
      showAlert("¡Listo!", "Predicción guardada. Sumás puntos si acertás.");
    } catch (e: any) {
      const msg = e.response?.data?.error || "No se pudo guardar la predicción.";
      showAlert("Error", msg);
    } finally {
      setSubmittingId(null);
    }
  };

  if (!leagueId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ScreenHeader
          title="Zona de Predicciones"
          showBack
        />
        <View style={styles.emptyStateWrapper}>
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconWrap}>
              <Ionicons name="warning-outline" size={40} color={THEME.gold} />
            </View>
            <Text style={styles.emptyStateTitle}>Falta el ID de la liga</Text>
            <Text style={styles.emptyText}>Entrá desde una liga para ver las predicciones.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const groups = data
    ? activeTab === "match"
      ? data.match
      : activeTab === "monthly"
        ? data.monthly
        : data.season
    : [];

  const showComingSoon = activeTab === "monthly" || activeTab === "season";

  const tabs: { key: "match" | "monthly" | "season"; label: string; icon: string }[] = [
    { key: "match", label: "PARTIDO ACTUAL", icon: "soccer" },
    { key: "monthly", label: "MENSUALES", icon: "calendar-outline" },
    { key: "season", label: "TEMPORADA", icon: "trophy-outline" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header personalizado */}
      <ScreenHeader
        title="Zona de Predicciones"
        showBack
      />

      {/* Segmented Control (pestañas flotantes) */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[styles.segmentedTab, isActive && styles.segmentedTabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[styles.segmentedTabText, isActive && styles.segmentedTabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={THEME.gold} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.gold}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {showComingSoon && (
            <>
              <Text style={styles.sectionTitle}>
                {activeTab === "monthly" ? "PREDICCIONES MENSUALES" : "PREDICCIONES DE TEMPORADA"}
              </Text>
              <ComingSoonCard
                icon={activeTab === "monthly" ? "calendar" : "trophy"}
                title="Próximamente"
                subtitle={
                  activeTab === "monthly"
                    ? "Mejor del mes, más MVPs, más Fantasmas… Estamos preparando esta sección."
                    : "Campeón, MVP del año y más. Muy pronto podrás apostar por toda la temporada."
                }
              />
            </>
          )}

          {!showComingSoon && (
            <>
              {groups.length === 0 ? (
                <View style={styles.emptyStateWrapper}>
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconWrap}>
                      <MaterialCommunityIcons
                        name="crystal-ball"
                        size={48}
                        color={THEME.gold}
                      />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      Sin predicciones por ahora
                    </Text>
                    <Text style={styles.emptyText}>
                      Cuando haya un partido próximo con Prode, vas a poder participar acá y sumar puntos.
                    </Text>
                  </View>
                </View>
              ) : (
                groups.map((group) => {
                  const picksCount = group.questions.filter((q) => q.user_option_id != null).length;
                  const isLocked = new Date() > new Date(group.closes_at);
                  const sortedQuestions = [...group.questions].sort((a, b) => {
                    const order: Record<string, number> = { HARD: 0, MEDIUM: 1, EASY: 2 };
                    const da = a.difficulty ? (order[a.difficulty] ?? 2) : 2;
                    const db = b.difficulty ? (order[b.difficulty] ?? 2) : 2;
                    return da - db;
                  });

                  return (
                    <View key={group.id}>
                      {group.match && (
                        <View style={styles.groupMetaCard}>
                          <View style={styles.groupMetaIcon}>
                            <MaterialCommunityIcons name="soccer" size={18} color={THEME.gold} />
                          </View>
                          <View style={styles.groupMetaText}>
                            <Text style={styles.groupMatchDate}>
                              {new Date(group.match.date_time).toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {group.match.location_name ? ` · ${group.match.location_name}` : ""}
                            </Text>
                            <Text style={styles.closesAt}>
                              Cierra {new Date(group.closes_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                            </Text>
                          </View>
                          <View style={styles.picksCounter}>
                            <Text style={styles.picksCounterText}>{picksCount}/{MAX_PICKS}</Text>
                          </View>
                        </View>
                      )}

                      {sortedQuestions.map((q) => (
                        <PredictionCard
                          key={q.id}
                          question={q}
                          picksCount={picksCount}
                          isLocked={!!isLocked}
                          submittingId={submittingId}
                          ratingInputs={ratingInputs}
                          setRatingInputs={setRatingInputs}
                          onSubmit={submitPrediction}
                          showAlert={showAlert}
                        />
                      ))}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  segmentedWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: THEME.innerBg,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentedTabActive: {
    backgroundColor: THEME.gold,
  },
  segmentedTabText: {
    color: THEME.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segmentedTabTextActive: {
    color: "#000",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardBase: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  comingSoonCard: {
    padding: 28,
    position: "relative",
    minHeight: 180,
  },
  comingSoonBgIcon: {
    position: "absolute",
    right: -20,
    bottom: -20,
  },
  comingSoonContent: {
    zIndex: 2,
    alignItems: "center",
  },
  comingSoonIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: THEME.goldLight,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  comingSoonTitle: {
    color: THEME.gold,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  comingSoonSubtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  emptyStateWrapper: {
    flex: 1,
    paddingVertical: 40,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: THEME.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  groupMetaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  groupMetaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  groupMetaText: {
    flex: 1,
  },
  groupMatchDate: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  closesAt: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  picksCounter: {
    backgroundColor: THEME.goldLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  picksCounterText: {
    color: THEME.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  predictionCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    overflow: "hidden",
    padding: 18,
    position: "relative",
  },
  predictionCardLocked: {
    opacity: 0.65,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderRadius: 20,
  },
  lockText: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  predictionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  predictionCardQuestion: {
    color: THEME.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: THEME.pointsGreen,
    borderWidth: 1,
    borderColor: THEME.pointsGreenBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pointsBadgeText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "900",
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyHard: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  difficultyMedium: {
    backgroundColor: THEME.goldLight,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  difficultyHardText: {
    color: "#FCA5A5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  difficultyMediumText: {
    color: THEME.gold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  predictionCardBody: {
    marginTop: 4,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: THEME.borderColor,
    backgroundColor: THEME.innerBg,
    minWidth: "47%",
    maxWidth: "100%",
  },
  optionChipSelected: {
    borderColor: THEME.gold,
    borderWidth: 3,
    backgroundColor: THEME.goldLight,
  },
  optionChipDisabled: {
    opacity: 0.5,
    borderColor: THEME.borderColor,
    backgroundColor: THEME.innerBg,
  },
  optionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  optionIconCircleSelected: {
    backgroundColor: THEME.gold,
  },
  optionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  optionLabel: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  optionLabelSelected: {
    color: THEME.textPrimary,
  },
  optionLabelDisabled: {
    color: THEME.textSecondary,
  },
  optionCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingInput: {
    backgroundColor: THEME.innerBg,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  ratingConfirmBtn: {
    backgroundColor: THEME.gold,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
  },
  ratingConfirmText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
  },
});
