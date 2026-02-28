import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
const CARD_WIDTH = 340;
const CARD_HEIGHT = 520;

export type ShareableMatchCardProps = {
  teamAName?: string;
  teamBName?: string;
  scoreA: number;
  scoreB: number;
  locationName?: string;
  mvp?: { name: string; rating: number | string } | null;
  tronco?: { name: string; rating: number | string } | null;
  top3Figures?: { name: string; rating: number }[];
  top3Prode?: { name: string; points: number }[];
};

const LOGO_SOURCE = require("../../../assets/images/Logo.png");
const ACCENT = "#EAB308";
const ACCENT_SUBTLE = "rgba(234, 179, 8, 0.12)";

function clampName(name: string) {
  return (name || "Jugador").trim();
}

function formatRating(val: number | string | undefined) {
  if (val == null) return "—";
  const n = typeof val === "string" ? Number(val) : val;
  if (Number.isFinite(n)) return n.toFixed(1);
  return String(val);
}

export function ShareableMatchCard({
  teamAName = "Equipo A",
  teamBName = "Equipo B",
  scoreA,
  scoreB,
  locationName,
  mvp,
  tronco,
  top3Figures = [],
  top3Prode = [],
}: ShareableMatchCardProps) {
  return (
    <View style={[styles.root, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <LinearGradient
        colors={["#0c1222", "#070b14", "#050810"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        {/* Top accent bar */}
        <View style={styles.accentBar} />

        {/* Header: logo + brand */}
        <View style={styles.header}>
          <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Tercer Tiempo</Text>
        </View>

        {/* Scoreboard hero */}
        <View style={styles.scoreboard}>
          <Text style={styles.teamName} numberOfLines={1}>
            {teamAName}
          </Text>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>{scoreA ?? 0}</Text>
            <View style={styles.scoreDivider} />
            <Text style={styles.scoreValue}>{scoreB ?? 0}</Text>
          </View>
          <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={1}>
            {teamBName}
          </Text>
        </View>
        {locationName ? (
          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={12}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.location} numberOfLines={1}>
              {locationName}
            </Text>
          </View>
        ) : null}

        {/* MVP / Tronco — two columns */}
        <View style={styles.heroRow}>
          <View style={styles.heroHalf}>
            <View style={styles.heroLabel}>
              <MaterialCommunityIcons name="crown" size={14} color={ACCENT} />
              <Text style={styles.heroLabelText}>MVP</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {clampName(mvp?.name || "—")}
            </Text>
            <Text style={styles.heroValue}>{formatRating(mvp?.rating)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={[styles.heroHalf, styles.heroHalfRight]}>
            <View style={[styles.heroLabel, styles.heroLabelRight]}>
              <Text style={styles.troncoLabelText}>Tronco</Text>
              <MaterialCommunityIcons name="tree" size={14} color="#78716c" />
            </View>
            <Text style={[styles.heroName, styles.heroNameRight]} numberOfLines={1}>
              {clampName(tronco?.name || "—")}
            </Text>
            <Text style={[styles.heroValue, styles.troncoValue]}>{formatRating(tronco?.rating)}</Text>
          </View>
        </View>

        {/* Figuras & Prode */}
        <View style={styles.rankSection}>
          <View style={styles.rankCol}>
            <View style={styles.rankColHeader}>
              <MaterialCommunityIcons name="star" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.rankColTitle}>Figuras</Text>
            </View>
            {top3Figures.slice(0, 3).map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.rankRow}>
                <Text style={styles.rankPos}>{i + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>{clampName(p.name)}</Text>
                <Text style={styles.rankNum}>{p.rating.toFixed(1)}</Text>
              </View>
            ))}
            {top3Figures.length === 0 && (
              <Text style={styles.rankEmpty}>—</Text>
            )}
          </View>
          <View style={styles.rankCol}>
            <View style={styles.rankColHeader}>
              <MaterialCommunityIcons name="crystal-ball" size={12} color={ACCENT} />
              <Text style={styles.rankColTitle}>Prode</Text>
            </View>
            {top3Prode.slice(0, 3).map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.rankRow}>
                <Text style={styles.rankPos}>{i + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>{clampName(p.name)}</Text>
                <Text style={[styles.rankNum, styles.rankNumGold]}>{p.points}</Text>
              </View>
            ))}
            {top3Prode.length === 0 && (
              <Text style={styles.rankEmpty}>—</Text>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
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
    marginBottom: 20,
    gap: 8,
  },
  logo: { width: 28, height: 28, opacity: 0.95 },
  brand: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  teamName: {
    flex: 1,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  teamNameRight: { textAlign: "right" },
  scoreBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  scoreValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
    minWidth: 32,
    textAlign: "center",
  },
  scoreDivider: {
    width: 2,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 14,
    borderRadius: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 18,
  },
  location: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  heroRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  heroHalf: { flex: 1 },
  heroHalfRight: { alignItems: "flex-end" },
  heroDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 10,
  },
  heroLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroLabelRight: { justifyContent: "flex-end" },
  heroLabelText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  troncoLabelText: {
    color: "#78716c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  heroName: {
    marginTop: 6,
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: "700",
  },
  heroValue: {
    marginTop: 4,
    color: ACCENT,
    fontSize: 16,
    fontWeight: "800",
  },
  troncoValue: {
    color: "#78716c",
    textAlign: "right",
  },
  rankSection: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  rankCol: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 12,
  },
  rankColHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rankColTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rankPos: {
    width: 18,
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "800",
  },
  rankName: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  rankNum: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "800",
  },
  rankNumGold: { color: ACCENT },
  rankEmpty: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontStyle: "italic",
  },
  footer: {
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerLine: { display: "none" },
  footerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "lowercase",
  },
});
