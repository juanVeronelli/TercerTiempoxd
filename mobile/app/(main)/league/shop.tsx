import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../../src/api/apiClient";
import { formatUserFacingError } from "../../../src/api/apiErrors";
import { resolveShopPurchaseFailure } from "../../../src/api/shopPurchaseMessages";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import { ScreenHeader } from "../../../src/components/ui/ScreenHeader";
import { useTtp } from "../../../src/context/TtpContext";
import { IconButton } from "../../../src/components/ui/IconButton";

type ShopItem = {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  itemType: string;
  priceTtp: number;
  cosmeticKey: string | null;
  consumableKey: string | null;
  ownedCosmetic: boolean;
  tooltip: string | null;
  consumableTiming: string | null;
  effectKey: string | null;
};

type TtpSummaryResponse = {
  balance: number;
  dailyFree?: {
    amount: number;
    canClaim: boolean;
    remainingMs: number;
    lastClaimAt: string | null;
    streak?: number;
    maxAmount?: number;
    daysToMax?: number;
  };
};

const IAP_PACKS_PLACEHOLDER: { id: string; ttpLabel: string; blurb: string }[] = [
  { id: "ttp_iap_small", ttpLabel: "500", blurb: "Entrada" },
  { id: "ttp_iap_medium", ttpLabel: "1.500", blurb: "Popular" },
  { id: "ttp_iap_large", ttpLabel: "5.000", blurb: "Mejor valor" },
  { id: "ttp_iap_mega", ttpLabel: "15.000", blurb: "Cargá en serio" },
];

type ShopTab = "consumibles" | "cosmeticos" | "ttp";

const TABS: {
  key: ShopTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "consumibles", label: "Consumibles", icon: "flash-outline" },
  { key: "cosmeticos", label: "Cosméticos", icon: "color-palette-outline" },
  { key: "ttp", label: "Cargar TTP", icon: "wallet-outline" },
];

function timingChip(timing: string | null): { label: string; tone: "pre" | "post" | "neutral" } {
  if (timing === "PRE_MATCH") return { label: "Pre-partido", tone: "pre" };
  if (timing === "POST_MATCH") return { label: "Post-partido", tone: "post" };
  return { label: "", tone: "neutral" };
}

function formatCooldown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ShopScreen() {
  const router = useRouter();
  const { showAlert, showToast } = useCustomAlert();
  const ttp = useTtp();
  const [activeTab, setActiveTab] = useState<ShopTab>("consumibles");
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [dailyAmount, setDailyAmount] = useState<number>(20);
  const [dailyRemainingMs, setDailyRemainingMs] = useState<number>(0);
  const [dailyStreak, setDailyStreak] = useState<number>(0);
  const [claimingDaily, setClaimingDaily] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ttpRes, shopRes] = await Promise.all([
        apiClient.get<TtpSummaryResponse>("/economy/ttp"),
        apiClient.get<{ items: ShopItem[] }>("/shop/items"),
      ]);
      setBalance(ttpRes.data.balance);
      ttp?.setBalance(ttpRes.data.balance);
      if (ttpRes.data.dailyFree) {
        setDailyAmount(Number(ttpRes.data.dailyFree.amount ?? 20));
        setDailyRemainingMs(Math.max(0, Number(ttpRes.data.dailyFree.remainingMs ?? 0)));
        setDailyStreak(Math.max(0, Number(ttpRes.data.dailyFree.streak ?? 0)));
      }
      setItems(shopRes.data.items ?? []);
    } catch (e) {
      showAlert(
        "No se pudo cargar la tienda",
        formatUserFacingError(e, "Reintentá en unos segundos."),
        undefined,
        "error",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert, ttp]);

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

  useEffect(() => {
    if (dailyRemainingMs <= 0) return;
    const id = setInterval(() => {
      setDailyRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [dailyRemainingMs]);

  const claimDailyFree = async () => {
    if (claimingDaily || dailyRemainingMs > 0) return;
    setClaimingDaily(true);
    try {
      const res = await apiClient.post<{
        ok: true;
        amount: number;
        balanceAfter: number;
        nextClaimInMs: number;
        streakAfter?: number;
      }>("/economy/ttp/daily-free/claim", {});
      setBalance(res.data.balanceAfter);
      ttp?.animateGain({ amount: res.data.amount, balanceAfter: res.data.balanceAfter });
      setDailyRemainingMs(Math.max(0, Number(res.data.nextClaimInMs ?? 0)));
      if (typeof res.data.streakAfter === "number") setDailyStreak(Math.max(0, res.data.streakAfter));
      showToast(`Reclamaste +${res.data.amount} TTP gratis`, "success");
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: string; remainingMs?: number } } })?.response?.data;
      if (data?.error === "COOLDOWN_ACTIVE") {
        setDailyRemainingMs(Math.max(0, Number(data.remainingMs ?? 0)));
        showAlert(
          "Todavía no disponible",
          `Tu próximo reclamo gratis está en ${formatCooldown(Number(data.remainingMs ?? 0))}.`,
          undefined,
          "warning",
        );
      } else {
        showAlert(
          "No se pudo reclamar",
          formatUserFacingError(e, "Reintentá en unos segundos."),
          undefined,
          "error",
        );
      }
    } finally {
      setClaimingDaily(false);
    }
  };

  const buyNow = async (item: ShopItem) => {
    if (item.itemType === "COSMETIC" && item.ownedCosmetic) return;
    setBuyingId(item.id);
    try {
      const res = await apiClient.post<{ balanceAfter: number }>("/shop/purchase", {
        itemId: item.id,
      });
      setBalance(res.data.balanceAfter);
      // Compra de items normalmente baja balance: no animamos ganancia acá.
      ttp?.setBalance(res.data.balanceAfter);
      showToast(
        "Compra realizada. Toca para ir a Mi taquilla.",
        "success",
        4500,
        () => router.push("/(main)/league/profile/locker"),
      );
      const shopRes = await apiClient.get<{ items: ShopItem[] }>("/shop/items");
      setItems(shopRes.data.items ?? []);
    } catch (e: unknown) {
      const pres = resolveShopPurchaseFailure(e);
      if (pres.toastMessage) {
        showToast(pres.toastMessage, "error");
      }
      showAlert(pres.alertTitle, pres.alertMessage, undefined, "error");
    } finally {
      setBuyingId(null);
    }
  };

  const confirmBuy = (item: ShopItem) => {
    if (buyingId) return;
    if (item.itemType === "COSMETIC" && item.ownedCosmetic) return;
    if (balance !== null && balance < item.priceTtp) return;

    showAlert(
      "Confirmar compra",
      `¿Querés comprar "${item.displayName}" por ${item.priceTtp} TTP?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Comprar", style: "default", onPress: () => buyNow(item) },
      ],
      "warning",
    );
  };

  const consumables = useMemo(
    () => items.filter((i) => i.itemType === "CONSUMABLE"),
    [items],
  );
  const cosmetics = useMemo(
    () =>
      items.filter((i) => {
        if (i.itemType !== "COSMETIC") return false;
        // v0.2: no mostrar "Marco dorado" en tienda
        const k = String(i.key ?? "").toLowerCase();
        const name = String(i.displayName ?? "").toLowerCase();
        const cosmeticKey = String(i.cosmeticKey ?? "").toLowerCase();
        if (k === "frame_gold_shop") return false;
        if (name.includes("marco dorado")) return false;
        if (cosmeticKey === "gold") return false;
        return true;
      }),
    [items],
  );

  const preConsumables = useMemo(
    () => consumables.filter((c) => c.consumableTiming === "PRE_MATCH"),
    [consumables],
  );
  const postConsumables = useMemo(
    () => consumables.filter((c) => c.consumableTiming === "POST_MATCH"),
    [consumables],
  );
  const otherConsumables = useMemo(
    () => consumables.filter((c) => !c.consumableTiming),
    [consumables],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)/league/home");
    }
  };

  const renderItemRow = (item: ShopItem, isLast?: boolean) => {
    const isCosmeticOwned = item.itemType === "COSMETIC" && item.ownedCosmetic;
    const disabled =
      buyingId === item.id || isCosmeticOwned || (balance !== null && balance < item.priceTtp);
    const chip = timingChip(item.consumableTiming);
    const isCosmetic = item.itemType === "COSMETIC";

    return (
      <View key={item.id} style={[styles.itemRow, isLast && styles.itemRowLast]}>
        <View style={[styles.itemIcon, isCosmetic && styles.itemIconCosmetic]}>
          <Ionicons
            name={isCosmetic ? "color-palette" : "flash"}
            size={18}
            color={Colors.accentGold}
          />
        </View>

        <View style={styles.itemMain}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.displayName}
            </Text>
            {item.itemType === "CONSUMABLE" && item.tooltip ? (
              <IconButton
                onPress={() =>
                  showAlert(item.displayName, item.tooltip ?? "", undefined, "info")
                }
                accessibilityLabel={`Información de ${item.displayName}`}
                style={styles.infoHit}
              >
                <Ionicons name="information-circle-outline" size={18} color={Colors.iconMuted} />
              </IconButton>
            ) : null}
          </View>

          {chip.label ? (
            <View style={styles.chipWrap}>
              <View
                style={[
                  styles.chip,
                  chip.tone === "pre" && styles.chipPre,
                  chip.tone === "post" && styles.chipPost,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    chip.tone === "pre" && styles.chipTextPre,
                    chip.tone === "post" && styles.chipTextPost,
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            </View>
          ) : isCosmetic ? (
            <Text style={styles.itemMeta}>Perfil</Text>
          ) : null}

          {item.description ? (
            <Text style={styles.itemDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.itemActions}>
          <Text style={styles.itemPrice}>{item.priceTtp}</Text>
          <Text style={styles.itemPriceUnit}>TTP</Text>
          <TouchableOpacity
            style={[styles.buyPill, disabled && styles.buyPillDisabled]}
            onPress={() => confirmBuy(item)}
            disabled={disabled}
            activeOpacity={0.85}
          >
            {buyingId === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buyPillText}>{isCosmeticOwned ? "Listo" : "Comprar"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const sectionTitle = (title: string, subtitle?: string, spaced?: boolean) => (
    <View style={[styles.sectionHead, spaced && styles.sectionHeadSpaced]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenHeader title="Tienda" showBack onBackPress={handleBack} showTtp />

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={tab.icon}
                size={17}
                color={active ? Colors.accentGold : Colors.textMuted}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
              {active ? <View style={styles.tabIndicator} /> : <View style={styles.tabIndicatorSpacer} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentGold} />
        }
      >
        {activeTab === "consumibles" && (
          <View>
            <Text style={styles.hint}>
              Comprás acá y activás en{" "}
              <Text style={styles.hintStrong}>Mi taquilla</Text>. Pre = próximo partido · Post =
              último cerrado.
            </Text>

            {loading && consumables.length === 0 ? (
              <ActivityIndicator color={Colors.accentGold} style={styles.loader} />
            ) : consumables.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay consumibles.</Text>
            ) : (
              <View style={styles.listCard}>
                {preConsumables.length > 0 ? (
                  <>
                    {sectionTitle("Antes del partido", "Próximo encuentro de la liga")}
                    {preConsumables.map((it, idx) =>
                      renderItemRow(
                        it,
                        idx === preConsumables.length - 1 && postConsumables.length === 0 && otherConsumables.length === 0,
                      ),
                    )}
                  </>
                ) : null}

                {postConsumables.length > 0 ? (
                  <>
                    {sectionTitle(
                      "Después del partido",
                      "Último partido cerrado",
                      preConsumables.length > 0,
                    )}
                    {postConsumables.map((it, idx) =>
                      renderItemRow(
                        it,
                        idx === postConsumables.length - 1 && otherConsumables.length === 0,
                      ),
                    )}
                  </>
                ) : null}

                {otherConsumables.length > 0 ? (
                  <>
                    {sectionTitle(
                      "Otros",
                      undefined,
                      preConsumables.length > 0 || postConsumables.length > 0,
                    )}
                    {otherConsumables.map((it, idx) =>
                      renderItemRow(it, idx === otherConsumables.length - 1),
                    )}
                  </>
                ) : null}
              </View>
            )}
          </View>
        )}

        {activeTab === "cosmeticos" && (
          <View>
            <Text style={styles.hint}>Marcos y estética para tu perfil.</Text>
            {loading && cosmetics.length === 0 ? (
              <ActivityIndicator color={Colors.accentGold} style={styles.loader} />
            ) : cosmetics.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="color-palette-outline" size={40} color={Colors.accentGold} />
                <Text style={styles.emptyTitle}>Por ahora no hay</Text>
                <Text style={styles.emptyBody}>En breve vas a tener cosméticos nuevos para tu perfil.</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                {cosmetics.map((it, idx) => renderItemRow(it, idx === cosmetics.length - 1))}
              </View>
            )}
          </View>
        )}

        {activeTab === "ttp" && (
          <View>
            <View style={styles.dailyFreeCard}>
              <View style={styles.dailyFreeHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dailyFreeTitle}>TTP gratis diario</Text>
                  <Text style={styles.dailyFreeSub}>
                    Racha: {dailyStreak} día{dailyStreak === 1 ? "" : "s"} · Próximo: +{dailyAmount} TTP
                  </Text>
                </View>
                <View style={styles.dailyPill}>
                  <Text style={styles.dailyPillText}>+{dailyAmount}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.dailyClaimBtn,
                  (claimingDaily || dailyRemainingMs > 0) && styles.dailyClaimBtnDisabled,
                ]}
                onPress={claimDailyFree}
                disabled={claimingDaily || dailyRemainingMs > 0}
                activeOpacity={0.85}
              >
                {claimingDaily ? (
                  <ActivityIndicator color="#111827" size="small" />
                ) : (
                  <Text style={styles.dailyClaimBtnText}>
                    {dailyRemainingMs > 0
                      ? `Disponible en ${formatCooldown(dailyRemainingMs)}`
                      : "Reclamar gratis"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Packs con dinero real (App Store / Google Play).{" "}
              <Text style={styles.hintMuted}>Próximamente.</Text>
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iapRow}
            >
              {IAP_PACKS_PLACEHOLDER.map((pack) => (
                <View key={pack.id} style={styles.iapPill}>
                  <Text style={styles.iapBlurb}>{pack.blurb}</Text>
                  <Text style={styles.iapAmt}>+{pack.ttpLabel}</Text>
                  <Text style={styles.iapUnit}>TTP</Text>
                  <View style={styles.iapSoon}>
                    <Text style={styles.iapSoonText}>Pronto</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 4,
  },
  tabActive: {},
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    width: "56%",
    borderRadius: 2,
    backgroundColor: Colors.accentGold,
  },
  tabIndicatorSpacer: {
    height: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 100,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  hintStrong: {
    color: Colors.accentGold,
    fontWeight: "700",
  },
  hintMuted: {
    color: Colors.textMuted,
  },
  loader: { marginVertical: 40 },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sectionHead: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionHeadSpaced: {
    marginTop: 10,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(51, 65, 85, 0.5)",
  },
  sectionTitle: {
    color: Colors.textHeading,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionSub: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(51, 65, 85, 0.6)",
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentGoldCardBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemIconCosmetic: {
    backgroundColor: "rgba(38, 72, 209, 0.15)",
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  itemTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  infoHit: { padding: 2, marginTop: -2 },
  chipWrap: { marginTop: 6 },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  chipPre: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  chipPost: {
    backgroundColor: "rgba(38, 72, 209, 0.2)",
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  chipTextPre: {
    color: Colors.accentGold,
  },
  chipTextPost: {
    color: "#93C5FD",
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  itemDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  itemActions: {
    alignItems: "flex-end",
    minWidth: 76,
    gap: 8,
  },
  itemPrice: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.accentGold,
    letterSpacing: -0.3,
  },
  itemPriceUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    marginTop: -4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  buyPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 88,
    alignItems: "center",
  },
  buyPillDisabled: {
    opacity: 0.38,
  },
  buyPillText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 12,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyTitle: {
    color: Colors.textHeading,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  dailyFreeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  dailyFreeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  dailyFreeTitle: {
    color: Colors.textHeading,
    fontSize: 15,
    fontWeight: "900",
  },
  dailyFreeSub: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dailyPill: {
    backgroundColor: Colors.accentGoldCardBg,
    borderWidth: 1,
    borderColor: Colors.accentGoldSubtle,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dailyPillText: {
    color: Colors.accentGold,
    fontSize: 13,
    fontWeight: "900",
  },
  dailyClaimBtn: {
    backgroundColor: Colors.accentGold,
    borderRadius: 12,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dailyClaimBtnDisabled: {
    backgroundColor: "#4B5563",
  },
  dailyClaimBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  iapRow: {
    gap: 12,
    paddingVertical: 8,
    paddingRight: 8,
  },
  iapPill: {
    width: 132,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iapBlurb: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  iapAmt: {
    color: Colors.accentGold,
    fontSize: 22,
    fontWeight: "900",
  },
  iapUnit: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 12,
  },
  iapSoon: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceDark,
  },
  iapSoonText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
});
