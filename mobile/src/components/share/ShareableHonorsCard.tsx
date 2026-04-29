import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
const CARD_WIDTH = 340;
const CARD_HEIGHT = 520;

export type ShareableHonorsCardProps = {
  leaders: {
    name: string;
    mvp: number;
    tronco: number;
    fantasma: number;
    duel: number;
    prode: number;
  }[];
};

const LOGO_SOURCE = require("../../../assets/images/Logo.png");
const ACCENT = "#EAB308";
const COLORS = {
  mvp: "#EAB308",
  tronco: "#78716c",
  fantasma: "#A78BFA",
  duel: "#10B981",
  prode: "#22D3EE",
};

export function ShareableHonorsCard({ leaders }: ShareableHonorsCardProps) {
  return (
    <View style={[styles.root, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <LinearGradient
        colors={["#0c1222", "#070b14", "#050810"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <View style={styles.accentBar} />

        <View style={styles.header}>
          <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.brand}>Tercer Tiempo</Text>
            <Text style={styles.subtitle}>Salón de la fama</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.thPos}>#</Text>
            <Text style={styles.thName}>Jugador</Text>
            <View style={styles.thIcon}><MaterialCommunityIcons name="trophy" size={12} color={COLORS.mvp} /></View>
            <View style={styles.thIcon}><MaterialCommunityIcons name="tree" size={12} color={COLORS.tronco} /></View>
            <View style={styles.thIcon}><MaterialCommunityIcons name="ghost" size={12} color={COLORS.fantasma} /></View>
            <View style={styles.thIcon}><MaterialCommunityIcons name="sword-cross" size={12} color={COLORS.duel} /></View>
            <View style={styles.thIcon}><MaterialCommunityIcons name="crystal-ball" size={12} color={COLORS.prode} /></View>
          </View>
          {leaders.slice(0, 5).map((p, idx) => (
            <View key={`${p.name}-${idx}`} style={styles.row}>
              <Text style={styles.pos}>{idx + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {p.name || "Jugador"}
              </Text>
              <Text style={[styles.stat, { color: COLORS.mvp }]}>{p.mvp}</Text>
              <Text style={[styles.stat, { color: COLORS.tronco }]}>{p.tronco}</Text>
              <Text style={[styles.stat, { color: COLORS.fantasma }]}>{p.fantasma}</Text>
              <Text style={[styles.stat, { color: COLORS.duel }]}>{p.duel}</Text>
              <Text style={[styles.stat, { color: COLORS.prode }]}>{p.prode}</Text>
            </View>
          ))}
          {leaders.length === 0 && (
            <Text style={styles.empty}>Aún no hay medallero</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>tercertiempoxd</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0c1222",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: ACCENT,
    opacity: 0.9,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  logo: { width: 28, height: 28, opacity: 0.95 },
  brand: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginTop: 2,
    textTransform: "uppercase",
  },
  table: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    minHeight: 0,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  thPos: {
    width: 20,
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
  },
  thName: {
    flex: 1,
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  thIcon: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  pos: {
    width: 20,
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "800",
  },
  name: {
    flex: 1,
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  stat: {
    width: 22,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  empty: {
    paddingVertical: 20,
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "lowercase",
  },
});
