import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
const CARD_WIDTH = 340;
const CARD_HEIGHT = 520;

export type ShareableRankingTableCardProps = {
  periodLabel: string;
  leaders: {
    name: string;
    average: number;
    played: number;
    wins: number;
  }[];
};

const LOGO_SOURCE = require("../../../assets/images/Logo.png");
const ACCENT = "#EAB308";

export function ShareableRankingTableCard({
  periodLabel,
  leaders,
}: ShareableRankingTableCardProps) {
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
            <Text style={styles.subtitle}>Ranking · {periodLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.thPos}>#</Text>
            <Text style={styles.thName}>Jugador</Text>
            <Text style={styles.thMeta}>PJ</Text>
            <Text style={styles.thMeta}>G</Text>
            <Text style={styles.thAvg}>Prom</Text>
          </View>
          {leaders.slice(0, 5).map((p, idx) => (
            <View key={`${p.name}-${idx}`} style={styles.row}>
              <Text style={styles.pos}>{idx + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {p.name || "Jugador"}
              </Text>
              <Text style={styles.meta}>{p.played}</Text>
              <Text style={styles.meta}>{p.wins}</Text>
              <View style={styles.avgBadge}>
                <Text style={styles.avgText}>{p.average.toFixed(1)}</Text>
              </View>
            </View>
          ))}
          {leaders.length === 0 && (
            <Text style={styles.empty}>Aún no hay datos</Text>
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
    paddingHorizontal: 22,
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
    marginBottom: 18,
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
    padding: 14,
    minHeight: 0,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  thPos: {
    width: 22,
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
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
  thMeta: {
    width: 28,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
  },
  thAvg: {
    width: 44,
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  pos: {
    width: 22,
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "800",
  },
  name: {
    flex: 1,
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  meta: {
    width: 28,
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  avgBadge: {
    width: 44,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avgText: {
    color: ACCENT,
    fontSize: 12,
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
    marginTop: 14,
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
