import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import apiClient from "../../../src/api/apiClient";
import { formatUserFacingError } from "../../../src/api/apiErrors";
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

const MAX_PICKS_MATCH = 5;
const MAX_PICKS_MONTHLY = 5;
const MONTHLY_TTP_BY_DIFFICULTY: Record<string, number> = {
  EASY: 18,
  MEDIUM: 25,
  HARD: 35,
};
/** Preguntas mostradas por fecha (muestra el backend ~10). */
const QUESTIONS_SHOWN_HINT = 10;

const getOptionImageUri = (opt: Option): string | null => {
  const anyOpt = opt as any;
  const candidates = [
    anyOpt.avatar_url,
    anyOpt.profile_photo_url,
    anyOpt.player_photo_url,
    anyOpt.user_photo_url,
    anyOpt.photo_url,
    anyOpt.image_url,
  ];
  const valid = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return valid ?? null;
};

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
};

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
  const avatarUri = getOptionImageUri(opt);
  const showAvatar = !!avatarUri;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionChip,
        styles.optionChipCompact,
        isSelected && styles.optionChipSelected,
        disabled && !isSelected && styles.optionChipDisabled,
      ]}
    >
      {showAvatar ? (
        <View style={styles.optionVisualWrap}>
          <UserAvatar
            imageUrl={avatarUri}
            name={opt.label || "?"}
            size={42}
          />
        </View>
      ) : (
        <View style={[styles.optionIconCircle, isSelected && styles.optionIconCircleSelected]}>
          <MaterialCommunityIcons
            name={isPlayerType ? "account" : "shield"}
            size={18}
            color={isSelected ? Colors.primary : THEME.textSecondary}
          />
        </View>
      )}
      <Text
        style={[
          styles.optionLabel,
          isSelected && styles.optionLabelSelected,
          disabled && !isSelected && styles.optionLabelDisabled,
        ]}
        numberOfLines={2}
      >
        {opt.label}
      </Text>
      {isSubmitting && isSelected ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : isSelected ? (
        <View style={styles.optionCheckmark}>
          <Ionicons name="checkmark" size={14} color={Colors.textPrimary} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// --- Tarjeta de predicción individual (The Betting Card) ---
const PredictionCard = ({
  question,
  picksCount,
  maxPicks,
  isLocked,
  submittingId,
  ratingInputs,
  setRatingInputs,
  onSubmit,
  onRemove,
  showAlert,
  rewardLabel,
  rewardValue,
}: {
  question: Question;
  picksCount: number;
  maxPicks: number;
  isLocked: boolean;
  submittingId: string | null;
  ratingInputs: Record<string, string>;
  setRatingInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: (questionId: string, optionId: string, picksCount: number, isSelected: boolean) => void;
  onRemove: (questionId: string) => void;
  showAlert: (title: string, message: string) => void;
  rewardLabel: "PTS" | "TTP";
  rewardValue: number;
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const isSelected = question.user_option_id != null;
  const canPick = isSelected || picksCount < maxPicks;
  const isRating = question.question_key.startsWith("EXACT_RATING");
  const isSubmitting = submittingId === question.id;
  const isPlayerType =
    question.question_key.toLowerCase().includes("mvp") ||
    question.question_key.toLowerCase().includes("jugador") ||
    question.question_key.toLowerCase().includes("player");

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

  const useCompactPicker = !isRating;
  const selectedOption = question.options.find((o) => o.id === question.user_option_id) ?? null;
  const filteredPickerOptions = question.options.filter((opt) =>
    opt.label.toLowerCase().includes(pickerSearch.trim().toLowerCase()),
  );

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
          <Text style={styles.pointsBadgeText}>+{rewardValue} {rewardLabel}</Text>
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
        ) : useCompactPicker ? (
          <View style={styles.compactPickerWrap}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.compactPickerTrigger,
                isSelected && styles.compactPickerTriggerSelected,
                (isLocked || isSubmitting) && styles.optionChipDisabled,
              ]}
              onPress={() => setPickerVisible(true)}
              disabled={isLocked || isSubmitting}
            >
              {selectedOption ? (
                <>
                  <UserAvatar
                    imageUrl={getOptionImageUri(selectedOption)}
                    name={selectedOption.label}
                    size={38}
                  />
                  <View style={styles.compactPickerTextCol}>
                    <Text style={styles.compactPickerCaption}>Tu elección</Text>
                    <Text style={styles.compactPickerValue} numberOfLines={1}>
                      {selectedOption.label}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.optionIconCircle}>
                    <MaterialCommunityIcons
                      name={isPlayerType ? "account-search" : "format-list-bulleted"}
                      size={18}
                      color={THEME.textSecondary}
                    />
                  </View>
                  <View style={styles.compactPickerTextCol}>
                    <Text style={styles.compactPickerCaption}>Sin elegir</Text>
                    <Text style={styles.compactPickerValue} numberOfLines={1}>
                      Toca para elegir opción
                    </Text>
                  </View>
                </>
              )}
              <Ionicons name="chevron-down" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>

            <Modal
              visible={pickerVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setPickerVisible(false)}
            >
              <View style={styles.pickerModalBackdrop}>
                <View style={styles.pickerModalCard}>
                  <View style={styles.pickerModalHeader}>
                    <Text style={styles.pickerModalTitle} numberOfLines={2}>
                      {question.label}
                    </Text>
                    <TouchableOpacity onPress={() => setPickerVisible(false)}>
                      <Ionicons name="close" size={22} color={THEME.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Buscar jugador..."
                    placeholderTextColor={THEME.textSecondary}
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                  />

                  <FlatList
                    data={filteredPickerOptions}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.pickerListContent}
                    renderItem={({ item }) => {
                      const optSelected = question.user_option_id === item.id;
                      const disabled = isSubmitting || isLocked || (!optSelected && !canPick);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[
                            styles.pickerOptionRow,
                            optSelected && styles.pickerOptionRowSelected,
                            disabled && !optSelected && styles.optionChipDisabled,
                          ]}
                          disabled={disabled}
                          onPress={() => {
                            handleOptionPress(item.id, optSelected);
                            setPickerVisible(false);
                          }}
                        >
                          <UserAvatar
                            imageUrl={getOptionImageUri(item)}
                            name={item.label}
                            size={36}
                          />
                          <Text style={styles.pickerOptionText} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {optSelected ? (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              </View>
            </Modal>
          </View>
        ) : (
          <View style={[styles.optionsGrid, styles.optionsGridCompact]}>
            {question.options.map((opt) => {
              const optSelected = question.user_option_id === opt.id;
              const disabled = isSubmitting || isLocked || (!optSelected && !canPick);
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

      {isSelected && !isLocked && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.removePickBtn}
          onPress={() => onRemove(question.id)}
          disabled={isSubmitting}
        >
          <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
          <Text style={styles.removePickText}>Quitar</Text>
        </TouchableOpacity>
      )}
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
  /** Mensaje si falló GET /predictions/league (null = OK). */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<PredictionsData | null>(null);
  const [activeTab, setActiveTab] = useState<"match" | "monthly">("match");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ratingInputs, setRatingInputs] = useState<Record<string, string>>({});
  const [showInfoModal, setShowInfoModal] = useState(false);

  const fetchPredictions = async () => {
    if (!leagueId) return;
    try {
      const res = await apiClient.get(`/predictions/league/${leagueId}`);
      setData(res.data);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError(
        formatUserFacingError(e, "No pudimos cargar las predicciones."),
      );
      setData({ match: [], monthly: [] });
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

  const removePrediction = async (questionId: string) => {
    setSubmittingId(questionId);
    try {
      const res = await apiClient.post("/predictions/remove", { questionId });
      if (res.data?.error && !res.data?.success) {
        showAlert("Aviso", res.data.error);
        return;
      }
      await fetchPredictions();
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudo eliminar la predicción."),
        undefined,
        "error",
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const submitPrediction = async (
    questionId: string,
    optionId: string,
    picksCount: number,
    isSelected: boolean,
  ) => {
    const maxPicks =
      activeTab === "monthly"
        ? MAX_PICKS_MONTHLY
        : MAX_PICKS_MATCH;
    if (!isSelected && picksCount >= maxPicks) {
      showAlert(
        `Límite de ${maxPicks}`,
        `Solo podés elegir ${maxPicks} predicciones en este evento. Quitá una si querés elegir otra.`,
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
      showAlert(
        "Guardado",
        "Tu elección quedó registrada.",
      );
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudo guardar la predicción."),
        undefined,
        "error",
      );
    } finally {
      setSubmittingId(null);
    }
  };

  if (!leagueId) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
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
      : data.monthly
    : [];

  const tabs: { key: "match" | "monthly"; label: string; icon: string }[] = [
    { key: "match", label: "Partido", icon: "soccer" },
    { key: "monthly", label: "Mensual", icon: "calendar-outline" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header personalizado */}
      <ScreenHeader
        title="Zona de Predicciones"
        showBack
      />

      {/* Segmented Control */}
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
                <View style={styles.segmentedTabTop}>
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={15}
                    color={isActive ? Colors.textPrimary : THEME.textSecondary}
                  />
                  <Text
                    style={[styles.segmentedTabText, isActive && styles.segmentedTabTextActive]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </View>
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
          <View style={styles.contextInfoRow}>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              style={styles.infoIconBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="information-circle-outline" size={18} color={THEME.gold} />
              <Text style={styles.infoIconText}>
                {activeTab === "match"
                  ? "Cómo funciona Partido"
                  : "Cómo funciona Mensual"}
              </Text>
            </TouchableOpacity>
          </View>

          {loadError != null && (
            <View style={styles.errorToast}>
              <Ionicons
                name="cloud-offline-outline"
                size={22}
                color="#FCA5A5"
                style={styles.errorToastIcon}
              />
              <View style={styles.errorToastTextCol}>
                <Text style={styles.errorToastTitle}>Sin datos actualizados</Text>
                <Text style={styles.errorToastBody}>{loadError}</Text>
              </View>
              <TouchableOpacity
                onPress={onRefresh}
                activeOpacity={0.85}
                style={styles.errorToastRetryBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.errorToastRetryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          {groups.length === 0 ? (
                <View style={styles.emptyStateWrapper}>
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconWrap}>
                      <MaterialCommunityIcons
                        name={loadError != null ? "cloud-alert-outline" : "crystal-ball"}
                        size={48}
                        color={THEME.gold}
                      />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      {loadError != null
                        ? "No se pudieron cargar las predicciones"
                        : activeTab === "match"
                          ? "Todavía no hay Prode para esta fecha"
                          : "Sin predicciones por ahora"}
                    </Text>
                    <Text style={styles.emptyText}>
                      {loadError != null
                        ? loadError
                        : activeTab === "match"
                          ? `En cuanto todos los jugadores convocados confirmen asistencia al próximo partido, acá se van a habilitar las preguntas y vas a poder elegir hasta ${MAX_PICKS_MATCH}.`
                          : `Cuando esté habilitado el Prode Mensual vas a poder elegir hasta ${MAX_PICKS_MONTHLY} predicciones del pool.`}
                    </Text>
                  </View>
                </View>
              ) : (
                groups.map((group) => {
                  const picksCount = group.questions.filter((q) => q.user_option_id != null).length;
                  const isLocked = new Date() > new Date(group.closes_at);
                  const maxPicks =
                    String(group.type || "").toUpperCase() === "MONTHLY"
                      ? MAX_PICKS_MONTHLY
                      : MAX_PICKS_MATCH;
                  const sortedQuestions = [...group.questions].sort((a, b) => {
                    const order: Record<string, number> = { HARD: 0, MEDIUM: 1, EASY: 2 };
                    const da = a.difficulty ? (order[a.difficulty] ?? 2) : 2;
                    const db = b.difficulty ? (order[b.difficulty] ?? 2) : 2;
                    return da - db;
                  });

                  return (
                    <View key={group.id}>
                      {group.match ? (
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
                            <Text style={styles.picksCounterLabel}>ELEGIDAS</Text>
                            <Text style={styles.picksCounterText}>
                              {picksCount}/{maxPicks}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.groupMetaCard}>
                          <View style={styles.groupMetaIcon}>
                            <MaterialCommunityIcons name="calendar" size={18} color={THEME.gold} />
                          </View>
                          <View style={styles.groupMetaText}>
                            <Text style={styles.groupMatchDate}>
                              {group.period_key ? `Mes: ${group.period_key}` : "Prode mensual"}
                            </Text>
                            <Text style={styles.closesAt}>
                              Cierra {new Date(group.closes_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                            </Text>
                          </View>
                          <View style={styles.picksCounter}>
                            <Text style={styles.picksCounterLabel}>ELEGIDAS</Text>
                            <Text style={styles.picksCounterText}>
                              {picksCount}/{maxPicks}
                            </Text>
                          </View>
                        </View>
                      )}

                      {sortedQuestions.map((q) => (
                    (() => {
                      const isMonthlyGroup = String(group.type || "").toUpperCase() === "MONTHLY";
                      const monthlyReward =
                        MONTHLY_TTP_BY_DIFFICULTY[
                          String(q.difficulty ?? "MEDIUM").toUpperCase()
                        ] ?? MONTHLY_TTP_BY_DIFFICULTY.MEDIUM;
                      return (
                        <PredictionCard
                          key={q.id}
                          question={q}
                          picksCount={picksCount}
                          maxPicks={maxPicks}
                          isLocked={!!isLocked}
                          submittingId={submittingId}
                          ratingInputs={ratingInputs}
                          setRatingInputs={setRatingInputs}
                          onSubmit={submitPrediction}
                          onRemove={removePrediction}
                          showAlert={showAlert}
                          rewardLabel={isMonthlyGroup ? "TTP" : "PTS"}
                          rewardValue={isMonthlyGroup ? monthlyReward : q.points_reward}
                        />
                      );
                    })()
                  ))}
                    </View>
                  );
                })
              )}
        </ScrollView>
      )}

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoModalBackdrop}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <View style={styles.infoModalTitleWrap}>
                <Ionicons name="information-circle" size={20} color={THEME.gold} />
                <Text style={styles.infoModalTitle}>Cómo funciona el Prode mensual</Text>
              </View>
              <TouchableOpacity onPress={() => setShowInfoModal(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalBody}>
              {activeTab === "match" ? (
                <>
                  El Prode de partido se habilita cuando el partido está listo para votar.{"\n\n"}
                  Podés elegir hasta <Text style={styles.monthlyTooltipStrong}>{MAX_PICKS_MATCH}</Text> predicciones
                  por fecha y cambiar tu elección mientras siga abierto.{"\n\n"}
                  Se cierra automáticamente al horario de inicio del partido.
                </>
              ) : activeTab === "monthly" ? (
                <>
                  Se abre el <Text style={styles.monthlyTooltipStrong}>día 1</Text> de cada mes y podés votar hasta el{" "}
                  <Text style={styles.monthlyTooltipStrong}>día 10</Text>.{"\n\n"}
                  Desde el <Text style={styles.monthlyTooltipStrong}>día 11</Text> queda cerrado.{"\n\n"}
                  Las recompensas en <Text style={styles.monthlyTooltipStrong}>TTP</Text> se otorgan automáticamente el{" "}
                  <Text style={styles.monthlyTooltipStrong}>día 1 del mes siguiente</Text>.
                </>
              ) : null}
            </Text>
          </View>
        </View>
      </Modal>
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
    paddingTop: 10,
    paddingBottom: 12,
  },
  contextInfoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  infoIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  infoIconText: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "800",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
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
    borderRadius: 10,
    gap: 0,
  },
  segmentedTabActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  segmentedTabTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
  },
  segmentedTabText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
  },
  segmentedTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: "800",
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
  errorToast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  errorToastIcon: {
    marginRight: 10,
  },
  errorToastTextCol: {
    flex: 1,
    minWidth: 0,
  },
  errorToastTitle: {
    color: "#FECACA",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  errorToastBody: {
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  errorToastRetryBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  errorToastRetryText: {
    color: THEME.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  infoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  infoModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    padding: 16,
  },
  infoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  infoModalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  infoModalTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  infoModalBody: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  monthlyTooltipStrong: {
    color: THEME.gold,
    fontWeight: "900",
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    alignItems: "center",
  },
  picksCounterLabel: {
    color: "#0F172A",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  picksCounterText: {
    color: "#0F172A",
    fontSize: 14,
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
    color: "#D1FAE5",
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
    color: "#FECACA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  difficultyMediumText: {
    color: "#FDE68A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  predictionCardBody: {
    marginTop: 4,
  },
  optionsGrid: {
    gap: 10,
  },
  optionsGridCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    rowGap: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    backgroundColor: Colors.surfaceDark,
    width: "100%",
    minHeight: 62,
  },
  optionChipCompact: {
    width: "48.5%",
    minHeight: 56,
  },
  optionChipSelected: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: "rgba(38,72,209,0.18)",
  },
  optionChipDisabled: {
    opacity: 0.5,
    borderColor: THEME.borderColor,
    backgroundColor: THEME.innerBg,
  },
  optionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(148,163,184,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  optionIconCircleSelected: {
    backgroundColor: "rgba(38,72,209,0.35)",
  },
  optionVisualWrap: {
    marginRight: 10,
  },
  optionLabel: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    lineHeight: 18,
  },
  optionLabelSelected: {
    color: THEME.textPrimary,
  },
  optionLabelDisabled: {
    color: THEME.textSecondary,
  },
  optionCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  compactPickerWrap: {
    marginTop: 2,
  },
  compactPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    backgroundColor: Colors.surfaceDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactPickerTriggerSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(38,72,209,0.14)",
  },
  compactPickerTextCol: {
    flex: 1,
  },
  compactPickerCaption: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  compactPickerValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.75)",
    justifyContent: "flex-end",
  },
  pickerModalCard: {
    maxHeight: "78%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    padding: 16,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  pickerModalTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  pickerSearchInput: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  pickerListContent: {
    paddingBottom: 14,
    gap: 8,
  },
  pickerOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    backgroundColor: Colors.surfaceDark,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  pickerOptionRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(38,72,209,0.14)",
  },
  pickerOptionText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
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
  removePickBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  removePickText: {
    color: "#FECACA",
    fontSize: 12,
    fontWeight: "900",
  },
});
