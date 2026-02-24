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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { PurchaseManager, PRO_ENTITLEMENT_ID } from "../../src/services/PurchaseManager";
import { useCustomAlert } from "../../src/context/AlertContext";
import { PAYWALL_OFFERING_ID } from "../../src/services/SubscriptionUI";
import type { PurchasesPackage } from "react-native-purchases";

const PRO_FEATURES = [
  "Remover anuncios",
  "3 slots adicionales para ligas",
  "Features con IA",
  "Estadísticas avanzadas",
  "Personalización y cosméticos",
];

/**
 * Paywall premium que usa datos de RevenueCat (offering, precios).
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

  const isAnnualPlan = (pkg: PurchasesPackage) => {
    const label = planLabel(pkg);
    return label === "Anual";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/Logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Tercer Tiempo"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Desbloquea el Potencial Completo</Text>
          <Text style={styles.headerSubtitle}>
            Únete a PRO y lleva tu experiencia de fútbol al siguiente nivel.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          {PRO_FEATURES.map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="checkmark" size={16} color={Colors.textPrimary} />
              </View>
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.primary}
            style={styles.loader}
          />
        ) : packages.length === 0 ? (
          <Text style={styles.noPlans}>
            No hay planes disponibles. Revisa la configuración en RevenueCat.
          </Text>
        ) : (
          <>
            <View style={styles.plansSection}>
              {packages.map((pkg, index) => {
                const label = planLabel(pkg);
                const showBadge = isAnnualPlan(pkg);
                const isSelected = selectedIndex === index;

                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedIndex(index)}
                    activeOpacity={0.85}
                  >
                    {showBadge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Ahorra 20%</Text>
                      </View>
                    )}
                    <View style={styles.planCardContent}>
                      <Text style={styles.planTitle}>{label}</Text>
                      <Text style={styles.planPrice}>
                        {pkg.product?.priceString ?? "—"}
                      </Text>
                      {pkg.product?.introPrice?.priceString ? (
                        <Text style={styles.planIntro}>
                          {pkg.product.introPrice.priceString} por período
                          introductorio
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.cta, purchasing && styles.ctaDisabled]}
              onPress={handlePurchase}
              disabled={purchasing}
              activeOpacity={0.9}
            >
              {purchasing ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.ctaText}>Suscribirse Ahora</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.legal}>
          <TouchableOpacity
            onPress={() => Linking.openURL("http://tercertiempoxd.com/terminos")}
          >
            <Text style={styles.legalLink}>Términos</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}> · </Text>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://tercertiempoxd.com/privacidad")
            }
          >
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 64,
    height: 64,
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 32,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.status.success + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  loader: {
    marginVertical: 32,
  },
  noPlans: {
    color: Colors.textSecondary,
    textAlign: "center",
    marginVertical: 32,
    fontSize: 15,
  },
  plansSection: {
    marginBottom: 28,
    gap: 14,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    minHeight: 88,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 3,
    backgroundColor: Colors.primary + "12",
  },
  badge: {
    position: "absolute",
    top: -1,
    right: 16,
    backgroundColor: Colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
  planCardContent: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.primary,
    marginTop: 2,
  },
  planIntro: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  cta: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.textInverse,
  },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  legalLink: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  legalSep: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
});
