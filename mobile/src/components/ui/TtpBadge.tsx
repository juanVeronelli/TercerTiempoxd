import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { TTP_SALDO_ALERT_BODY, TTP_SALDO_ALERT_TITLE } from "../../constants/ttpSaldoHelp";
import { useCustomAlert } from "../../context/AlertContext";
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
  const alert = useCustomAlert();
  const value = typeof ttp?.balance === "number" ? ttp.balance : null;

  const showSaldoHelp = () => {
    alert.showAlert(TTP_SALDO_ALERT_TITLE, TTP_SALDO_ALERT_BODY, undefined, "info");
  };

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
        onPress={showSaldoHelp}
        style={styles.infoBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Cómo se ganan los TTP"
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={18} color={stylesVars.gold} />
      </TouchableOpacity>
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
    paddingVertical: 4,
    paddingHorizontal: 2,
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
});

