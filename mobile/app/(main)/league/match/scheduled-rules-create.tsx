import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../../../src/api/apiClient";
import { Colors } from "../../../../src/constants/Colors";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"] as const;

type RivalType = "INTERNAL" | "EXTERNAL";

export default function ScheduledRulesCreateScreen() {
  const router = useRouter();
  const { leagueId, ruleId } = useGlobalSearchParams();
  const { showAlert } = useCustomAlert();
  const leagueIdStr = Array.isArray(leagueId) ? leagueId[0] : leagueId;
  const ruleIdStr = Array.isArray(ruleId) ? ruleId[0] : ruleId;
  const isEdit = !!ruleIdStr;

  const [createOnWeekday, setCreateOnWeekday] = useState(4); // JUE (ejemplo)
  const [targetWeekday, setTargetWeekday] = useState(6); // SAB
  const [targetTime, setTargetTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("0");
  const [rivalType, setRivalType] = useState<RivalType>("INTERNAL");
  const [isOpenSignup, setIsOpenSignup] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState("10");

  const [members, setMembers] = useState<Array<{ id: string; name: string; photo: string | null; selected: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [prefillConvokedIds, setPrefillConvokedIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchRule = async () => {
      if (!leagueIdStr || !ruleIdStr) return;
      try {
        const res = await apiClient.get(`/leagues/${leagueIdStr}/scheduled-rules/${ruleIdStr}`);
        if (cancelled) return;
        const r = res.data ?? {};

        setCreateOnWeekday(Number(r.create_on_weekday ?? 4));
        setTargetWeekday(Number(r.target_weekday ?? 6));
        setTargetTime(String(r.target_time ?? "18:00"));
        setLocation(String(r.location_name ?? ""));
        setPrice(String(r.price_per_player ?? "0"));
        setRivalType(String(r.match_mode ?? "INTERNAL").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "INTERNAL");
        const open = r.is_open_signup === true;
        setIsOpenSignup(open);
        setMaxPlayers(String(r.max_players ?? "10"));

        const convoked = Array.isArray(r.convoked_user_ids) ? r.convoked_user_ids.map(String) : [];
        setPrefillConvokedIds(convoked);
      } catch (e: unknown) {
        if (cancelled) return;
        showAlert("Error", formatUserFacingError(e, "No se pudo cargar la regla."), undefined, "error");
      }
    };
    fetchRule();
    return () => {
      cancelled = true;
    };
  }, [leagueIdStr, ruleIdStr]);

  useEffect(() => {
    let cancelled = false;
    const fetchMembers = async () => {
      if (!leagueIdStr) return;
      try {
        const res = await apiClient.get(`/leagues/${leagueIdStr}/members`);
        if (cancelled) return;
        const list = (Array.isArray(res.data) ? res.data : []).map((m: any) => ({
          id: m.user_id,
          name: m.users?.full_name || "Sin Nombre",
          photo: m.users?.profile_photo_url || null,
          selected: false,
        }));
        const convokedSet = new Set(prefillConvokedIds ?? []);
        setMembers(list.map((m: any) => ({ ...m, selected: convokedSet.has(m.id) })));
      } catch (e: unknown) {
        if (cancelled) return;
        showAlert("Error", formatUserFacingError(e, "No se pudieron cargar los miembros."), undefined, "error");
      }
    };
    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [leagueIdStr, prefillConvokedIds, showAlert]);

  const toggleMember = useCallback((id: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)));
  }, []);

  const selectedIds = useMemo(() => members.filter((m) => m.selected).map((m) => m.id), [members]);

  const canSave = useMemo(() => {
    if (!leagueIdStr) return false;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(targetTime.trim())) return false;
    const p = Number(price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) return false;
    if (isOpenSignup) return Number(maxPlayers) >= 2;
    return selectedIds.length > 0;
  }, [leagueIdStr, targetTime, price, isOpenSignup, maxPlayers, selectedIds.length]);

  const saveRule = useCallback(async () => {
    if (!leagueIdStr || !canSave) return;
    setSaving(true);
    try {
      const payload = {
        createOnWeekday,
        targetWeekday,
        targetTime: targetTime.trim(),
        location: location.trim(),
        price,
        isOpenSignup,
        maxPlayers: isOpenSignup ? Number(maxPlayers) : undefined,
        matchMode: rivalType,
        convokedUserIds: isOpenSignup ? [] : selectedIds,
      };

      if (ruleIdStr) {
        await apiClient.put(`/leagues/${leagueIdStr}/scheduled-rules/${ruleIdStr}`, payload);
      } else {
        await apiClient.post(`/leagues/${leagueIdStr}/scheduled-rules`, payload);
      }

      showAlert("Listo", ruleIdStr ? "Regla actualizada." : "Regla creada. Se generará automáticamente cuando toque.", [
        { text: "Volver", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      showAlert("Error", formatUserFacingError(e, ruleIdStr ? "No se pudo actualizar la regla." : "No se pudo crear la regla."), undefined, "error");
    } finally {
      setSaving(false);
    }
  }, [
    leagueIdStr,
    canSave,
    createOnWeekday,
    targetWeekday,
    targetTime,
    location,
    price,
    isOpenSignup,
    maxPlayers,
    rivalType,
    selectedIds,
    ruleIdStr,
    router,
    showAlert,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScreenHeader title={isEdit ? "EDITAR REGLA" : "CREAR REGLA"} showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUÁNDO SE CREA</Text>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, idx) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.weekPill, createOnWeekday === idx && styles.weekPillActive]}
                  onPress={() => setCreateOnWeekday(idx)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.weekPillText, createOnWeekday === idx && styles.weekPillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Ej: si elegís JUE, la regla corre todos los jueves.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PARTIDO PARA</Text>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, idx) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.weekPill, targetWeekday === idx && styles.weekPillActive]}
                  onPress={() => setTargetWeekday(idx)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.weekPillText, targetWeekday === idx && styles.weekPillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>HORA (HH:mm)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="time-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  value={targetTime}
                  onChangeText={setTargetTime}
                  placeholder="18:00"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DETALLES</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>UBICACIÓN</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="location-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Ej: Canchas del Centro"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PRECIO POR JUGADOR</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.currency}>$</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>MODALIDAD</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, rivalType === "INTERNAL" && styles.toggleBtnActive]}
                  onPress={() => setRivalType("INTERNAL")}
                >
                  <Text style={[styles.toggleText, rivalType === "INTERNAL" && styles.toggleTextActive]}>INTERNO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, rivalType === "EXTERNAL" && styles.toggleBtnActive]}
                  onPress={() => setRivalType("EXTERNAL")}
                >
                  <Text style={[styles.toggleText, rivalType === "EXTERNAL" && styles.toggleTextActive]}>EXTERNO</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>TIPO DE PARTIDO</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isOpenSignup && styles.toggleBtnActive]}
                  onPress={() => setIsOpenSignup(false)}
                >
                  <Text style={[styles.toggleText, !isOpenSignup && styles.toggleTextActive]}>CONVOCATORIA</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isOpenSignup && styles.toggleBtnActive]}
                  onPress={() => setIsOpenSignup(true)}
                >
                  <Text style={[styles.toggleText, isOpenSignup && styles.toggleTextActive]}>ABIERTA</Text>
                </TouchableOpacity>
              </View>
            </View>

            {isOpenSignup ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CUPOS (mín 2)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="people-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={maxPlayers}
                    onChangeText={setMaxPlayers}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor="#6B7280"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CONVOCAR (mín 1)</Text>
                <View style={{ gap: 10 }}>
                  {members.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberRow, m.selected && styles.memberRowSelected]}
                      onPress={() => toggleMember(m.id)}
                      activeOpacity={0.85}
                    >
                      <UserAvatar imageUrl={m.photo} name={m.name} size={28} />
                      <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                      <View style={[styles.check, m.selected && styles.checkOn]}>
                        {m.selected ? <Ionicons name="checkmark" size={14} color={Colors.primary} /> : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.5 }]}
            onPress={saveRule}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.background} />
            <Text style={styles.saveText}>{saving ? "GUARDANDO…" : "GUARDAR REGLA"}</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  helperText: { color: "#9CA3AF", fontSize: 11, fontWeight: "600" },
  weekRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weekPill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface },
  weekPillActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "20" },
  weekPillText: { color: "#9CA3AF", fontSize: 11, fontWeight: "900" },
  weekPillTextActive: { color: "white" },
  inputGroup: { gap: 8 },
  label: { color: "#9CA3AF", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111827", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, color: "white", fontSize: 14, fontWeight: "600" },
  currency: { color: "#9CA3AF", fontSize: 16, fontWeight: "900" },
  toggleRow: { flexDirection: "row", backgroundColor: "#111827", borderRadius: 12, borderWidth: 1, borderColor: "#374151", padding: 4, height: 48 },
  toggleBtn: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  toggleBtnActive: { backgroundColor: "#374151" },
  toggleText: { color: "#6B7280", fontSize: 11, fontWeight: "900" },
  toggleTextActive: { color: "white" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12 },
  memberRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "12" },
  memberName: { flex: 1, color: "white", fontSize: 13, fontWeight: "700" },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#4B5563", alignItems: "center", justifyContent: "center" },
  checkOn: { borderColor: Colors.primary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 14, marginTop: 6 },
  saveText: { color: Colors.background, fontWeight: "900", letterSpacing: 0.6 },
});

