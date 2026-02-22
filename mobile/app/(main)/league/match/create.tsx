import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useGlobalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const AI_CARD_THEME = {
  bg: "#1E1B4B",
  border: "#4338ca",
  gold: "#F59E0B",
  textSub: "#C7D2FE",
};
import { Colors } from "../../../../src/constants/Colors";
import apiClient from "../../../../src/api/apiClient";
import { LoadingOverlay } from "../../../../src/components/ui/LoadingOverlay";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { AppCard } from "../../../../src/components/ui/AppCard";
import { DateTimePickerButton } from "../../../../src/components/ui/DateTimePickerButton";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { z } from "zod";

const createSchema = z.object({
  location: z.string().min(1, "Ubicación es obligatoria"),
  dateTime: z
    .date()
    .refine(
      (d) => d.getTime() >= new Date().setHours(0, 0, 0, 0),
      "La fecha no puede ser pasada",
    ),
  price: z
    .string()
    .min(1, "Precio es obligatorio")
    .refine(
      (v) => /^\d+(\.\d+)?$/.test(v.replace(",", ".")),
      "Debe ser un número",
    )
    .transform((v) => parseFloat(v.replace(",", ".")))
    .refine((n) => n > 0, "El precio debe ser positivo"),
});

type CreateFormState = {
  location: string;
  dateTime: Date;
  price: string;
  rivalType: "INTERNAL" | "EXTERNAL";
};

function getInitialDate(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  return d;
}

type CreateMatchHeaderProps = {
  form: CreateFormState;
  touched: Record<string, boolean>;
  errors: Record<string, string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  updateForm: (u: Partial<CreateFormState>) => void;
  setTouched: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleRivalTypeChange: (t: "INTERNAL" | "EXTERNAL") => void;
};

const CreateMatchHeader = React.memo(function CreateMatchHeader({
  form,
  touched,
  errors,
  searchQuery,
  onSearchChange,
  updateForm,
  setTouched,
  handleRivalTypeChange,
}: CreateMatchHeaderProps) {
  return (
    <>
      <View style={styles.sectionHeaderBox}>
        <Text style={styles.sectionHeader}>DETALLES DEL ENCUENTRO</Text>
      </View>
      <AppCard style={styles.cardForm}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>UBICACIÓN</Text>
          <View
            style={[
              styles.inputContainer,
              touched.location && errors.location && styles.inputError,
            ]}
          >
            <Ionicons name="location-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(t) => updateForm({ location: t })}
              onBlur={() => setTouched((p) => ({ ...p, location: true }))}
              placeholder="Ej: Canchas del Centro"
              placeholderTextColor="#4B5563"
              testID="e2e-match-create-location"
            />
          </View>
          {touched.location && errors.location ? (
            <Text style={styles.helperError}>{errors.location}</Text>
          ) : null}
        </View>
        <DateTimePickerButton
          value={form.dateTime}
          onChange={(d) => updateForm({ dateTime: d })}
          onConfirm={() => setTouched((p) => ({ ...p, dateTime: true }))}
          minimumDate={new Date()}
          label="FECHA Y HORA"
          error={touched.dateTime ? errors.dateTime : undefined}
          testID="e2e-match-create-datetime"
        />
        <View style={styles.inputGroup}>
          <Text style={styles.label}>PRECIO POR JUGADOR</Text>
          <View
            style={[
              styles.inputContainer,
              touched.price && errors.price && styles.inputError,
            ]}
          >
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.input}
              value={form.price}
              onChangeText={(t) => updateForm({ price: t })}
              onBlur={() => setTouched((p) => ({ ...p, price: true }))}
              placeholder="0"
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
              testID="e2e-match-create-price"
            />
          </View>
          {touched.price && errors.price ? (
            <Text style={styles.helperError}>{errors.price}</Text>
          ) : null}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>MODALIDAD</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, form.rivalType === "INTERNAL" && styles.toggleBtnActive]}
              onPress={() => handleRivalTypeChange("INTERNAL")}
            >
              <Text style={[styles.toggleText, form.rivalType === "INTERNAL" && { color: "white" }]}>
                INTERNO
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, form.rivalType === "EXTERNAL" && styles.toggleBtnActive]}
              onPress={() => handleRivalTypeChange("EXTERNAL")}
            >
              <Text style={[styles.toggleText, form.rivalType === "EXTERNAL" && { color: "white" }]}>
                EXTERNO
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppCard>
      <View style={styles.sectionHeaderBox}>
        <Text style={styles.sectionHeader}>CONVOCAR JUGADORES</Text>
      </View>
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
          <Text style={styles.legendText}>
            {form.rivalType === "EXTERNAL" ? "CONVOCADO" : "EQUIPO A (LOCAL)"}
          </Text>
        </View>
        {form.rivalType === "INTERNAL" && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>EQUIPO B (VISITA)</Text>
          </View>
        )}
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Buscar por nombre..."
          placeholderTextColor="#6B7280"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
});

export default function CreateMatchScreen() {
  const router = useRouter();
  const { leagueId } = useGlobalSearchParams();
  const { showAlert } = useCustomAlert();
  const leagueIdStr = Array.isArray(leagueId) ? leagueId[0] : leagueId;

  const [form, setForm] = useState<CreateFormState>({
    location: "",
    dateTime: getInitialDate(),
    price: "",
    rivalType: "INTERNAL",
  });
  const [players, setPlayers] = useState<
    Array<{ id: string; name: string; photo: string | null; status: string }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const updateForm = (updates: Partial<CreateFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const validation = useMemo(() => {
    const result = createSchema.safeParse({
      location: form.location.trim(),
      dateTime: form.dateTime,
      price: form.price,
    });
    if (result.success) return { success: true as const, errors: {} };
    const errors: Record<string, string> = {};
    const err = result.error as { errors?: unknown[]; issues?: unknown[] } | undefined;
    const errList = err?.issues ?? err?.errors ?? [];
    (Array.isArray(errList) ? errList : []).forEach((e: unknown) => {
      const item = e as { path?: (string | number)[]; message?: string };
      const path = Array.isArray(item.path) ? item.path[0] : item.path;
      if (path != null && item.message) errors[String(path)] = item.message;
    });
    return { success: false, errors };
  }, [form.location, form.dateTime, form.price]);

  const formValid = validation.success;
  const errors = validation.success ? {} : validation.errors;

  useEffect(() => {
    let cancelled = false;
    const fetchMembers = async () => {
      if (!leagueIdStr) return;
      try {
        const response = await apiClient.get(
          `/leagues/${leagueIdStr}/members`,
        );
        if (cancelled) return;
        const members = response.data.map((m: any) => ({
          id: m.user_id,
          name: m.users?.full_name || "Sin Nombre",
          photo: m.users?.profile_photo_url || null,
          status: "NONE",
        }));
        setPlayers(members);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 429) {
          showAlert(
            "Demasiadas peticiones",
            "Espera un momento y vuelve a entrar a esta pantalla.",
            [{ text: "Entendido" }]
          );
        }
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [leagueIdStr]);

  const handleRivalTypeChange = (type: "INTERNAL" | "EXTERNAL") => {
    updateForm({ rivalType: type });
    if (type === "EXTERNAL") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.status === "VISITANTE" ? { ...p, status: "NONE" } : p,
        ),
      );
    }
  };

  const togglePlayerStatus = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        if (form.rivalType === "EXTERNAL") {
          return { ...p, status: p.status === "NONE" ? "LOCAL" : "NONE" };
        }
        if (p.status === "NONE") return { ...p, status: "LOCAL" };
        if (p.status === "LOCAL") return { ...p, status: "VISITANTE" };
        return { ...p, status: "NONE" };
      }),
    );
  };

  const handleCreateMatch = async () => {
    if (!leagueIdStr || !formValid) return;
    const selectedPlayers = players.filter((p) => p.status !== "NONE");
    if (selectedPlayers.length === 0) {
      showAlert("Atención", "Debes convocar al menos un jugador.");
      return;
    }
    setTouched({ location: true, dateTime: true, price: true });
    setIsSubmitting(true);
    try {
      const parsed = createSchema.parse({
        location: form.location.trim(),
        dateTime: form.dateTime,
        price: form.price,
      });
      const playersPayload = selectedPlayers.map((p) => ({
        id: p.id,
        team: p.status === "LOCAL" ? "A" : "B",
      }));
      await apiClient.post("/match/create", {
        leagueId: leagueIdStr,
        location: parsed.location,
        dateTime: parsed.dateTime.toISOString(),
        price: parsed.price,
        players: playersPayload,
      });
      showAlert("¡Éxito!", "Partido creado correctamente.", [
        { text: "Volver", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg =
        err.response?.data?.error || err.message || "Error al crear partido";
      showAlert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = players.filter((p) => p.status !== "NONE").length;
  const canSubmit = formValid && selectedCount > 0 && !isSubmitting;

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => (p.name || "").toLowerCase().includes(q));
  }, [players, searchQuery]);

  const listHeaderElement = (
    <CreateMatchHeader
      form={form}
      touched={touched}
      errors={errors}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      updateForm={updateForm}
      setTouched={setTouched}
      handleRivalTypeChange={handleRivalTypeChange}
    />
  );

  const ListFooterComponent = useCallback(
    () => (
      <>
        <View style={styles.aiCardContainer}>
          <View style={styles.aiComingSoonBadge}>
            <Ionicons name="hourglass-outline" size={10} color={AI_CARD_THEME.gold} />
            <Text style={styles.aiComingSoonText}>PRÓXIMAMENTE</Text>
          </View>
          <View style={styles.aiContentRow}>
            <View style={styles.aiIconContainer}>
              <Ionicons name="hardware-chip" size={30} color={AI_CARD_THEME.gold} />
              <View style={styles.aiSparkle}>
                <MaterialCommunityIcons name="star-four-points" size={12} color="white" />
              </View>
            </View>
            <View style={styles.aiTextContainer}>
              <Text style={styles.aiCardTitle}>
                IA TEAM BUILDER <Text style={{ color: AI_CARD_THEME.gold, fontWeight: "900" }}>PRO</Text>
              </Text>
              <Text style={styles.aiCardDescription}>
                Únete al plan PRO para que la IA arme los equipos estadísticamente perfectos según tus gustos.
              </Text>
            </View>
          </View>
          <View style={styles.aiTechGrid} />
          <View style={styles.aiTechCircle} />
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
            onPress={handleCreateMatch}
            disabled={!canSubmit}
            activeOpacity={0.8}
            testID="e2e-match-create-submit"
          >
            <Ionicons name="checkmark-circle" size={24} color={Colors.background} style={{ marginRight: 8 }} />
            <Text style={styles.createButtonText}>
              {isSubmitting ? "CREANDO…" : "CONFIRMAR PARTIDO"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </>
    ),
    [canSubmit, isSubmitting, handleCreateMatch]
  );

  const PLAYER_ROW_HEIGHT = 48;
  const VISIBLE_ROWS = 10;
  const playerListHeight = PLAYER_ROW_HEIGHT * VISIBLE_ROWS;

  const renderPlayerRow = useCallback(
    (item: typeof players[0], index: number) => {
      const isLocal = item.status === "LOCAL";
      const isVisita = item.status === "VISITANTE";
      const statusColor = isLocal
        ? form.rivalType === "EXTERNAL"
          ? "#10B981"
          : "#3B82F6"
        : isVisita
          ? "#EF4444"
          : "#374151";
      const isSelected = isLocal || isVisita;
      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.playerRow, isSelected && { backgroundColor: `${statusColor}18` }]}
          onPress={() => togglePlayerStatus(item.id)}
          activeOpacity={0.7}
          testID={index === 0 ? "e2e-match-create-first-player" : undefined}
        >
          <UserAvatar imageUrl={item.photo} name={item.name} size={28} />
          <Text
            style={[styles.playerRowName, isSelected && { color: "white", fontWeight: "700" }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View style={[styles.checkWrap, isSelected && { borderColor: statusColor }]}>
            {isSelected ? (
              <Ionicons name="checkmark" size={14} color={statusColor} />
            ) : (
              <View />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [form.rivalType, togglePlayerStatus]
  );

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={isSubmitting} message="Creando partido..." />
      <ScreenHeader title="NUEVO PARTIDO" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {listHeaderElement}
          <View style={[styles.playerListBox, { height: playerListHeight }]}>
            <ScrollView
              style={styles.playerListScroll}
              contentContainerStyle={styles.playerListContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {filteredPlayers.map((item, index) => renderPlayerRow(item, index))}
            </ScrollView>
          </View>
          {ListFooterComponent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { padding: 20 },
  sectionHeaderBox: { marginBottom: 15, marginTop: 10 },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardForm: { marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg || "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 15,
    height: 50,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "white", fontSize: 14, fontWeight: "600" },
  helperError: {
    color: Colors.error,
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
  },
  currencyPrefix: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 5,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: Colors.inputBg || "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    height: 50,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#374151" },
  toggleText: { color: "#6B7280", fontSize: 11, fontWeight: "800" },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
    gap: 20,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: "#9CA3AF", fontSize: 10, fontWeight: "700" },
  playerListBox: {
    marginBottom: 8,
  },
  playerListScroll: {
    flexGrow: 0,
  },
  playerListContent: {
    paddingBottom: 8,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  playerRowName: {
    flex: 1,
    marginLeft: 10,
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 25,
  },
  playerCard: {
    width: "31%",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: 5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#374151",
    marginBottom: 8,
  },
  playerName: {
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  playerStatus: { fontSize: 9, fontWeight: "800" },
  aiCardContainer: {
    backgroundColor: "#1E1B4B",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#4338ca",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#4338ca",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  aiComingSoonBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    zIndex: 10,
    gap: 4,
  },
  aiComingSoonText: {
    color: "#F59E0B",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  aiContentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    zIndex: 2,
  },
  aiIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(67, 56, 202, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(67, 56, 202, 0.5)",
    position: "relative",
  },
  aiSparkle: {
    position: "absolute",
    top: -6,
    right: -6,
    opacity: 0.9,
  },
  aiTextContainer: { flex: 1, paddingRight: 10 },
  aiCardTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aiCardDescription: {
    color: "#C7D2FE",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
  },
  aiTechGrid: {
    position: "absolute",
    bottom: -30,
    right: -20,
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    transform: [{ rotate: "15deg" }],
    zIndex: 1,
  },
  aiTechCircle: {
    position: "absolute",
    bottom: -20,
    right: -10,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 15,
    borderColor: "rgba(245, 158, 11, 0.03)",
    zIndex: 1,
  },
  footer: { marginTop: 10 },
  createButton: {
    backgroundColor: Colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "white",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: {
    color: Colors.background,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
