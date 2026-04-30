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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import { useTtp } from "../../../src/context/TtpContext";
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
  const valid = candidates.find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  return valid ?? null;
};

type Option = {
  id: string;
  option_key: string;
  label: string;
  image_url?: string;
};
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

type NextHouseMarketsResponse = {
  match: null | {
    id: string;
    dateTime: string;
    locationName: string | null;
    status: string | null;
  };
  markets: Array<{
    id: string;
    marketKey: string;
    marketLabel?: string;
    status: string;
    closesAt: string | null;
    /** true solo si sos JUGADOR del partido (espectador sí puede apostar) */
    isPlayer: boolean;
    options: Array<{
      optionKey: string;
      label: string;
      imageUrl: string | null;
      odds: number;
    }>;
  }>;
};

type MyHouseSlipsResponse = {
  matchId: string;
  slips: Array<{
    id: string;
    status: string;
    stakeTtp: number;
    oddsTotal: number;
    payoutTtp: number | null;
    placedAt: string | null;
    settledAt: string | null;
    legs: Array<{
      marketKey: string;
      marketLabel: string;
      optionKey: string;
      optionLabel: string;
      odds: number;
      result: "PENDING" | "WON" | "LOST" | "VOID";
    }>;
  }>;
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
          <UserAvatar imageUrl={avatarUri} name={opt.label || "?"} size={42} />
        </View>
      ) : (
        <View
          style={[
            styles.optionIconCircle,
            isSelected && styles.optionIconCircleSelected,
          ]}
        >
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
  onSubmit: (
    questionId: string,
    optionId: string,
    picksCount: number,
    isSelected: boolean,
  ) => void;
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
    const raw =
      ratingInputs[question.id] ??
      question.options.find((o) => o.id === question.user_option_id)
        ?.option_key ??
      "";
    const num = Math.min(10, Math.max(0, parseFloat(raw) || 0));
    const rounded = Math.round(num * 2) / 2;
    const key = String(rounded);
    const opt = question.options.find((o) => o.option_key === key);
    if (opt)
      onSubmit(
        question.id,
        opt.id,
        picksCount,
        question.user_option_id === opt.id,
      );
    else showAlert("Aviso", "Ingresá un número entre 0 y 10 (ej: 7.5)");
  };

  const useCompactPicker = !isRating;
  const selectedOption =
    question.options.find((o) => o.id === question.user_option_id) ?? null;
  const filteredPickerOptions = question.options.filter((opt) =>
    opt.label.toLowerCase().includes(pickerSearch.trim().toLowerCase()),
  );

  return (
    <View
      style={[styles.predictionCard, isLocked && styles.predictionCardLocked]}
    >
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
          <Text style={styles.pointsBadgeText}>
            +{rewardValue} {rewardLabel}
          </Text>
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
                  ? (question.options.find(
                      (o) => o.id === question.user_option_id,
                    )?.option_key ?? "")
                  : "")
              }
              onChangeText={(t) =>
                setRatingInputs((prev) => ({
                  ...prev,
                  [question.id]: t.replace(",", "."),
                }))
              }
              editable={canPick && !isLocked && !isSubmitting}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.ratingConfirmBtn,
                (!canPick || isLocked || isSubmitting) &&
                  styles.optionChipDisabled,
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
                      name={
                        isPlayerType ? "account-search" : "format-list-bulleted"
                      }
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
              <Ionicons
                name="chevron-down"
                size={18}
                color={THEME.textSecondary}
              />
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
                      <Ionicons
                        name="close"
                        size={22}
                        color={THEME.textSecondary}
                      />
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
                      const disabled =
                        isSubmitting || isLocked || (!optSelected && !canPick);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[
                            styles.pickerOptionRow,
                            optSelected && styles.pickerOptionRowSelected,
                            disabled &&
                              !optSelected &&
                              styles.optionChipDisabled,
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
                          <Text
                            style={styles.pickerOptionText}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {optSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={Colors.primary}
                            />
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
              const disabled =
                isSubmitting || isLocked || (!optSelected && !canPick);
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
  const insets = useSafeAreaInsets();
  const ttp = useTtp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Mensaje si falló GET /predictions/league (null = OK). */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<PredictionsData | null>(null);
  const [activeTab, setActiveTab] = useState<"match" | "monthly" | "bets">(
    "match",
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ratingInputs, setRatingInputs] = useState<Record<string, string>>({});
  const [showInfoModal, setShowInfoModal] = useState(false);


  // --- Apuestas (MVP) ---
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsError, setBetsError] = useState<string | null>(null);
  const [betsData, setBetsData] = useState<NextHouseMarketsResponse | null>(
    null,
  );
  const [betsMySlips, setBetsMySlips] = useState<MyHouseSlipsResponse | null>(null);
  /** Selección por mercado (sirve para simple y combinada). */
  const [betsSelections, setBetsSelections] = useState<
    Record<
      string,
      { marketKey: string; optionKey: string; odds: number; label: string }
    >
  >({});
  /** Mercados agregados a la combinada (sin límite explícito; tope práctico = mercados mostrados). */
  const [betsComboKeys, setBetsComboKeys] = useState<string[]>([]);
  const [betsMode, setBetsMode] = useState<"single" | "combo">("single");
  const [betsSingleKey, setBetsSingleKey] = useState<string | null>(null);
  const [betsPickerVisible, setBetsPickerVisible] = useState(false);
  const [betsPickerMarketKey, setBetsPickerMarketKey] = useState<string | null>(
    null,
  );
  const [betsPickerSearch, setBetsPickerSearch] = useState("");
  const [betsStakeInput, setBetsStakeInput] = useState<string>("100");
  const [betsStakeModalVisible, setBetsStakeModalVisible] = useState(false);
  const [betsStakeDraft, setBetsStakeDraft] = useState<string>("100");
  const [placingBet, setPlacingBet] = useState(false);

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

  const fetchBets = async () => {
    if (!leagueId) return;
    try {
      setBetsLoading(true);
      const res = await apiClient.get<NextHouseMarketsResponse>(
        `/bets/${leagueId}/next-house`,
      );
      setBetsData(res.data);
      setBetsError(null);
      if (res.data?.match?.id) {
        try {
          const slipsRes = await apiClient.get<MyHouseSlipsResponse>(
            `/bets/house/${leagueId}/${res.data.match.id}/mine`,
          );
          setBetsMySlips(slipsRes.data);
        } catch {
          setBetsMySlips(null);
        }
      } else {
        setBetsMySlips(null);
      }
    } catch (e: unknown) {
      setBetsError(formatUserFacingError(e, "No pudimos cargar las apuestas."));
      setBetsData(null);
      setBetsMySlips(null);
    } finally {
      setBetsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (leagueId) fetchPredictions();
      else setLoading(false);
    }, [leagueId]),
  );

  // Al entrar a Predicciones/Apuestas, marcamos como vistas las acciones relacionadas (Prode abierto / apuesta resuelta).
  useFocusEffect(
    useCallback(() => {
      if (!leagueId) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await apiClient.get<{
            ok: boolean;
            actions: Array<{ key: string; kind: string }>;
          }>("/actions/now", { params: { leagueId } });
          const keys = (res.data?.actions ?? [])
            .filter((a) => a.kind === "PRODE_OPEN" || a.kind === "HOUSE_BET_SETTLED")
            .map((a) => a.key);
          if (cancelled) return;
          if (keys.length > 0) {
            await apiClient.post("/actions/seen", { keys });
          }
        } catch {
          // silencioso
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [leagueId]),
  );

  // Al entrar al tab Apuestas, cargar mercado.
  useFocusEffect(
    useCallback(() => {
      if (!leagueId) return;
      if (activeTab !== "bets") return;
      fetchBets();
    }, [leagueId, activeTab]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === "bets") {
      fetchBets().finally(() => setRefreshing(false));
      return;
    }
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
      activeTab === "monthly" ? MAX_PICKS_MONTHLY : MAX_PICKS_MATCH;
    if (!isSelected && picksCount >= maxPicks) {
      showAlert(
        `Límite de ${maxPicks}`,
        `Solo podés elegir ${maxPicks} predicciones en este evento. Quitá una si querés elegir otra.`,
      );
      return;
    }
    setSubmittingId(questionId);
    try {
      const res = await apiClient.post("/predictions/submit", {
        questionId,
        optionId,
      });
      if (res.data?.error && !res.data?.success) {
        showAlert("Aviso", res.data.error);
        return;
      }
      await fetchPredictions();
      showAlert("Guardado", "Tu elección quedó registrada.");
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
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.background}
        />
        <ScreenHeader title="Zona de Predicciones" showBack />
        <View style={styles.emptyStateWrapper}>
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconWrap}>
              <Ionicons name="warning-outline" size={40} color={THEME.gold} />
            </View>
            <Text style={styles.emptyStateTitle}>Falta el ID de la liga</Text>
            <Text style={styles.emptyText}>
              Entrá desde una liga para ver las predicciones.
            </Text>
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
        : []
    : [];

  const tabs: {
    key: "match" | "monthly" | "bets";
    label: string;
    icon: string;
  }[] = [
    { key: "match", label: "Partido", icon: "soccer" },
    { key: "monthly", label: "Mensual", icon: "calendar-outline" },
    { key: "bets", label: "Apuestas", icon: "poker-chip" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header personalizado */}
      <ScreenHeader title="Zona de Predicciones" showBack />

      {/* Segmented Control */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.segmentedTab,
                  isActive && styles.segmentedTabActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <View style={styles.segmentedTabTop}>
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={15}
                    color={isActive ? Colors.textPrimary : THEME.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentedTabText,
                      isActive && styles.segmentedTabTextActive,
                    ]}
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
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={THEME.gold}
              />
              <Text style={styles.infoIconText}>
                {activeTab === "match"
                  ? "Cómo funciona Partido"
                  : activeTab === "monthly"
                    ? "Cómo funciona Mensual"
                    : "Cómo funciona Apuestas"}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab !== "bets" && loadError != null && (
            <View style={styles.errorToast}>
              <Ionicons
                name="cloud-offline-outline"
                size={22}
                color="#FCA5A5"
                style={styles.errorToastIcon}
              />
              <View style={styles.errorToastTextCol}>
                <Text style={styles.errorToastTitle}>
                  Sin datos actualizados
                </Text>
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

          {activeTab === "bets" ? (
            <View>
              {betsLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={THEME.gold} size="large" />
                </View>
              ) : betsError != null ? (
                <View style={styles.emptyStateWrapper}>
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconWrap}>
                      <MaterialCommunityIcons
                        name="cloud-alert-outline"
                        size={48}
                        color={THEME.gold}
                      />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      No se pudieron cargar las apuestas
                    </Text>
                    <Text style={styles.emptyText}>{betsError}</Text>
                  </View>
                </View>
              ) : !betsData?.match || betsData.markets.length === 0 ? (
                <View style={styles.emptyStateWrapper}>
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconWrap}>
                      <MaterialCommunityIcons
                        name="poker-chip"
                        size={48}
                        color={THEME.gold}
                      />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      No hay apuestas disponibles
                    </Text>
                    <Text style={styles.emptyText}>
                      Cuando haya un próximo partido programado, vas a poder
                      apostar TTP (MVP, Tronco, Fantasma, defensa, etc).
                    </Text>
                  </View>
                </View>
              ) : (
                (() => {
                  const match = betsData.match!;
                  const stakeTtp = Math.floor(
                    Number(
                      String(betsStakeInput ?? "").replace(/[^\d]/g, ""),
                    ) || 0,
                  );
                  const isPlayer = betsData.markets.some((m) => m.isPlayer);
                  const comboLegs = betsComboKeys
                    .map((k) => betsSelections[k])
                    .filter(Boolean) as Array<{
                    marketKey: string;
                    optionKey: string;
                    odds: number;
                    label: string;
                  }>;
                  const singleLeg = betsSingleKey
                    ? (betsSelections[betsSingleKey] ?? null)
                    : null;
                  const legsToSend =
                    betsMode === "combo"
                      ? comboLegs
                      : singleLeg
                        ? [singleLeg]
                        : [];

                  const safeLegs = legsToSend.filter((l) =>
                    Number.isFinite(Number(l.odds)),
                  );
                  const oddsTotal =
                    safeLegs.length === 0
                      ? 0
                      : betsMode === "combo"
                        ? safeLegs.reduce((acc, l) => acc + Number(l.odds), 0)
                        : Number(safeLegs[0]!.odds);
                  const hasCalc =
                    stakeTtp > 0 && safeLegs.length > 0 && oddsTotal > 0;
                  const payoutIfWin = hasCalc
                    ? Math.floor(stakeTtp * oddsTotal)
                    : 0;
                  const profitIfWin = hasCalc
                    ? Math.max(0, payoutIfWin - stakeTtp)
                    : 0;
                  const balance =
                    typeof ttp?.balance === "number" ? ttp.balance : null;
                  const hasEnoughBalance =
                    balance == null ? true : stakeTtp <= balance;
                  const canPlace =
                    !isPlayer &&
                    legsToSend.length >= 1 &&
                    legsToSend.length <= betsData.markets.length &&
                    stakeTtp > 0 &&
                    oddsTotal > 1 &&
                    hasEnoughBalance &&
                    !placingBet;

                  const place = async () => {
                    if (!canPlace) return;
                    try {
                      setPlacingBet(true);
                      await apiClient.post(`/bets/house/place`, {
                        leagueId,
                        matchId: match.id,
                        stakeTtp,
                        legs: legsToSend.map((l) => ({
                          marketKey: l.marketKey,
                          optionUserId: l.optionKey,
                        })),
                      });
                      await fetchBets();
                      showAlert(
                        "Apuesta realizada",
                        "Tu apuesta quedó registrada.",
                      );
                      setBetsSelections({});
                      setBetsComboKeys([]);
                      setBetsSingleKey(null);
                    } catch (e: unknown) {
                      showAlert(
                        "No se pudo apostar",
                        formatUserFacingError(
                          e,
                          "Revisá el monto e intentá de nuevo.",
                        ),
                      );
                    } finally {
                      setPlacingBet(false);
                    }
                  };

                  return (
                    <>
                      <View style={styles.groupMetaCard}>
                        <View style={styles.groupMetaIcon}>
                          <MaterialCommunityIcons
                            name="poker-chip"
                            size={18}
                            color={THEME.gold}
                          />
                        </View>
                        <View style={styles.groupMetaText}>
                          <Text style={styles.groupMatchDate}>
                            Apuestas del próximo partido
                          </Text>
                          <Text style={styles.closesAt}>
                            Cierra{" "}
                            {betsData.markets[0]?.closesAt
                              ? new Date(
                                  betsData.markets[0]!.closesAt!,
                                ).toLocaleString("es-AR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                            {match.locationName
                              ? ` · ${match.locationName}`
                              : ""}
                          </Text>
                        </View>
                        <View style={styles.picksCounter}>
                          <Text style={styles.picksCounterLabel}>
                            {betsMode === "combo" ? "COMBI" : "SIMPLE"}
                          </Text>
                        </View>
                      </View>

                      {isPlayer ? (
                        <View style={styles.errorToast}>
                          <Ionicons
                            name="warning-outline"
                            size={22}
                            color="#FDE68A"
                            style={styles.errorToastIcon}
                          />
                          <View style={styles.errorToastTextCol}>
                            <Text style={styles.errorToastTitle}>
                              No podés apostar en este partido
                            </Text>
                            <Text style={styles.errorToastBody}>
                              Si jugás el partido, no podés apostar ni a favor
                              ni en contra.
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Modo: Simple / Combinada */}
                      <View style={styles.betsModeWrap}>
                        <View style={styles.betsModeControl}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                              styles.betsModeTab,
                              betsMode === "single" && styles.betsModeTabActive,
                            ]}
                            onPress={() => {
                              setBetsMode("single");
                              // Elegimos un default razonable si venías de combinada
                              const first =
                                betsData.markets[0]?.marketKey ?? null;
                              setBetsSingleKey((prev) => prev ?? first);
                            }}
                          >
                            <Text
                              style={[
                                styles.betsModeText,
                                betsMode === "single" &&
                                  styles.betsModeTextActive,
                              ]}
                            >
                              Simple
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                              styles.betsModeTab,
                              betsMode === "combo" && styles.betsModeTabActive,
                            ]}
                            onPress={() => setBetsMode("combo")}
                          >
                            <Text
                              style={[
                                styles.betsModeText,
                                betsMode === "combo" &&
                                  styles.betsModeTextActive,
                              ]}
                            >
                              Combinada
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Cards por apuesta */}
                      {betsMySlips?.slips?.length ? (
                        <View style={styles.myBetsCard}>
                          <View style={styles.myBetsHeader}>
                            <Text style={styles.myBetsTitle}>MIS APUESTAS</Text>
                            <Text style={styles.myBetsSub}>
                              {betsMySlips.slips.length} slip(s)
                            </Text>
                          </View>
                          <View style={{ gap: 10 }}>
                            {betsMySlips.slips.map((s) => {
                              const st = String(s.status || "").toUpperCase();
                              const badgeStyle =
                                st === "WON"
                                  ? styles.statusWon
                                  : st === "LOST"
                                    ? styles.statusLost
                                    : st === "VOID"
                                      ? styles.statusVoid
                                      : styles.statusOpen;
                              const badgeText =
                                st === "WON"
                                  ? "GANADA"
                                  : st === "LOST"
                                    ? "PERDIDA"
                                    : st === "VOID"
                                      ? "DEVUELTA"
                                      : "ABIERTA";
                              return (
                                <View key={s.id} style={styles.myBetRow}>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={styles.myBetTopRow}>
                                      <View style={[styles.statusPill, badgeStyle]}>
                                        <Text style={styles.statusPillText}>
                                          {badgeText}
                                        </Text>
                                      </View>
                                      <Text style={styles.myBetMeta}>
                                        {s.stakeTtp} TTP · cuota{" "}
                                        {Number(s.oddsTotal || 0).toFixed(3)}
                                      </Text>
                                    </View>
                                    <Text style={styles.myBetLegs} numberOfLines={2}>
                                      {s.legs
                                        .map((l) => `${l.marketLabel}: ${l.optionLabel}`)
                                        .join(" · ")}
                                    </Text>
                                  </View>
                                  <View style={styles.myBetRight}>
                                    <Text style={styles.myBetPayoutLabel}>
                                      {st === "WON"
                                        ? "Cobrado"
                                        : st === "VOID"
                                          ? "Devuelto"
                                          : "Potencial"}
                                    </Text>
                                    <Text style={styles.myBetPayoutValue}>
                                      {st === "WON" || st === "VOID"
                                        ? `${s.payoutTtp ?? 0}`
                                        : `${Math.floor(s.stakeTtp * Number(s.oddsTotal || 0))}`}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}

                      <View
                        style={{
                          gap: 12,
                          marginBottom: 220 + (insets.bottom || 0),
                        }}
                      >
                        {betsData.markets.map((mkt) => {
                          const selection =
                            betsSelections[mkt.marketKey] ?? null;
                          const isInCombo = betsComboKeys.includes(
                            mkt.marketKey,
                          );
                          const isSimpleActive =
                            betsMode === "single" &&
                            betsSingleKey === mkt.marketKey;
                          const disableAddCombo = false;

                          return (
                            <View key={mkt.id} style={styles.betMarketCard}>
                              <View style={styles.betMarketHeader}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    style={styles.betMarketTitle}
                                    numberOfLines={2}
                                  >
                                    {mkt.marketLabel ?? mkt.marketKey}
                                  </Text>
                                  {selection ? (
                                    <Text
                                      style={styles.betMarketSub}
                                      numberOfLines={1}
                                    >
                                      Cuota {selection.odds.toFixed(3)}
                                    </Text>
                                  ) : (
                                    <Text
                                      style={styles.betMarketSub}
                                      numberOfLines={1}
                                    >
                                      Elegí un jugador
                                    </Text>
                                  )}
                                </View>

                                {betsMode === "combo" ? (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    disabled={
                                      isPlayer ||
                                      (!isInCombo && disableAddCombo)
                                    }
                                    onPress={() => {
                                      setBetsComboKeys((prev) => {
                                        if (prev.includes(mkt.marketKey))
                                          return prev.filter(
                                            (k) => k !== mkt.marketKey,
                                          );
                                        return [...prev, mkt.marketKey];
                                      });
                                    }}
                                    style={[
                                      styles.betChip,
                                      isInCombo && styles.betChipActive,
                                      (isPlayer ||
                                        (!isInCombo && disableAddCombo)) &&
                                        styles.optionChipDisabled,
                                    ]}
                                  >
                                    <Ionicons
                                      name={
                                        isInCombo
                                          ? "checkmark-circle"
                                          : "add-circle-outline"
                                      }
                                      size={16}
                                      color={
                                        isInCombo
                                          ? "#111827"
                                          : THEME.textSecondary
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.betChipText,
                                        isInCombo && styles.betChipTextActive,
                                      ]}
                                    >
                                      {isInCombo ? "Listo" : "Sumar"}
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    disabled={isPlayer}
                                    onPress={() =>
                                      setBetsSingleKey(mkt.marketKey)
                                    }
                                    style={[
                                      styles.betChip,
                                      isSimpleActive && styles.betChipActive,
                                      isPlayer && styles.optionChipDisabled,
                                    ]}
                                  >
                                    <Ionicons
                                      name={
                                        isSimpleActive
                                          ? "flash"
                                          : "flash-outline"
                                      }
                                      size={16}
                                      color={
                                        isSimpleActive
                                          ? "#111827"
                                          : THEME.textSecondary
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.betChipText,
                                        isSimpleActive &&
                                          styles.betChipTextActive,
                                      ]}
                                    >
                                      {isSimpleActive ? "Activa" : "Usar"}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Desplegable (igual estilo Prode) */}
                              <TouchableOpacity
                                activeOpacity={0.85}
                                disabled={isPlayer}
                                onPress={() => {
                                  setBetsPickerMarketKey(mkt.marketKey);
                                  setBetsPickerSearch("");
                                  setBetsPickerVisible(true);
                                }}
                                style={[
                                  styles.compactPickerTrigger,
                                  selection &&
                                    styles.compactPickerTriggerSelected,
                                  isPlayer && styles.optionChipDisabled,
                                ]}
                              >
                                {selection ? (
                                  <>
                                    <UserAvatar
                                      imageUrl={
                                        mkt.options.find(
                                          (o) =>
                                            o.optionKey === selection.optionKey,
                                        )?.imageUrl
                                      }
                                      name={selection.label}
                                      size={38}
                                    />
                                    <View style={styles.compactPickerTextCol}>
                                      <Text style={styles.compactPickerCaption}>
                                        Tu elección
                                      </Text>
                                      <Text
                                        style={styles.compactPickerValue}
                                        numberOfLines={1}
                                      >
                                        {selection.label}
                                      </Text>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <View style={styles.optionIconCircle}>
                                      <MaterialCommunityIcons
                                        name="account-search"
                                        size={18}
                                        color={THEME.textSecondary}
                                      />
                                    </View>
                                    <View style={styles.compactPickerTextCol}>
                                      <Text style={styles.compactPickerCaption}>
                                        Sin elegir
                                      </Text>
                                      <Text
                                        style={styles.compactPickerValue}
                                        numberOfLines={1}
                                      >
                                        Toca para elegir
                                      </Text>
                                    </View>
                                  </>
                                )}
                                <Ionicons
                                  name="chevron-down"
                                  size={18}
                                  color={THEME.textSecondary}
                                />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>

                      {/* Panel inferior de apuesta (sin teclado). El monto se edita en un bottom sheet. */}
                      <View
                        style={[
                          styles.betsBottomBar,
                          { bottom: 12 + (insets.bottom || 0) },
                        ]}
                      >
                        <View style={styles.betsBottomCard}>
                          <View style={styles.betsFooterActionRow}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={styles.betsFooterTopControls}>
                                <View style={styles.stakeField}>
                                  <View style={styles.stakeInputRow}>
                                    <Ionicons
                                      name="wallet-outline"
                                      size={18}
                                      color="rgba(255,255,255,0.55)"
                                    />
                                    <TouchableOpacity
                                      activeOpacity={0.85}
                                      disabled={placingBet || isPlayer}
                                      onPress={() => {
                                        setBetsStakeDraft(betsStakeInput || "");
                                        setBetsStakeModalVisible(true);
                                      }}
                                      style={styles.stakeTapArea}
                                    >
                                      <Text style={styles.stakeTapText} numberOfLines={1}>
                                        {betsStakeInput ? `${betsStakeInput} TTP` : "Monto (TTP)"}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  style={[
                                    styles.betsPrimaryBtn,
                                    (!canPlace || isPlayer) &&
                                      styles.primaryBtnDisabled,
                                  ]}
                                  onPress={place}
                                  disabled={!canPlace || isPlayer}
                                >
                                  <Text style={styles.betsPrimaryText}>
                                    {placingBet ? "..." : "Apostar"}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              <View style={styles.betsFooterMetaRow}>
                                <View style={styles.balancePill}>
                                  <Text style={styles.balancePillLabel}>Saldo</Text>
                                  <Text style={styles.balancePillValue}>
                                    {balance == null ? "—" : balance}
                                  </Text>
                                  <Text style={styles.balancePillUnit}>TTP</Text>
                                </View>
                                {!isPlayer &&
                                stakeTtp > 0 &&
                                balance != null &&
                                !hasEnoughBalance ? (
                                  <Text style={styles.betsFooterError} numberOfLines={1}>
                                    Saldo insuficiente
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          <View style={styles.betsFooterSummary}>
                            <View style={styles.betsFooterSummaryCol}>
                              <Text style={styles.betsFooterLabel}>
                                Cuota total
                              </Text>
                              <Text style={styles.betsFooterValue}>
                                {safeLegs.length ? oddsTotal.toFixed(3) : "—"}
                              </Text>
                            </View>
                            <View style={styles.betsFooterDivider} />
                            <View style={styles.betsFooterSummaryCol}>
                              <Text style={styles.betsFooterLabel}>
                                Ganancia potencial
                              </Text>
                              <Text style={styles.betsFooterValueGold}>
                                {hasCalc ? `+${profitIfWin} TTP` : "—"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Bottom sheet: editar monto (evita que el teclado tape el panel) */}
                      <Modal
                        visible={betsStakeModalVisible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setBetsStakeModalVisible(false)}
                      >
                        <View style={styles.stakeSheetBackdrop}>
                          <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => setBetsStakeModalVisible(false)}
                          />
                          <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                          >
                            <View style={styles.stakeSheetCard}>
                              <View style={styles.stakeSheetHeader}>
                                <Text style={styles.stakeSheetTitle}>Monto a apostar</Text>
                                <TouchableOpacity
                                  onPress={() => setBetsStakeModalVisible(false)}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="close" size={22} color={THEME.textSecondary} />
                                </TouchableOpacity>
                              </View>
                              <View style={styles.stakeSheetRow}>
                                <Ionicons name="wallet-outline" size={18} color={THEME.textSecondary} />
                                <TextInput
                                  style={styles.stakeSheetInput}
                                  placeholder="Ej: 250"
                                  placeholderTextColor="#6B7280"
                                  keyboardType="numeric"
                                  value={betsStakeDraft}
                                  onChangeText={setBetsStakeDraft}
                                  autoFocus
                                />
                                <Text style={styles.stakeSheetUnit}>TTP</Text>
                              </View>
                              <View style={styles.stakeSheetMetaRow}>
                                <Text style={styles.stakeSheetMeta}>
                                  Saldo: {balance == null ? "—" : `${balance} TTP`}
                                </Text>
                              </View>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.stakeSheetConfirmBtn}
                                onPress={() => {
                                  const next = String(betsStakeDraft ?? "").replace(/[^\d]/g, "");
                                  setBetsStakeInput(next);
                                  setBetsStakeModalVisible(false);
                                }}
                              >
                                <Text style={styles.stakeSheetConfirmText}>Usar monto</Text>
                              </TouchableOpacity>
                            </View>
                          </KeyboardAvoidingView>
                        </View>
                      </Modal>

                      {/* Modal picker */}
                      <Modal
                        visible={betsPickerVisible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setBetsPickerVisible(false)}
                      >
                        <View style={styles.pickerBackdrop}>
                          <View style={styles.pickerCard}>
                            <View style={styles.pickerHeader}>
                              <Text style={styles.pickerTitle}>
                                Elegí jugador
                              </Text>
                              <TouchableOpacity
                                onPress={() => setBetsPickerVisible(false)}
                                activeOpacity={0.85}
                              >
                                <Ionicons
                                  name="close"
                                  size={22}
                                  color={THEME.textSecondary}
                                />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.betsPickerSearchRow}>
                              <Ionicons
                                name="search"
                                size={18}
                                color={THEME.textSecondary}
                              />
                              <TextInput
                                value={betsPickerSearch}
                                onChangeText={setBetsPickerSearch}
                                placeholder="Buscar…"
                                placeholderTextColor="#6B7280"
                                style={styles.betsPickerSearchInput}
                              />
                            </View>

                            <FlatList
                              data={(() => {
                                const mk = betsPickerMarketKey;
                                const market = mk
                                  ? betsData.markets.find(
                                      (m) => m.marketKey === mk,
                                    )
                                  : null;
                                const q = betsPickerSearch.trim().toLowerCase();
                                const opts = (market?.options ?? []).filter(
                                  (o) => o.label.toLowerCase().includes(q),
                                );
                                return opts;
                              })()}
                              keyExtractor={(it) => it.optionKey}
                              style={{ maxHeight: 420 }}
                              renderItem={({ item }) => {
                                const mk = betsPickerMarketKey;
                                if (!mk) return null;
                                const selected =
                                  betsSelections[mk]?.optionKey ===
                                  item.optionKey;
                                return (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    style={[
                                      styles.pickerRow,
                                      selected && styles.pickerRowSelected,
                                    ]}
                                    onPress={() => {
                                      setBetsSelections((prev) => ({
                                        ...prev,
                                        [mk]: {
                                          marketKey: mk,
                                          optionKey: item.optionKey,
                                          odds: item.odds,
                                          label: item.label,
                                        },
                                      }));
                                      // si estás en simple y no había key, setear
                                      if (betsMode === "single") {
                                        setBetsSingleKey((cur) => cur ?? mk);
                                      }
                                      setBetsPickerVisible(false);
                                    }}
                                  >
                                    {item.imageUrl ? (
                                      <UserAvatar
                                        imageUrl={item.imageUrl}
                                        name={item.label}
                                        size={40}
                                      />
                                    ) : (
                                      <View style={styles.pickerIconFallback}>
                                        <MaterialCommunityIcons
                                          name={
                                            item.optionKey === "TEAM_A" ||
                                            item.optionKey === "TEAM_B"
                                              ? "shield"
                                              : item.optionKey === "DRAW"
                                                ? "equal"
                                                : item.optionKey === "OVER" ||
                                                    item.optionKey === "UNDER"
                                                  ? "chart-line"
                                                  : item.optionKey === "YES" ||
                                                      item.optionKey === "NO"
                                                    ? "help-circle-outline"
                                                    : "checkbox-blank-circle-outline"
                                          }
                                          size={18}
                                          color={THEME.textSecondary}
                                        />
                                      </View>
                                    )}
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <Text
                                        style={styles.pickerRowTitle}
                                        numberOfLines={1}
                                      >
                                        {item.label}
                                      </Text>
                                      <Text
                                        style={styles.pickerRowSub}
                                        numberOfLines={1}
                                      >
                                        Cuota {item.odds.toFixed(3)}
                                      </Text>
                                    </View>
                                    {selected ? (
                                      <Ionicons
                                        name="checkmark-circle"
                                        size={20}
                                        color={THEME.gold}
                                      />
                                    ) : (
                                      <View style={styles.radioSmall} />
                                    )}
                                  </TouchableOpacity>
                                );
                              }}
                              ListEmptyComponent={
                                <View style={{ paddingVertical: 18 }}>
                                  <Text style={styles.emptyText}>
                                    Sin resultados
                                  </Text>
                                </View>
                              }
                            />
                          </View>
                        </View>
                      </Modal>
                    </>
                  );
                })()
              )}
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyStateWrapper}>
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconWrap}>
                  <MaterialCommunityIcons
                    name={
                      loadError != null ? "cloud-alert-outline" : "crystal-ball"
                    }
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
              const picksCount = group.questions.filter(
                (q) => q.user_option_id != null,
              ).length;
              const isLocked = new Date() > new Date(group.closes_at);
              const maxPicks =
                String(group.type || "").toUpperCase() === "MONTHLY"
                  ? MAX_PICKS_MONTHLY
                  : MAX_PICKS_MATCH;
              const sortedQuestions = [...group.questions].sort((a, b) => {
                const order: Record<string, number> = {
                  HARD: 0,
                  MEDIUM: 1,
                  EASY: 2,
                };
                const da = a.difficulty ? (order[a.difficulty] ?? 2) : 2;
                const db = b.difficulty ? (order[b.difficulty] ?? 2) : 2;
                return da - db;
              });

              return (
                <View key={group.id}>
                  {group.match ? (
                    <View style={styles.groupMetaCard}>
                      <View style={styles.groupMetaIcon}>
                        <MaterialCommunityIcons
                          name="soccer"
                          size={18}
                          color={THEME.gold}
                        />
                      </View>
                      <View style={styles.groupMetaText}>
                        <Text style={styles.groupMatchDate}>
                          {new Date(group.match.date_time).toLocaleDateString(
                            "es-AR",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                          {group.match.location_name
                            ? ` · ${group.match.location_name}`
                            : ""}
                        </Text>
                        <Text style={styles.closesAt}>
                          Cierra{" "}
                          {new Date(group.closes_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
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
                        <MaterialCommunityIcons
                          name="calendar"
                          size={18}
                          color={THEME.gold}
                        />
                      </View>
                      <View style={styles.groupMetaText}>
                        <Text style={styles.groupMatchDate}>
                          {group.period_key
                            ? `Mes: ${group.period_key}`
                            : "Prode mensual"}
                        </Text>
                        <Text style={styles.closesAt}>
                          Cierra{" "}
                          {new Date(group.closes_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
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

                  {sortedQuestions.map((q) =>
                    (() => {
                      const isMonthlyGroup =
                        String(group.type || "").toUpperCase() === "MONTHLY";
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
                          rewardValue={
                            isMonthlyGroup ? monthlyReward : q.points_reward
                          }
                        />
                      );
                    })(),
                  )}
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
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={THEME.gold}
                />
                <Text style={styles.infoModalTitle}>
                  {activeTab === "match"
                    ? "Cómo funciona el Prode de partido"
                    : activeTab === "monthly"
                      ? "Cómo funciona el Prode mensual"
                      : "Cómo funcionan las Apuestas"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalBody}>
              {activeTab === "match" ? (
                <>
                  El Prode de partido se habilita cuando el partido está listo
                  para votar.{"\n\n"}
                  Podés elegir hasta{" "}
                  <Text style={styles.monthlyTooltipStrong}>
                    {MAX_PICKS_MATCH}
                  </Text>{" "}
                  predicciones por fecha y cambiar tu elección mientras siga
                  abierto.{"\n\n"}
                  Se cierra automáticamente al horario de inicio del partido.
                </>
              ) : activeTab === "monthly" ? (
                <>
                  Se abre el{" "}
                  <Text style={styles.monthlyTooltipStrong}>día 1</Text> de cada
                  mes y podés votar hasta el{" "}
                  <Text style={styles.monthlyTooltipStrong}>día 10</Text>.
                  {"\n\n"}
                  Desde el{" "}
                  <Text style={styles.monthlyTooltipStrong}>día 11</Text> queda
                  cerrado.{"\n\n"}
                  Las recompensas en{" "}
                  <Text style={styles.monthlyTooltipStrong}>TTP</Text> se
                  otorgan automáticamente el{" "}
                  <Text style={styles.monthlyTooltipStrong}>
                    día 1 del mes siguiente
                  </Text>
                  .
                </>
              ) : activeTab === "bets" ? (
                <>
                  Las apuestas son{" "}
                  <Text style={styles.monthlyTooltipStrong}>
                    contra la casa
                  </Text>
                  : cada selección tiene una cuota (dinámica) y si acertás,
                  cobrás{" "}
                  <Text style={styles.monthlyTooltipStrong}>monto × cuota</Text>
                  .{"\n\n"}
                  Podés armar una{" "}
                  <Text style={styles.monthlyTooltipStrong}>combinada</Text> de
                  hasta <Text style={styles.monthlyTooltipStrong}>5</Text>{" "}
                  selecciones (1 por mercado). La cuota total es el{" "}
                  <Text style={styles.monthlyTooltipStrong}>producto</Text> de
                  las cuotas.{"\n\n"}
                  Importante: si{" "}
                  <Text style={styles.monthlyTooltipStrong}>jugás</Text> el
                  partido, no podés apostar. Si vas de{" "}
                  <Text style={styles.monthlyTooltipStrong}>espectador</Text>,
                  sí podés.
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
  radioSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  // --- Apuestas (UI) ---
  betsModeWrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  betsModeControl: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  betsModeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  betsModeTabActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  betsModeText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  betsModeTextActive: {
    color: Colors.textPrimary,
  },
  betMarketCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  myBetsCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.18)",
    marginBottom: 12,
  },
  myBetsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  myBetsTitle: {
    color: THEME.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  myBetsSub: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  myBetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  myBetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  myBetMeta: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  myBetLegs: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  myBetRight: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  myBetPayoutLabel: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  myBetPayoutValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  statusPill: {
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    color: "#111827",
  },
  statusOpen: { backgroundColor: "rgba(255,255,255,0.18)" },
  statusWon: { backgroundColor: "rgba(16,185,129,0.85)" },
  statusLost: { backgroundColor: "rgba(239,68,68,0.85)" },
  statusVoid: { backgroundColor: "rgba(245,158,11,0.85)" },
  betMarketHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  betMarketTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  betMarketSub: {
    color: THEME.textSecondary,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  betChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  betChipActive: {
    backgroundColor: THEME.gold,
    borderColor: "rgba(255,255,255,0.18)",
  },
  betChipText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "900",
  },
  betChipTextActive: {
    color: "#111827",
  },
  betsBottomBar: {
    position: "absolute",
    left: 5,
    right: 5,
    paddingBottom: 0,
    alignItems: "stretch",
  },
  stakeTapArea: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
  },
  stakeTapText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  stakeSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  stakeSheetCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stakeSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stakeSheetTitle: {
    color: Colors.textPrimary,
    fontWeight: "900",
    fontSize: 14,
  },
  stakeSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  stakeSheetInput: {
    flex: 1,
    color: "white",
    fontWeight: "900",
    fontSize: 18,
    paddingVertical: 0,
  },
  stakeSheetUnit: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  stakeSheetMetaRow: {
    marginTop: 10,
    marginBottom: 12,
  },
  stakeSheetMeta: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  stakeSheetConfirmBtn: {
    height: 46,
    borderRadius: 16,
    backgroundColor: THEME.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  stakeSheetConfirmText: {
    color: "#111827",
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  betsBottomCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
    width: "100%",
  },
  betsFooterActionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  betsFooterTopControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stakeField: {
    flex: 1,
    minWidth: 0,
  },
  stakeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  betsStakeInput: {
    flex: 1,
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "left",
    paddingVertical: 0,
  },
  betsPrimaryBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: THEME.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  betsPrimaryText: {
    color: "#111827",
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  betsFooterSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  betsFooterSummaryCol: {
    flex: 1,
    minWidth: 0,
  },
  betsFooterDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginHorizontal: 10,
  },
  betsFooterLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  betsFooterValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  betsFooterValueGold: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "900",
  },
  betsFooterError: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
  },
  betsFooterMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.20)",
  },
  balancePillLabel: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  balancePillValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  balancePillUnit: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pickerTitle: {
    color: Colors.textPrimary,
    fontWeight: "900",
    fontSize: 14,
  },
  betsPickerSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: Colors.surfaceDark,
    marginBottom: 10,
  },
  betsPickerSearchInput: {
    flex: 1,
    color: "white",
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 8,
  },
  pickerRowSelected: {
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  pickerIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pickerRowTitle: {
    color: Colors.textPrimary,
    fontWeight: "900",
    fontSize: 13,
  },
  pickerRowSub: {
    color: THEME.textSecondary,
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
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
