import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_THEME } from "./profileConstants";
import type { ShowcaseOptionPreset } from "./profileConstants";

type ProfileShowcaseSectionProps = {
  isPro: boolean;
  showcaseSelection: string[];
  showcaseOptions: ShowcaseOptionPreset[];
  getShowcaseValue: (id: string) => string | number;
  activeAccent: string;
  onEditShowcase: () => void;
  onUnlockPro: () => void;
};

export function ProfileShowcaseSection({
  isPro,
  showcaseSelection,
  showcaseOptions,
  getShowcaseValue,
  activeAccent,
  onEditShowcase,
  onUnlockPro,
}: ProfileShowcaseSectionProps) {
  return (
    <>
      <View style={styles.showcaseHeaderRow}>
        <Text style={styles.sectionHeader}>VITRINA DE JUGADOR</Text>
        {isPro && (
          <TouchableOpacity
            onPress={onEditShowcase}
            style={[
              styles.editShowcaseBtn,
              { borderColor: activeAccent + "40", backgroundColor: activeAccent + "15" },
            ]}
          >
            <Ionicons name="pencil" size={12} color={activeAccent} />
            <Text style={[styles.editShowcaseText, { color: activeAccent }]}>EDITAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {isPro ? (
        <View style={styles.showcaseContainer}>
          {showcaseSelection.map((itemId) => {
            const itemConfig = showcaseOptions.find((opt) => opt.id === itemId);
            if (!itemConfig) return null;
            return (
              <View key={itemId} style={styles.showcaseSlot}>
                <View style={[styles.showcaseIconBox, { borderColor: activeAccent }]}>
                  <MaterialCommunityIcons
                    name={itemConfig.icon as any}
                    size={24}
                    color={activeAccent}
                  />
                </View>
                <Text style={styles.showcaseValue}>{getShowcaseValue(itemId)}</Text>
                <Text style={styles.showcaseLabel} numberOfLines={1}>
                  {itemConfig.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <TouchableOpacity style={styles.proUnlockCard} activeOpacity={0.9} onPress={onUnlockPro}>
          <View style={styles.proBadgeIcon}>
            <Ionicons name="diamond-sharp" size={24} color="#F59E0B" />
          </View>
          <View style={styles.proTextContainer}>
            <Text style={styles.proUnlockTitle}>VITRINA DE JUGADOR</Text>
            <Text style={styles.proUnlockDesc}>
              Únete al plan PRO para personalizar tu vitrina, marcos de avatar y banners.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  showcaseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sectionHeader: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  editShowcaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  editShowcaseText: { fontSize: 9, fontWeight: "900", marginLeft: 4 },
  showcaseContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  showcaseSlot: {
    flex: 1,
    backgroundColor: PROFILE_THEME.cardBg,
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  showcaseIconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    backgroundColor: PROFILE_THEME.bg,
  },
  showcaseValue: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2,
  },
  showcaseLabel: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  proUnlockCard: {
    backgroundColor: "#111827",
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F59E0B",
    flexDirection: "row",
    alignItems: "center",
  },
  proBadgeIcon: {
    width: 50,
    height: 60,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  proTextContainer: { flex: 1 },
  proUnlockTitle: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 2,
  },
  proUnlockDesc: {
    color: "#9CA3AF",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
});
