import React, { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { TTP_SALDO_ALERT_BODY, TTP_SALDO_ALERT_TITLE } from "../../constants/ttpSaldoHelp";
import { useTtp } from "../../context/TtpContext";

export function TtpBadge({
  style,
  compact = true,
  /** Sin texto "Mi saldo": solo ícono + TTP + número (menos ancho en headers). */
  minimal = false,
}: {
  style?: ViewStyle;
  compact?: boolean;
  minimal?: boolean;
}) {
  const ttp = useTtp();
  const value = typeof ttp?.balance === "number" ? ttp.balance : null;
  const [helpVisible, setHelpVisible] = useState(false);

  const bodyLines = useMemo(
    () =>
      String(TTP_SALDO_ALERT_BODY)
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0),
    [],
  );

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.pill, compact && styles.pillCompact]} pointerEvents="none">
        <View style={styles.iconWrap}>
          <Ionicons name="cash-outline" size={14} color={stylesVars.gold} />
        </View>
        {!minimal ? (
          <Text style={styles.label}>Mi saldo</Text>
        ) : (
          <Text style={styles.labelMinimal}>TTP</Text>
        )}
        <Text style={styles.value}>{value ?? "—"}</Text>
      </View>
      <TouchableOpacity
        onPress={() => setHelpVisible(true)}
        style={styles.infoBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Cómo se ganan los TTP"
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={18} color={stylesVars.gold} />
      </TouchableOpacity>

      <Modal
        visible={helpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setHelpVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="information-circle" size={20} color={stylesVars.gold} />
                <Text style={styles.modalTitle}>{TTP_SALDO_ALERT_TITLE}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHelpVisible(false)}
                activeOpacity={0.8}
                style={styles.modalCloseBtn}
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.72)" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {bodyLines.map((line, idx) => {
                const isBullet = line.startsWith("•");
                const text = isBullet ? line.replace(/^•\s?/, "") : line;
                return (
                  <View key={`${idx}-${line}`} style={styles.lineRow}>
                    {isBullet ? <View style={styles.bulletDot} /> : <View style={styles.lineSpacer} />}
                    <Text style={styles.modalBodyText}>{text}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const stylesVars = {
  gold: "#F59E0B",
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillCompact: {
    paddingHorizontal: 8,
    height: 30,
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
    marginRight: 6,
  },
  label: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.35,
    marginRight: 6,
    textTransform: "uppercase",
  },
  labelMinimal: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginRight: 5,
  },
  value: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#1F2937",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.28)",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  modalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  modalScroll: {
    maxHeight: 430,
  },
  modalScrollContent: {
    paddingBottom: 4,
    gap: 8,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(245, 158, 11, 0.85)",
    marginTop: 7,
  },
  lineSpacer: {
    width: 6,
    height: 6,
    marginTop: 7,
  },
  modalBodyText: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});

