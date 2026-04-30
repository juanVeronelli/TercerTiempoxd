import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import apiClient from "../../../../src/api/apiClient";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { useTtp } from "../../../../src/context/TtpContext";
import { Colors } from "../../../../src/constants/Colors";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";

type ActionNowApiCard = { key: string; kind: string };

type MissionBranch = "FREE" | "PRO";
type MissionDto = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  branch: MissionBranch;
  metricKey: string;
  target: number;
  sortOrder: number;
  rewards: {
    ttp: number;
    cosmeticKey: string | null;
    cosmeticType: string | null;
    consumableKey: string | null;
    consumableQty: number | null;
  };
  user: null | {
    progress: number;
    isCompleted: boolean;
    completedAt: string | null;
    claimedAt: string | null;
    popupShownAt: string | null;
  };
};

const THEME = {
  bg: Colors.background,
  cardBg: "#121826",
  cardBorder: "#253047",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  gold: "#F59E0B",
  green: "#22C55E",
  red: "#EF4444",
  pro: "#F59E0B",
  muted: "#6B7280",
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function rewardLabel(m: MissionDto) {
  const parts: string[] = [];
  if (m.rewards.ttp > 0) parts.push(`+${m.rewards.ttp} TTP`);
  if (m.rewards.cosmeticKey) parts.push("Cosmético");
  if (m.rewards.consumableKey) parts.push("Consumible");
  return parts.join(" · ") || "—";
}

export default function MissionsScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const ttp = useTtp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planType, setPlanType] = useState<"FREE" | "PRO">("FREE");
  const [missions, setMissions] = useState<MissionDto[]>([]);
  const [tab, setTab] = useState<MissionBranch>("FREE");
  const [popupKeys, setPopupKeys] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get("/missions/me");
      const p = String(res.data?.planType ?? "FREE").toUpperCase();
      setPlanType(p === "PRO" ? "PRO" : "FREE");
      setMissions((res.data?.missions ?? []) as MissionDto[]);

      const keys = (res.data?.popup?.missionKeys ?? []) as string[];
      setPopupKeys(Array.isArray(keys) ? keys : []);
      if (Array.isArray(keys) && keys.length > 0) setPopupVisible(true);
    } catch (e) {
      showAlert("Error", formatUserFacingError(e, "No se pudieron cargar las misiones."), undefined, "error");
      setMissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  // Si el usuario entra a Misiones, marcamos como vistas las acciones “Misión completada”.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiClient.get<{ ok: boolean; actions: ActionNowApiCard[] }>("/actions/now");
          const keys = (res.data?.actions ?? [])
            .filter((a) => a?.kind === "MISSION_CLAIM")
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
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const freeCount = useMemo(() => missions.filter((m) => m.branch === "FREE").length, [missions]);
  const proCount = useMemo(() => missions.filter((m) => m.branch === "PRO").length, [missions]);

  const freeCompleted = useMemo(
    () => missions.filter((m) => m.branch === "FREE" && m.user?.isCompleted).length,
    [missions],
  );
  const proCompleted = useMemo(
    () => missions.filter((m) => m.branch === "PRO" && m.user?.isCompleted).length,
    [missions],
  );
  // progreso por rama (para UI)

  const filtered = useMemo(() => missions.filter((m) => m.branch === tab), [missions, tab]);

  const popupMissions = useMemo(() => {
    const set = new Set(popupKeys);
    return missions.filter((m) => set.has(m.key));
  }, [missions, popupKeys]);

  const markPopupSeen = useCallback(async () => {
    const keys = popupKeys;
    setPopupKeys([]);
    if (!keys.length) return;
    try {
      await apiClient.post("/missions/popup-seen", { missionKeys: keys });
    } catch {
      // Silencioso: no es crítico
    }
  }, [popupKeys]);

  const closePopup = useCallback(() => {
    setPopupVisible(false);
    markPopupSeen();
  }, [markPopupSeen]);

  const claim = useCallback(
    async (m: MissionDto) => {
      if (claimingKey) return;
      setClaimingKey(m.key);
      try {
        const res = await apiClient.post("/missions/claim", { missionKey: m.key });
        const balanceAfter = res.data?.balanceAfter;
        if (m.rewards.ttp > 0) {
          ttp?.animateGain({ amount: m.rewards.ttp, balanceAfter: typeof balanceAfter === "number" ? balanceAfter : null });
        } else if (typeof balanceAfter === "number") {
          ttp?.setBalance(balanceAfter);
        }
        await fetchData();
        showAlert("Listo", "Recompensa reclamada.", undefined, "success");
      } catch (e) {
        const err = (e as any)?.response?.data?.error;
        if (err === "FORBIDDEN_PRO") {
          showAlert("Solo PRO", "Esta misión es exclusiva para usuarios PRO.", undefined, "info");
        } else {
          showAlert("Error", formatUserFacingError(e, "No se pudo reclamar la recompensa."), undefined, "error");
        }
      } finally {
        setClaimingKey(null);
      }
    },
    [claimingKey, fetchData, showAlert, ttp],
  );

  const isPro = planType === "PRO";
  const tabTotals =
    tab === "FREE" ? { done: freeCompleted, total: freeCount } : { done: proCompleted, total: proCount };
  const tabPct = tabTotals.total > 0 ? Math.round((tabTotals.done / tabTotals.total) * 100) : 0;
  const tabFillColor = tab === "PRO" ? THEME.gold : Colors.primary;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenHeader title="Misiones" showBack onBackPress={() => router.back()} />

      <View style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "FREE" && styles.tabBtnActive]}
          onPress={() => setTab("FREE")}
          activeOpacity={0.9}
        >
          <Text style={[styles.tabText, tab === "FREE" && styles.tabTextActive]}>BÁSICAS</Text>
          <Text style={[styles.tabCount, tab === "FREE" && styles.tabCountActive]}>{freeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "PRO" && styles.tabBtnActive]}
          onPress={() => setTab("PRO")}
          activeOpacity={0.9}
        >
          <Text style={[styles.tabText, tab === "PRO" && styles.tabTextActive]}>PRO</Text>
          <Text style={[styles.tabCount, tab === "PRO" && styles.tabCountActive]}>{proCount}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.gold} />}
      >
        <View style={styles.progressCard}>
          <View style={styles.progressHeadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressTitle}>Progreso</Text>
              <Text style={styles.progressSub}>
                {tabTotals.done}/{tabTotals.total} completadas · {tabPct}%
              </Text>
            </View>
          </View>
          <View style={styles.progressBigBar}>
            <View style={[styles.progressBigFill, { width: `${tabPct}%`, backgroundColor: tabFillColor }]} />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={THEME.gold} />
            <Text style={styles.loadingText}>Cargando misiones…</Text>
          </View>
        ) : (
          filtered.map((m) => {
            const progress = clamp01((m.user?.progress ?? 0) / Math.max(1, m.target));
            const completed = Boolean(m.user?.isCompleted);
            const claimed = Boolean(m.user?.claimedAt);
            const locked = m.branch === "PRO" && !isPro;
            const canClaim = completed && !claimed && !locked;
            return (
              <View key={m.key} style={[styles.card, locked && styles.cardLocked]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{m.title}</Text>
                      {m.branch === "PRO" && (
                        <View style={styles.proPill}>
                          <Ionicons name="sparkles" size={12} color={THEME.cardBg} />
                          <Text style={styles.proPillText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    {!!m.description && <Text style={styles.cardDesc}>{m.description}</Text>}
                  </View>
                </View>

                <View style={styles.rewardRow}>
                  <Ionicons name="gift-outline" size={14} color={THEME.gold} />
                  <Text style={styles.rewardText}>{rewardLabel(m)}</Text>
                </View>

                <View style={styles.progressWrap}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {completed ? "Completada" : `${Math.floor(m.user?.progress ?? 0)}/${Math.floor(m.target)}`}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  {locked ? (
                    <TouchableOpacity
                      style={styles.unlockBtn}
                      onPress={() => router.push("/(main)/paywall")}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="lock-closed-outline" size={16} color={THEME.text} />
                      <Text style={styles.unlockText}>Desbloquear PRO</Text>
                    </TouchableOpacity>
                  ) : claimed ? (
                    <View style={styles.claimedPill}>
                      <Ionicons name="checkmark-circle" size={16} color={THEME.green} />
                      <Text style={styles.claimedText}>Reclamada</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.claimBtn, !canClaim && styles.claimBtnDisabled]}
                      onPress={() => canClaim && claim(m)}
                      activeOpacity={0.9}
                      disabled={!canClaim}
                    >
                      {claimingKey === m.key ? (
                        <ActivityIndicator color={THEME.cardBg} />
                      ) : (
                        <>
                          <Ionicons name="hand-left-outline" size={16} color={THEME.cardBg} />
                          <Text style={styles.claimText}>RECLAMAR</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="flag-outline" size={34} color={THEME.muted} />
            <Text style={styles.emptyTitle}>No hay misiones</Text>
            <Text style={styles.emptySub}>En breve vas a tener desafíos para ganar TTP y cosméticos.</Text>
          </View>
        )}
      </ScrollView>

      <Modal transparent visible={popupVisible} animationType="fade" onRequestClose={closePopup}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="trophy-outline" size={20} color={THEME.gold} />
              <Text style={styles.modalTitle}>¡Misión completada!</Text>
            </View>
            <Text style={styles.modalSub}>Reclamá tu recompensa desde la misión.</Text>

            <View style={{ marginTop: 12 }}>
              {popupMissions.slice(0, 4).map((m) => (
                <View key={m.key} style={styles.modalLine}>
                  <Ionicons name="checkmark" size={14} color={THEME.green} />
                  <Text style={styles.modalLineText}>{m.title}</Text>
                </View>
              ))}
              {popupMissions.length > 4 && (
                <Text style={styles.modalMore}>y {popupMissions.length - 4} más…</Text>
              )}
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={closePopup} activeOpacity={0.9}>
              <Text style={styles.modalBtnText}>Ver misiones</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  scroll: { flex: 1 },
  tabsWrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabBtnActive: {
    borderColor: THEME.gold + "B3",
    backgroundColor: "#111827",
  },
  tabText: { color: THEME.sub, fontWeight: "800", letterSpacing: 0.6, fontSize: 12 },
  tabTextActive: { color: THEME.text },
  tabCount: { color: THEME.sub, fontWeight: "800", fontSize: 12 },
  tabCountActive: { color: THEME.gold },

  loadingBox: { padding: 24, alignItems: "center", gap: 10 },
  loadingText: { color: THEME.sub, fontWeight: "600" },

  card: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardLocked: { opacity: 0.9 },
  cardTop: { flexDirection: "row", gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cardTitle: { color: THEME.text, fontWeight: "900", fontSize: 15, letterSpacing: 0.2, flexShrink: 1 },
  cardDesc: { color: THEME.sub, marginTop: 4, lineHeight: 18 },

  proPill: {
    backgroundColor: THEME.pro,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  proPillText: { color: THEME.cardBg, fontWeight: "900", fontSize: 11, letterSpacing: 0.6 },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  rewardText: { color: THEME.sub, fontWeight: "700" },

  progressWrap: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  progressBar: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#1F2A44",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: THEME.gold },
  progressText: { color: THEME.sub, fontWeight: "800", minWidth: 70, textAlign: "right" },

  actionsRow: { marginTop: 12, flexDirection: "row", justifyContent: "flex-end" },
  claimBtn: {
    backgroundColor: THEME.gold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  claimBtnDisabled: { opacity: 0.5 },
  claimText: { color: THEME.cardBg, fontWeight: "900", letterSpacing: 0.6 },
  claimedPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  claimedText: { color: THEME.sub, fontWeight: "800" },
  unlockBtn: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unlockText: { color: THEME.text, fontWeight: "900" },

  emptyBox: { paddingVertical: 56, alignItems: "center", gap: 10 },
  emptyTitle: { color: THEME.text, fontWeight: "900", fontSize: 16 },
  emptySub: { color: THEME.sub, textAlign: "center", maxWidth: 320, lineHeight: 18 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0B1220",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.gold + "B3",
    padding: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { color: THEME.text, fontWeight: "900", fontSize: 16 },
  modalSub: { color: THEME.sub, marginTop: 6, lineHeight: 18 },
  modalLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  modalLineText: { color: THEME.text, fontWeight: "800", flexShrink: 1 },
  modalMore: { color: THEME.sub, marginTop: 4, fontWeight: "700" },
  modalBtn: {
    marginTop: 14,
    backgroundColor: THEME.gold,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnText: { color: THEME.cardBg, fontWeight: "900", letterSpacing: 0.6 },

  progressCard: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  progressHeadRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  progressTitle: { color: THEME.text, fontWeight: "900", fontSize: 15, letterSpacing: 0.2 },
  progressSub: { color: THEME.sub, marginTop: 4, fontWeight: "700" },
  progressPillText: { color: THEME.sub, fontWeight: "900" },
  progressBigBar: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#1F2A44",
    overflow: "hidden",
  },
  progressBigFill: { height: "100%", backgroundColor: THEME.gold },
});

