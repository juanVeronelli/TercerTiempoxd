import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { PurchaseManager, PRO_ENTITLEMENT_ID } from "../../src/services/PurchaseManager";
import { useCustomAlert } from "../../src/context/AlertContext";
import { PAYWALL_OFFERING_ID } from "../../src/services/SubscriptionUI";
import type { PurchasesPackage } from "react-native-purchases";

/**
 * Paywall estilizado que usa datos de RevenueCat (offering, precios).
 * Al comprar: purchasePackage → syncProToBackend → actualiza plan en backend.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const offerings = await PurchaseManager.fetchOfferings();
      const offering =
        offerings?.all?.[PAYWALL_OFFERING_ID] ?? offerings?.current;
      const pkgs = offering?.availablePackages ?? [];
      setPackages(pkgs);
      if (pkgs.length > 0) setSelectedIndex(0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const handlePurchase = async () => {
    const pkg = packages[selectedIndex];
    if (!pkg) {
      showAlert("Error", "Selecciona un plan.");
      return;
    }
    setPurchasing(true);
    try {
      await PurchaseManager.purchasePackage(pkg);
      await PurchaseManager.syncProToBackend(true).catch(() =>
        PurchaseManager.syncProToBackend(true),
      );
      showAlert("¡Listo!", "Ya eres PRO. Disfruta de todos los beneficios.");
      router.back();
    } catch (e: any) {
      if (e?.userCancelled) return;
      showAlert("Error", e?.message ?? "No se pudo completar la compra.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const info = await PurchaseManager.restorePurchases();
      const hasPro = info.entitlements.active[PRO_ENTITLEMENT_ID]?.isActive;
      if (hasPro) {
        await PurchaseManager.syncProToBackend(true).catch(() => {});
        showAlert("Restaurado", "Tu suscripción PRO ha sido restaurada.");
        router.back();
      } else {
        showAlert("Sin compras", "No encontramos una suscripción activa.");
      }
    } catch {
      showAlert("Error", "No se pudieron restaurar las compras.");
    } finally {
      setPurchasing(false);
    }
  };

  const planLabel = (pkg: PurchasesPackage) => {
    const id = (pkg.identifier ?? "").toLowerCase();
    if (id.includes("annual") || id.includes("yearly")) return "Anual";
    if (id.includes("monthly") || id.includes("month")) return "Mensual";
    if (id.includes("6") || id.includes("six")) return "Cada 6 meses";
    return pkg.packageType ?? "Pro";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hazte PRO</Text>
          <Text style={styles.headerSubtitle}>
            Sin anuncios, estadísticas avanzadas y más.
          </Text>
        </View>

        <View style={styles.benefits}>
          {["Sin publicidad", "Estadísticas avanzadas", "Gestión ilimitada"].map(
            (item, i) => (
              <View key={i} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            )
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={styles.noPlans}>
            No hay planes disponibles. Revisa la configuración en RevenueCat.
          </Text>
        ) : (
          <>
            <View style={styles.plansSection}>
              {packages.map((pkg, index) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.planCard,
                    selectedIndex === index && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedIndex(index)}
                  activeOpacity={0.8}
                >
                  <View style={styles.planContent}>
                    <Text style={styles.planTitle}>{planLabel(pkg)}</Text>
                    <Text style={styles.planPrice}>
                      {pkg.product?.priceString ?? "—"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedIndex === index && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedIndex === index && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.cta, purchasing && styles.ctaDisabled]}
              onPress={handlePurchase}
              disabled={purchasing}
              activeOpacity={0.9}
            >
              {purchasing ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : (
                <Text style={styles.ctaText}>Suscribirme</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.legal}>
          <TouchableOpacity onPress={() => Linking.openURL("https://tercertiempo.com/terminos")}>
            <Text style={styles.legalLink}>Términos</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://tercertiempo.com/privacidad")}>
            <Text style={styles.legalLink}>Privacidad</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity onPress={handleRestore} disabled={purchasing}>
            <Text style={styles.legalLink}>Restaurar compras</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={Colors.textSecondary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingTop: 48, paddingBottom: 40, paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  benefits: { marginBottom: 28, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitText: { fontSize: 16, color: Colors.textPrimary, fontWeight: "600" },
  noPlans: { color: Colors.textSecondary, textAlign: "center", marginVertical: 24 },
  plansSection: { marginBottom: 24, gap: 12 },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  planCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + "15",
  },
  planContent: { flex: 1 },
  planTitle: { fontSize: 17, fontWeight: "800", color: Colors.textPrimary },
  planPrice: { fontSize: 18, fontWeight: "900", color: Colors.accent, marginTop: 4 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: Colors.accent },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  cta: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { fontSize: 16, fontWeight: "900", color: Colors.background },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  legalLink: { fontSize: 12, color: Colors.textSecondary },
  legalSep: { fontSize: 12, color: Colors.textSecondary },
  closeBtn: { position: "absolute", top: 10, right: 20, padding: 8 },
});
