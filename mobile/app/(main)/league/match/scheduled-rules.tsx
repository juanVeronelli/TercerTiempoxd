import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../../../src/api/apiClient";
import { Colors } from "../../../../src/constants/Colors";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { EmptyState } from "../../../../src/components/ui/EmptyState";
import { IconButton } from "../../../../src/components/ui/IconButton";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { formatUserFacingError } from "../../../../src/api/apiErrors";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

function weekdayLabel(n: unknown) {
  const i = Number(n);
  return Number.isInteger(i) && i >= 0 && i <= 6 ? WEEKDAYS[i]! : "-";
}

export default function ScheduledRulesScreen() {
  const router = useRouter();
  const { leagueId } = useGlobalSearchParams();
  const { showAlert } = useCustomAlert();
  const leagueIdStr = Array.isArray(leagueId) ? leagueId[0] : leagueId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<any[]>([]);

  const [infoVisible, setInfoVisible] = useState(false);

  const fetchRules = useCallback(async () => {
    if (!leagueIdStr) return;
    try {
      const res = await apiClient.get(`/leagues/${leagueIdStr}/scheduled-rules`);
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      showAlert("Error", formatUserFacingError(e, "No se pudieron cargar las reglas."), undefined, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueIdStr, showAlert]);

  useFocusEffect(
    useCallback(() => {
      fetchRules();
    }, [fetchRules]),
  );

  const toggleRule = useCallback(
    async (ruleId: string, nextActive: boolean) => {
      if (!leagueIdStr) return;
      try {
        await apiClient.put(`/leagues/${leagueIdStr}/scheduled-rules/${ruleId}`, { isActive: nextActive });
        fetchRules();
      } catch (e: unknown) {
        showAlert("Error", formatUserFacingError(e, "No se pudo actualizar la regla."), undefined, "error");
      }
    },
    [leagueIdStr, fetchRules, showAlert],
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      if (!leagueIdStr) return;
      showAlert("Eliminar regla", "¿Seguro? Esto no borra partidos ya creados.", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/leagues/${leagueIdStr}/scheduled-rules/${ruleId}`);
              fetchRules();
            } catch (e: unknown) {
              showAlert("Error", formatUserFacingError(e, "No se pudo eliminar."), undefined, "error");
            }
          },
        },
      ]);
    },
    [leagueIdStr, fetchRules, showAlert],
  );

  const content = useMemo(() => {
    if (!loading && rules.length === 0) {
      return (
        <EmptyState
          title="Sin reglas"
          message="Crea una regla para que la liga programe partidos automáticamente."
          iconName="repeat"
          actionLabel="Crear regla"
          onAction={() =>
            router.push({
              pathname: "/(main)/league/match/scheduled-rules-create",
              params: { leagueId: leagueIdStr },
            })
          }
        />
      );
    }

    return (
      <View style={{ gap: 12 }}>
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={() =>
            router.push({
              pathname: "/(main)/league/match/scheduled-rules-create",
              params: { leagueId: leagueIdStr },
            })
          }
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color={Colors.background} />
          <Text style={styles.primaryCtaText}>CREAR REGLA</Text>
        </TouchableOpacity>

        {rules.map((r) => {
          const active = r.is_active === true;
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {weekdayLabel(r.create_on_weekday)} → {weekdayLabel(r.target_weekday)}
                    {" · "}
                    {String(r.target_time ?? "--:--")}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {r.is_open_signup ? "Anotación abierta" : "Convocatoria"} ·{" "}
                    {String(r.match_mode ?? "INTERNAL").toUpperCase() === "EXTERNAL" ? "Externo" : "Interno"}
                    {r.is_open_signup && r.max_players ? ` · Cupos: ${r.max_players}` : ""}
                    {r.location_name ? ` · ${r.location_name}` : ""}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end", gap: 10 }}>
                  <View style={styles.cardActionsRow}>
                    <IconButton
                      onPress={() =>
                        router.push({
                          pathname: "/(main)/league/match/scheduled-rules-create",
                          params: { leagueId: leagueIdStr, ruleId: r.id },
                        })
                      }
                      accessibilityLabel="Editar regla automática"
                      style={{ width: 36, height: 36 }}
                    >
                      <Ionicons name="pencil" size={18} color={Colors.textSecondary} />
                    </IconButton>
                    <IconButton
                      onPress={() => deleteRule(r.id)}
                      accessibilityLabel="Eliminar regla automática"
                      style={{ width: 36, height: 36 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </IconButton>
                  </View>
                  <TouchableOpacity
                    style={[styles.pill, active ? styles.pillOn : styles.pillOff]}
                    onPress={() => toggleRule(r.id, !active)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={active ? "Pausar regla automática" : "Activar regla automática"}
                  >
                    <Text style={[styles.pillText, active ? styles.pillTextOn : styles.pillTextOff]}>
                      {active ? "ACTIVA" : "PAUSADA"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.metaLabel}>Precio</Text>
                <Text style={styles.metaValue}>${Number(r.price_per_player ?? 0).toFixed(0)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [loading, rules, router, leagueIdStr, toggleRule, deleteRule]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScreenHeader
        title="REGLAS AUTOMÁTICAS"
        showBack
        showBell={false}
        rightAction={
          <IconButton
            onPress={() => setInfoVisible(true)}
            accessibilityLabel="Información sobre reglas automáticas"
            style={styles.headerInfoBtn}
          >
            <Ionicons name="information-circle-outline" size={22} color={Colors.textSecondary} />
          </IconButton>
        }
      />

      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable style={styles.infoOverlay} onPress={() => setInfoVisible(false)}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.infoHeader}>
              <View style={styles.infoPill}>
                <Ionicons name="repeat" size={14} color={Colors.primary} />
                <Text style={styles.infoPillText}>REGLAS AUTOMÁTICAS</Text>
              </View>
              <TouchableOpacity
                onPress={() => setInfoVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.infoTitle}>¿Qué es?</Text>
            <Text style={styles.infoBody}>
              Una regla que crea partidos por vos todas las semanas. Ideal si tu grupo juega siempre el mismo día.
            </Text>

            <Text style={styles.infoTitle}>Cómo funciona</Text>
            <Text style={styles.infoBody}>
              Elegís el día en que se genera, el día/hora del partido y si es convocatoria o anotación abierta.
              Cuando llega el día, se crea automáticamente el próximo partido.
            </Text>

            <View style={styles.exampleBox}>
              <Text style={styles.exampleTitle}>Ejemplo</Text>
              <Text style={styles.exampleBody}>
                Cada <Text style={styles.exampleStrong}>jueves</Text> se crea un partido para el próximo{" "}
                <Text style={styles.exampleStrong}>sábado 18:00</Text>.
              </Text>
              <Text style={styles.exampleFoot}>
                Si cancelás un partido, <Text style={styles.exampleStrong}>no</Text> cancelás la regla (es solo una excepción).
              </Text>
            </View>

            <TouchableOpacity
              style={styles.infoCta}
              onPress={() => {
                setInfoVisible(false);
                router.push({
                  pathname: "/(main)/league/match/scheduled-rules-create",
                  params: { leagueId: leagueIdStr },
                });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={Colors.background} />
              <Text style={styles.infoCtaText}>CREAR REGLA</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRules();
            }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  headerInfoBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryCtaText: { color: Colors.background, fontWeight: "900", letterSpacing: 0.6 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardTitle: { color: "white", fontSize: 14, fontWeight: "900" },
  cardSubtitle: { color: Colors.textSecondary, marginTop: 4, fontSize: 12, fontWeight: "600" },
  cardActionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillOn: { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.5)" },
  pillOff: { backgroundColor: "rgba(156, 163, 175, 0.12)", borderColor: "rgba(156, 163, 175, 0.3)" },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  pillTextOn: { color: "#10B981" },
  pillTextOff: { color: "#9CA3AF" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },
  metaValue: { color: "white", fontSize: 12, fontWeight: "900" },

  infoOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 16,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "33",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  infoPillText: { color: Colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  infoTitle: { color: "white", fontSize: 13, fontWeight: "900", marginTop: 10, marginBottom: 6 },
  infoBody: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  exampleBox: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  exampleTitle: { color: "white", fontSize: 12, fontWeight: "900" },
  exampleBody: { color: "#D1D5DB", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  exampleFoot: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600", lineHeight: 16 },
  exampleStrong: { color: "white", fontWeight: "900" },
  infoCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 12,
  },
  infoCtaText: { color: Colors.background, fontWeight: "900", letterSpacing: 0.6 },
});

