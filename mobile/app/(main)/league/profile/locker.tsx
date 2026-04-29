import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../../../src/api/apiClient";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { resolveShopActivateFailure } from "../../../../src/api/shopActivateMessages";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { useCurrentLeagueId } from "../../../../src/context/LeagueContext";

const THEME = {
  cardBg: "#1F2937",
  innerBg: "#111827",
  gold: "#F59E0B",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  borderColor: "#374151",
};

type ConsumableStack = {
  consumableKey: string;
  quantity: number;
  displayName: string;
  description: string | null;
  tooltip: string | null;
  consumableTiming: string | null;
  effectKey: string | null;
};

function mergeStacksByConsumable(rows: ConsumableStack[]): ConsumableStack[] {
  const byKey = new Map<string, ConsumableStack>();
  for (const row of rows) {
    const prev = byKey.get(row.consumableKey);
    if (!prev) {
      byKey.set(row.consumableKey, { ...row });
      continue;
    }
    byKey.set(row.consumableKey, {
      ...prev,
      quantity: prev.quantity + (Number(row.quantity) || 0),
    });
  }
  return [...byKey.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default function LockerScreen() {
  const { showAlert, showToast } = useCustomAlert();
  const leagueId = useCurrentLeagueId();
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingKey, setActivatingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ stacks: ConsumableStack[] }>("/shop/consumables");
      setStacks(mergeStacksByConsumable(res.data?.stacks ?? []));
    } catch (e) {
      showAlert(
        "No se pudo cargar tu taquilla",
        formatUserFacingError(e, "Reintentá en unos segundos."),
        undefined,
        "error",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const timingLabel = (t: string | null) => {
    if (t === "PRE_MATCH") return "Pre-partido";
    if (t === "POST_MATCH") return "Post-partido";
    return null;
  };

  const performActivate = async (row: ConsumableStack) => {
    if (!leagueId) {
      showAlert(
        "Elegí una liga",
        "Seleccioná una liga en el inicio para vincular el consumible a su calendario.",
        undefined,
        "warning",
      );
      return;
    }
    setActivatingKey(row.consumableKey);
    try {
      const res = await apiClient.post<{
        alertTitle: string;
        alertMessage: string;
        quantityRemaining: number;
      }>("/shop/activate", {
        consumableKey: row.consumableKey,
        leagueId,
      });
      showAlert(res.data.alertTitle, res.data.alertMessage, undefined, "success");
      setStacks((prev) =>
        prev
          .map((s) =>
            s.consumableKey === row.consumableKey
              ? { ...s, quantity: res.data.quantityRemaining }
              : s,
          )
          .filter((s) => s.quantity > 0),
      );
    } catch (e: unknown) {
      const pres = resolveShopActivateFailure(e);
      if (pres.toastMessage) {
        showToast(pres.toastMessage, "error");
      }
      showAlert(pres.alertTitle, pres.alertMessage, undefined, "error");
    } finally {
      setActivatingKey(null);
    }
  };

  const requestActivate = (row: ConsumableStack) => {
    if (!leagueId) {
      showAlert(
        "Elegí una liga",
        "Seleccioná una liga en el inicio para vincular el consumible a su calendario.",
        undefined,
        "warning",
      );
      return;
    }
    if (row.consumableTiming === "PRE_MATCH") {
      showAlert(
        "Activar consumible pre-partido",
        "Se vinculará al próximo partido de esta liga en el que estés convocado como jugador o anotado como espectador (o al último si la fecha ya pasó). Si no estás en ninguno, no se va a poder usar.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Activar", onPress: () => void performActivate(row) },
        ],
        "info",
      );
      return;
    }
    if (row.consumableTiming === "POST_MATCH") {
      showAlert(
        "Activar consumible post-partido",
        "Se aplicará al último partido ya jugado y cerrado en esta liga en el que hayas participado como jugador. Si todavía no jugaste acá, la activación va a fallar.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Activar", onPress: () => void performActivate(row) },
        ],
        "info",
      );
      return;
    }
    void performActivate(row);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenHeader title="Mi taquilla" showBack showTtp={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.gold} />
        }
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="briefcase-outline" size={22} color={THEME.gold} />
          </View>
          <Text style={styles.introTitle}>Consumibles listos para usar</Text>
          <Text style={styles.introSubtitle}>
            Activá un ítem para tu liga actual: los de pre-partido van al próximo encuentro; los de
            post-partido, al último cerrado. El stock se descuenta al confirmar.
          </Text>
          {!leagueId ? (
            <Text style={styles.leagueWarning}>
              Seleccioná una liga en el inicio para poder activar consumibles.
            </Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : stacks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Todavía no tenés consumibles</Text>
            <Text style={styles.emptyText}>Compralos en la Tienda y van a aparecer acá.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {stacks.map((s) => (
              <View key={s.consumableKey} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowTitleRow}>
                    <Text style={styles.rowName}>{s.displayName}</Text>
                    {s.tooltip ? (
                      <TouchableOpacity
                        onPress={() =>
                          showAlert(s.displayName, s.tooltip ?? "", undefined, "info")
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="information-circle-outline" size={18} color={THEME.gold} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {timingLabel(s.consumableTiming) ? (
                    <Text style={styles.timingHint}>{timingLabel(s.consumableTiming)}</Text>
                  ) : null}
                  {s.description ? (
                    <Text style={styles.rowDesc} numberOfLines={2}>
                      {s.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <View style={styles.qtyPill}>
                    <Text style={styles.qtyText}>x{s.quantity}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.activateBtn,
                      (activatingKey === s.consumableKey || !leagueId) && styles.activateBtnDisabled,
                    ]}
                    onPress={() => requestActivate(s)}
                    disabled={activatingKey !== null || !leagueId}
                  >
                    {activatingKey === s.consumableKey ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.activateText}>Activar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  intro: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.innerBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  introTitle: {
    color: THEME.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  introSubtitle: {
    color: THEME.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  leagueWarning: {
    marginTop: 10,
    color: "#FBBF24",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  rowLeft: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { color: THEME.textPrimary, fontSize: 15, fontWeight: "700", flex: 1 },
  timingHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(245, 158, 11, 0.9)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  rowDesc: { marginTop: 6, color: THEME.textSecondary, fontSize: 12, lineHeight: 17 },
  rowRight: { alignItems: "flex-end", gap: 8 },
  qtyPill: {
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  activateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: "center",
  },
  activateBtnDisabled: { opacity: 0.45 },
  activateText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  emptyBox: {
    marginTop: 8,
    backgroundColor: THEME.innerBg,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.borderColor,
  },
  emptyTitle: {
    color: THEME.textPrimary,
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 8,
  },
  emptyText: { color: THEME.textSecondary, fontSize: 14, lineHeight: 20 },
});
