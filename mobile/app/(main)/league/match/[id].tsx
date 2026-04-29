import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import apiClient from "../../../../src/api/apiClient";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { MatchScoreBoard } from "../../../../src/components/match/MatchScoreBoard";
import { MatchStatusCard } from "../../../../src/components/match/MatchStatusCard";
import { PlayerAccordionGrid } from "../../../../src/components/match/PlayerAccordionGrid";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";
import { z } from "zod";

const THEME = {
  bg: Colors.background,
  cardBg: "#1F2937",
  cardBorder: "rgba(255,255,255,0.08)",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  accentGold: "#F59E0B",
  accentGreen: "#10B981",
  accentBlue: Colors.primary,
  danger: "#EF4444",
  purple: "#8B5CF6",
};

const editSchema = z.object({
  location: z.string().min(1, "Ubicación es obligatoria"),
  dateTime: z.date(),
  price: z
    .string()
    .min(1, "Precio es obligatorio")
    .refine((v) => /^\d+(\.\d+)?$/.test(v.replace(",", ".")), "Debe ser un número")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .refine((n) => n >= 0, "El precio no puede ser negativo"),
  scoreA: z.string().refine((v) => /^\d{0,2}$/.test(v), "0-99").transform((v) => parseInt(v || "0", 10)),
  scoreB: z.string().refine((v) => /^\d{0,2}$/.test(v), "0-99").transform((v) => parseInt(v || "0", 10)),
});

export default function MatchDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; userRole?: string }>();
  const matchId = Array.isArray(params.id) ? params.id[0] : params.id;
  const paramUserRole = Array.isArray(params.userRole) ? params.userRole[0] : params.userRole;
  const router = useRouter();
  const { showAlert } = useCustomAlert();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editDateTime, setEditDateTime] = useState<Date>(new Date());
  const [editPrice, setEditPrice] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [userRole, setUserRole] = useState<string>("MEMBER");
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);

  const getConsumableVisual = useCallback(
    (consumableKey?: string | null): { icon: keyof typeof Ionicons.glyphMap; color: string } => {
      const key = String(consumableKey ?? "").toLowerCase();
      if (key.includes("shield")) return { icon: "shield-checkmark", color: "#34D399" };
      if (key.includes("duel")) return { icon: "flame", color: "#F97316" };
      if (key.includes("prode") || key.includes("prediction")) {
        return { icon: "stats-chart", color: "#60A5FA" };
      }
      if (key.includes("spectator")) return { icon: "eye", color: "#C084FC" };
      return { icon: "flash", color: "#F59E0B" };
    },
    [],
  );

  const fetchDetails = useCallback(async () => {
    try {
      if (!matchId) return;
      const res = await apiClient.get(`/match/${matchId}/details`);
      setMatch(res.data);
      const fromApi = (res.data.userRole || "MEMBER").toString().toUpperCase();
      // Si vinimos de Gestionar, el param userRole es fiable (ADMIN/OWNER)
      const fromParam = (paramUserRole ?? "").toString().toUpperCase();
      const role =
        fromParam === "ADMIN" || fromParam === "OWNER" ? fromParam : fromApi;
      setUserRole(role);
      setEditLocation(res.data.location_name ?? "");
      setEditPrice(res.data.price_per_player?.toString() ?? "");
      setScoreA(res.data.team_a_score?.toString() ?? "0");
      setScoreB(res.data.team_b_score?.toString() ?? "0");
      setEditDateTime(res.data.date_time ? new Date(res.data.date_time) : new Date());
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      const is404 = status === 404;
      if (is404) {
        showAlert(
          "Partido no encontrado",
          "Este partido no existe o fue eliminado.",
          [{ text: "Volver", onPress: () => router.replace("/(main)/league/match") }]
        );
      } else {
        showAlert(
          "Error",
          formatUserFacingError(err, "No se cargaron los detalles."),
          undefined,
          "error",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId, router]);

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [fetchDetails])
  );

  const loadAllMembersForEdit = useCallback(async () => {
    if (!match?.league_id) return;
    try {
      const res = await apiClient.get(`/leagues/${match.league_id}/members`);
      const merged = res.data.map((m: any) => {
        const userId = m.user_id || m.id;
        const existing = match.match_players?.find((p: any) => p.user_id === userId);
        let status = "NONE";
        if (existing) {
          status = match.is_external
            ? "CONVOCADO"
            : existing.team === "A"
              ? "LOCAL"
              : "VISITANTE";
        }
        return {
          id: userId,
          name: m.users?.full_name || m.users?.username || m.full_name || "Sin Nombre",
          photo: m.users?.profile_photo_url ?? m.profile_photo_url,
          status,
        };
      });
      setAllMembers(merged);
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "Fallo al cargar miembros."),
        undefined,
        "error",
      );
    }
  }, [match, showAlert]);

  const toggleEditMode = useCallback(() => {
    if (!isEditing) {
      loadAllMembersForEdit();
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isEditing, loadAllMembersForEdit]);

  const togglePlayerStatus = useCallback((userId: string) => {
    setAllMembers((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(userId)) return p;
        if (match?.is_external)
          return { ...p, status: p.status === "NONE" ? "CONVOCADO" : "NONE" };
        if (p.status === "NONE") return { ...p, status: "LOCAL" };
        if (p.status === "LOCAL") return { ...p, status: "VISITANTE" };
        return { ...p, status: "NONE" };
      })
    );
  }, [match?.is_external]);

  const validation = useMemo(() => {
    const result = editSchema.safeParse({
      location: editLocation.trim(),
      dateTime: editDateTime,
      price: editPrice,
      scoreA,
      scoreB,
    });
    if (result.success) return { success: true as const, errors: {} as Record<string, string> };
    const errors: Record<string, string> = {};
    const err = result.error as { errors?: unknown[]; issues?: unknown[] } | undefined;
    const errList = err?.issues ?? err?.errors ?? [];
    (Array.isArray(errList) ? errList : []).forEach((e: unknown) => {
      const item = e as { path?: (string | number)[]; message?: string };
      const path = Array.isArray(item.path) ? item.path[0] : item.path;
      if (path != null && item.message) errors[String(path)] = item.message;
    });
    return { success: false, errors };
  }, [editLocation, editDateTime, editPrice, scoreA, scoreB]);

  const editValid = validation.success;
  const errors = validation.success ? {} : validation.errors;

  const handleSaveChanges = useCallback(async () => {
    setTouched({ location: true, dateTime: true, price: true });
    if (!editValid || !matchId) return;
    setSaving(true);
    try {
      const parsed = editSchema.parse({
        location: editLocation.trim(),
        dateTime: editDateTime,
        price: editPrice,
        scoreA,
        scoreB,
      });
      const playersPayload = allMembers
        .filter((p) => p.status !== "NONE")
        .map((p) => ({
          user_id: p.id,
          team:
            match?.is_external || p.status === "LOCAL" || p.status === "CONVOCADO" ? "A" : "B",
        }));
      await apiClient.put(`/match/${matchId}`, {
        location: parsed.location,
        dateTime: parsed.dateTime.toISOString(),
        price: parsed.price,
        players: playersPayload,
        teamAScore: parsed.scoreA,
        teamBScore: parsed.scoreB,
      });
      showAlert("Éxito", "Cambios guardados.");
      setIsEditing(false);
      fetchDetails();
    } catch (e: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(e, "No se pudo guardar."),
        undefined,
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    editValid,
    matchId,
    editLocation,
    editDateTime,
    editPrice,
    scoreA,
    scoreB,
    allMembers,
    match?.is_external,
    fetchDetails,
  ]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      try {
        if (newStatus === "FINISHED" || newStatus === "COMPLETED") {
          setTargetStatus(newStatus);
          setScoreModalVisible(true);
          return;
        }
        await apiClient.put(`/match/${matchId}/status`, { status: newStatus });
        fetchDetails();
      } catch (e: unknown) {
        showAlert(
          "Error",
          formatUserFacingError(e, "No se pudo cambiar estado."),
          undefined,
          "error",
        );
      }
    },
    [matchId, fetchDetails, showAlert]
  );

  const submitStatusWithScore = useCallback(async () => {
    if (!matchId || !targetStatus) return;
    const a = Number.parseInt(scoreA || "0", 10);
    const b = Number.parseInt(scoreB || "0", 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
      showAlert("Resultado inválido", "Ingresa goles válidos (0 o más).");
      return;
    }
    setAdminBusy(true);
    try {
      await apiClient.put(`/match/${matchId}/status`, {
        status: targetStatus,
        teamAScore: a,
        teamBScore: b,
      });
      setScoreModalVisible(false);
      setTargetStatus(null);
      fetchDetails();
    } catch (err: unknown) {
      showAlert(
        "Error",
        formatUserFacingError(err, "No se pudo avanzar de fase."),
        undefined,
        "error",
      );
    } finally {
      setAdminBusy(false);
    }
  }, [matchId, targetStatus, scoreA, scoreB, showAlert, fetchDetails]);

  const handleAdminConfirmAll = useCallback(async () => {
    if (!matchId) return;
    showAlert("Confirmar a todos", "¿Confirmar asistencia de todos los pendientes?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setAdminBusy(true);
          try {
            await apiClient.post(`/match/${matchId}/admin/confirm-all`, {});
            fetchDetails();
          } catch (err: unknown) {
            showAlert(
              "Error",
              formatUserFacingError(err, "No se pudo confirmar."),
              undefined,
              "error",
            );
          } finally {
            setAdminBusy(false);
          }
        },
      },
    ]);
  }, [matchId, showAlert, fetchDetails]);

  const handleAdminConfirmOne = useCallback(
    async (userId: string, name?: string) => {
      if (!matchId) return;
      showAlert("Confirmar asistencia", `¿Confirmar a ${name || "este jugador"}?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setAdminBusy(true);
            try {
              await apiClient.post(`/match/${matchId}/admin/confirm-player`, { userId });
              fetchDetails();
            } catch (err: unknown) {
              showAlert(
                "Error",
                formatUserFacingError(err, "No se pudo confirmar."),
                undefined,
                "error",
              );
            } finally {
              setAdminBusy(false);
            }
          },
        },
      ]);
    },
    [matchId, showAlert, fetchDetails],
  );

  const handleAdminRemoveSpectator = useCallback(
    async (userId: string, name?: string) => {
      if (!matchId) return;
      showAlert("Eliminar espectador", `¿Quitar a ${name || "este espectador"}?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setAdminBusy(true);
            try {
              await apiClient.post(`/match/${matchId}/admin/remove-spectator`, { userId });
              fetchDetails();
            } catch (err: unknown) {
              showAlert(
                "Error",
                formatUserFacingError(err, "No se pudo eliminar."),
                undefined,
                "error",
              );
            } finally {
              setAdminBusy(false);
            }
          },
        },
      ]);
    },
    [matchId, showAlert, fetchDetails],
  );

  if (loading && !match) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
        <View style={styles.header}>
          <Skeleton width="100%" height={56} borderRadius={12} style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.paddingH}>
            <Skeleton width="100%" height={380} borderRadius={20} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!match) return null;

  const confirmed = match.match_players?.filter((p: any) => p.has_confirmed) ?? [];
  const pending = match.match_players?.filter((p: any) => !p.has_confirmed) ?? [];
  const spectators = Array.isArray(match.spectators) ? match.spectators : [];
  const canSave = editValid && !saving;

  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";
  const showFinalizeCta = isAdminOrOwner && !isEditing && match.status === "ACTIVE";

  // Progreso de votación (solo cuando está en estado VOTANDO)
  const isVoting = match.status === "FINISHED";
  const totalPlayers = match.match_players?.length ?? 0;
  const votersCount = match.match_players?.filter((p: any) => p.has_voted).length ?? 0;
  const pendingVotes = totalPlayers - votersCount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "MODO EDITOR" : "MATCH CENTER"}
        </Text>
        {isAdminOrOwner ? (
          <TouchableOpacity style={styles.headerAction} onPress={toggleEditMode}>
            <Ionicons
              name={isEditing ? "close" : "pencil"}
              size={22}
              color={isEditing ? THEME.danger : THEME.textPrimary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerAction} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <Modal
          visible={scoreModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!adminBusy) setScoreModalVisible(false);
          }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!adminBusy) setScoreModalVisible(false);
            }}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Resultado del partido</Text>
              <Text style={styles.modalSubtitle}>
                Para pasar a {targetStatus === "FINISHED" ? "VOTACIÓN" : "CIERRE"} debes cargar el resultado.
              </Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>LOCAL</Text>
                  <TextInput
                    value={scoreA}
                    onChangeText={setScoreA}
                    keyboardType="number-pad"
                    style={styles.scoreInput}
                    editable={!adminBusy}
                  />
                </View>
                <Text style={styles.scoreDash}>-</Text>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>VISITA</Text>
                  <TextInput
                    value={scoreB}
                    onChangeText={setScoreB}
                    keyboardType="number-pad"
                    style={styles.scoreInput}
                    editable={!adminBusy}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, adminBusy && { opacity: 0.6 }]}
                onPress={submitStatusWithScore}
                disabled={adminBusy}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="white" />
                <Text style={styles.primaryBtnText}>
                  {adminBusy ? "GUARDANDO…" : "GUARDAR Y CONTINUAR"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => !adminBusy && setScoreModalVisible(false)}
                disabled={adminBusy}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDetails();
              }}
              tintColor={THEME.accentBlue}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.paddingH}>
            <MatchScoreBoard
              match={match}
              isEditing={isEditing}
              scoreA={scoreA}
              setScoreA={setScoreA}
              scoreB={scoreB}
              setScoreB={setScoreB}
              editLocation={editLocation}
              setEditLocation={setEditLocation}
              editDateTime={editDateTime}
              setEditDateTime={setEditDateTime}
              editPrice={editPrice}
              setEditPrice={setEditPrice}
              errors={errors}
              touched={touched}
              onDateConfirm={() => setTouched((p) => ({ ...p, dateTime: true }))}
              onTouch={(field) => setTouched((p) => ({ ...p, [field]: true }))}
            />
          </View>

          {!isEditing && (
            <MatchStatusCard
              status={match.status ?? "OPEN"}
              isAdmin={isAdminOrOwner}
              onStatusChange={isAdminOrOwner ? handleStatusChange : undefined}
            />
          )}

          {/* CTA destacado: finalizar partido -> votar */}
          {showFinalizeCta && (
            <TouchableOpacity
              style={styles.finalizeCta}
              onPress={() => {
                setTargetStatus("FINISHED");
                setScoreModalVisible(true);
              }}
              activeOpacity={0.9}
              disabled={adminBusy}
            >
              <View style={styles.finalizeIcon}>
                <Ionicons name="flag" size={20} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.finalizeTitle}>PARTIDO FINALIZADO</Text>
                <Text style={styles.finalizeSubtitle}>Cargar resultado y abrir votación</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* Progreso de votación: solo visible para admin cuando el partido está en VOTACIÓN */}
          {!isEditing && isAdminOrOwner && isVoting && (
            <TouchableOpacity
              style={styles.votingProgressCard}
              onPress={() => router.push(`/(main)/league/match/vote?matchId=${matchId}`)}
              activeOpacity={0.85}
            >
              <View style={styles.votingProgressHeader}>
                <View style={styles.votingProgressIconWrap}>
                  <Ionicons name="star" size={18} color="#FBBF24" />
                </View>
                <Text style={styles.votingProgressTitle}>PROGRESO DE VOTACIÓN</Text>
                <Ionicons name="chevron-forward" size={18} color="#6B7280" />
              </View>
              <View style={styles.votingProgressBarBg}>
                <View
                  style={[
                    styles.votingProgressBarFill,
                    {
                      width: `${totalPlayers > 0 ? (votersCount / totalPlayers) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.votingProgressStats}>
                <View style={styles.votingStatItem}>
                  <Ionicons name="checkmark-circle" size={16} color={THEME.accentGreen} />
                  <Text style={[styles.votingStatVal, { color: THEME.accentGreen }]}>{votersCount}</Text>
                  <Text style={styles.votingStatLbl}>votaron</Text>
                </View>
                <View style={styles.votingStatDivider} />
                <View style={styles.votingStatItem}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={pendingVotes > 0 ? "#FBBF24" : THEME.accentGreen}
                  />
                  <Text
                    style={[
                      styles.votingStatVal,
                      { color: pendingVotes > 0 ? "#FBBF24" : THEME.accentGreen },
                    ]}
                  >
                    {pendingVotes}
                  </Text>
                  <Text style={styles.votingStatLbl}>faltan</Text>
                </View>
              </View>
              <Text style={styles.votingProgressHint}>Toca para ver la votación</Text>
            </TouchableOpacity>
          )}

          <View style={styles.contentSection}>
            <Text style={styles.sectionHeader}>
              {isEditing ? "GESTIÓN DE JUGADORES" : "CONVOCATORIA"}
            </Text>

            {isEditing ? (
              <View>
                <Text style={styles.helperText}>
                  Toca un jugador para cambiar su estado (Local / Visita / No Citado)
                </Text>
                {allMembers.map((p) => {
                  let badgeStyle = styles.badgeNone;
                  let badgeText = "NO CITADO";
                  if (p.status === "LOCAL") {
                    badgeStyle = styles.badgeLocal;
                    badgeText = "LOCAL";
                  } else if (p.status === "VISITANTE") {
                    badgeStyle = styles.badgeVisita;
                    badgeText = "VISITA";
                  } else if (p.status === "CONVOCADO") {
                    badgeStyle = styles.badgeConvoked;
                    badgeText = "CITADO";
                  }
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.editListRow}
                      onPress={() => togglePlayerStatus(p.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.editListLeft}>
                        <View style={p.status === "NONE" && { opacity: 0.3 }}>
                          <UserAvatar imageUrl={p.photo} name={p.name} size={40} />
                        </View>
                        <Text style={[styles.editListName, p.status === "NONE" && { color: "#555" }]}>
                          {p.name}
                        </Text>
                      </View>
                      <View style={[styles.statusBadgeBtn, badgeStyle]}>
                        <Text style={styles.statusBadgeText}>{badgeText}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                  onPress={handleSaveChanges}
                  disabled={!canSave}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "GUARDANDO…" : "GUARDAR CAMBIOS"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{match.match_players?.length ?? 0}</Text>
                    <Text style={styles.statLbl}>CITADOS</Text>
                  </View>
                  <View style={styles.verticalDiv} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: THEME.accentGreen }]}>{confirmed.length}</Text>
                    <Text style={styles.statLbl}>CONFIRMADOS</Text>
                  </View>
                </View>

                {/* Acciones admin: confirmar pendientes */}
                {isAdminOrOwner && pending.length > 0 && (
                  <View style={styles.adminActionsBox}>
                    <TouchableOpacity
                      style={[styles.smallBtn, adminBusy && { opacity: 0.6 }]}
                      onPress={handleAdminConfirmAll}
                      disabled={adminBusy}
                    >
                      <Ionicons name="checkmark-done" size={16} color="white" />
                      <Text style={styles.smallBtnText}>CONFIRMAR TODOS</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <PlayerAccordionGrid
                  confirmed={confirmed.map((p: any) => ({
                    id: p.user_id ?? p.id,
                    name: p.users?.full_name || p.users?.username || "Jugador",
                    photo: p.users?.profile_photo_url,
                    team: p.team,
                    consumableKey: p.active_consumable?.consumable_key ?? null,
                    consumableIcon: getConsumableVisual(p.active_consumable?.consumable_key).icon,
                    consumableColor: getConsumableVisual(p.active_consumable?.consumable_key).color,
                  }))}
                  pending={pending.map((p: any) => ({
                    id: p.user_id ?? p.id,
                    name: p.users?.full_name || p.users?.username || "Jugador",
                    photo: p.users?.profile_photo_url,
                    team: p.team,
                    consumableKey: p.active_consumable?.consumable_key ?? null,
                    consumableIcon: getConsumableVisual(p.active_consumable?.consumable_key).icon,
                    consumableColor: getConsumableVisual(p.active_consumable?.consumable_key).color,
                  }))}
                  declined={[]}
                  isExternal={match.is_external}
                  totalThresholdForCollapse={15}
                />

                {/* Lista útil para admin: pendientes con confirmación individual */}
                {isAdminOrOwner && pending.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.subHeader}>PENDIENTES</Text>
                    {pending.map((p: any) => {
                      const name = p.users?.full_name || p.users?.username || "Jugador";
                      return (
                        <View key={p.user_id} style={styles.actionRow}>
                          <UserAvatar imageUrl={p.users?.profile_photo_url} name={name} size={40} />
                          <View style={styles.actionRowCenter}>
                            <Text style={styles.rowName}>{name}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.confirmOneBtn, adminBusy && { opacity: 0.6 }]}
                            onPress={() => handleAdminConfirmOne(p.user_id, name)}
                            disabled={adminBusy}
                          >
                            <Text style={styles.confirmOneText}>CONFIRMAR</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ESPECTADORES: visible para admin/owner */}
          {!isEditing && isAdminOrOwner && (
            <View style={[styles.contentSection, styles.spectatorsSection]}>
              <Text style={styles.sectionHeader}>ESPECTADORES</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{spectators.length}</Text>
                  <Text style={styles.statLbl}>CONFIRMADOS</Text>
                </View>
              </View>

              {spectators.length === 0 ? (
                <View style={styles.emptySpectatorsBox}>
                  <Ionicons name="eye-off-outline" size={18} color="#94A3B8" />
                  <Text style={styles.noneText}>Todavía no hay espectadores confirmados</Text>
                </View>
              ) : (
                <View>
                  {spectators.map((s: any) => {
                    const u = s.user ?? s.users ?? {};
                    const name = u.full_name || u.username || "Espectador";
                    return (
                      <View key={s.user_id ?? u.id ?? name} style={styles.spectatorRow}>
                        <UserAvatar imageUrl={u.profile_photo_url} name={name} size={40} />
                        <View style={styles.spectatorRowCenter}>
                          <Text style={styles.rowName}>{name}</Text>
                          {!!u.username && (
                            <Text style={styles.spectatorSub}>@{u.username}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.removeBtn, adminBusy && { opacity: 0.6 }]}
                          onPress={() => handleAdminRemoveSpectator(s.user_id ?? u.id, name)}
                          disabled={adminBusy}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                          <Text style={styles.removeBtnText}>QUITAR</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backBtn: { padding: 5 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "white",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  headerAction: { padding: 5 },
  scrollContent: { paddingBottom: 60 },
  paddingH: { paddingHorizontal: 20 },
  contentSection: { paddingHorizontal: 20 },
  sectionHeader: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 15,
    letterSpacing: 1,
  },
  helperText: {
    color: "#555",
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 15,
  },
  editListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  editListLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  editListName: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
  statusBadgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  statusBadgeText: { fontSize: 10, fontWeight: "900", color: "white" },
  badgeNone: { backgroundColor: "#374151" },
  badgeLocal: { backgroundColor: THEME.accentBlue },
  badgeVisita: { backgroundColor: THEME.purple },
  badgeConvoked: { backgroundColor: THEME.accentGreen },
  saveBtn: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "black", fontWeight: "900", fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    justifyContent: "space-around",
  },
  votingProgressCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  votingProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  votingProgressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  votingProgressTitle: {
    flex: 1,
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  votingProgressBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  votingProgressBarFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  votingProgressStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  votingStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  votingStatVal: {
    fontSize: 18,
    fontWeight: "900",
  },
  votingStatLbl: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },
  votingStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  votingProgressHint: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 10,
    textAlign: "center",
    fontStyle: "italic",
  },
  statItem: { alignItems: "center" },
  statVal: { color: "white", fontSize: 20, fontWeight: "900" },
  statLbl: { color: "#6B7280", fontSize: 9, fontWeight: "bold" },
  verticalDiv: { width: 1, backgroundColor: "#374151" },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  playerRowCenter: { flex: 1, marginLeft: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#333" },
  rowName: { color: "white", fontSize: 13, fontWeight: "700" },
  rowTeam: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  pendingHeader: { marginTop: 25, color: THEME.accentGold },
  spectatorsSection: {
    marginTop: 18,
    paddingTop: 10,
  },
  subHeader: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  adminActionsBox: {
    marginBottom: 10,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: THEME.accentBlue,
  },
  smallBtnText: {
    color: "white",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  actionRowCenter: { flex: 1, marginLeft: 12 },
  confirmOneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  confirmOneText: {
    color: "#A7F3D0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  emptySpectatorsBox: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  noneText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  spectatorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  spectatorRowCenter: { flex: 1, marginLeft: 12 },
  spectatorSub: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },
  spectatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  spectatorBadgeText: {
    color: "#A7F3D0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.18)",
  },
  removeBtnText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  finalizeCta: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: "rgba(251, 191, 36, 0.10)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  finalizeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(251, 191, 36, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  finalizeTitle: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  finalizeSubtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  scoreBox: { flex: 1 },
  scoreLabel: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  scoreInput: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scoreDash: { color: "#6B7280", fontSize: 18, fontWeight: "900" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.accentBlue,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  modalCancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center" },
  modalCancelText: { color: "#9CA3AF", fontSize: 13, fontWeight: "700" },
});
