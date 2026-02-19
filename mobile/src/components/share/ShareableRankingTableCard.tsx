import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../constants/Colors";

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

export function ShareableRankingTableCard({
  periodLabel,
  leaders,
}: ShareableRankingTableCardProps) {
  return (
    <View style={[styles.shadowWrap, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <View style={styles.card}>
        <LinearGradient
          colors={["#0F172A", "#020617"]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.inner}>
          {/* Branding dominante (como results) */}
          <View style={styles.brandBlock}>
            <Image source={LOGO_SOURCE} style={styles.logoBig} resizeMode="contain" />
            <Text style={styles.brandName}>tercertiempoxd</Text>
            <Text style={styles.brandSubtitle}>RANKING GENERAL · {periodLabel}</Text>
          </View>

          {/* Top jugadores - glassBox estilo widget */}
          <View style={[styles.glassBox, styles.listBlock]}>
            <Text style={styles.listTitle}>⭐ TOP JUGADORES</Text>
            {leaders.slice(0, 5).map((p, idx) => (
              <View key={`${p.name}-${idx}`} style={styles.row}>
                <Text style={styles.pos}>#{idx + 1}</Text>
                <View style={styles.nameCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name || "Jugador"}
                  </Text>
                  <Text style={styles.meta}>
                    PJ {p.played} · G {p.wins}
                  </Text>
                </View>
                <View style={styles.avgBadge}>
                  <Text style={styles.avgText}>{p.average.toFixed(1)}</Text>
                </View>
              </View>
            ))}
            {leaders.length === 0 && (
              <Text style={styles.empty}>Aún no hay datos.</Text>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerSub}>Generado en TercerTiempoXD</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
    backgroundColor: "#0F172A",
  },
  card: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    padding: 24,
    gap: 14,
  },
  brandBlock: { alignItems: "center", marginTop: 2 },
  logoBig: { width: 80, height: 80, opacity: 0.98 },
  brandName: {
    marginTop: 8,
    color: "rgba(255,255,255,0.92)",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "lowercase",
  },
  brandSubtitle: {
    marginTop: 4,
    color: "rgba(148,163,184,0.85)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  glassBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
  },
  listBlock: {
    flex: 1,
    marginTop: 4,
  },
  listTitle: {
    color: "rgba(249,250,251,0.9)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  pos: {
    width: 26,
    color: "rgba(148,163,184,0.9)",
    fontSize: 11,
    fontWeight: "900",
  },
  nameCol: { flex: 1 },
  name: {
    color: "rgba(248,250,252,0.95)",
    fontSize: 13,
    fontWeight: "700",
  },
  meta: {
    color: "rgba(148,163,184,0.85)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  avgBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.15)",
    alignItems: "center",
  },
  avgText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    marginTop: 4,
    color: "rgba(148,163,184,0.85)",
    fontSize: 11,
    fontStyle: "italic",
  },
  footer: { alignItems: "center", paddingTop: 6 },
  footerSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});

