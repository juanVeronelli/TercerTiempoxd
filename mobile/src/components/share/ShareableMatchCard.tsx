import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

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

function clampName(name: string) {
  return (name || "Jugador").trim();
}

function formatRating(val: number | string | undefined) {
  if (val == null) return "-";
  const n = typeof val === "string" ? Number(val) : val;
  if (Number.isFinite(n)) return n.toFixed(1);
  return String(val);
}

export function ShareableMatchCard({
  teamAName = "EQUIPO A",
  teamBName = "EQUIPO B",
  scoreA,
  scoreB,
  locationName,
  mvp,
  tronco,
  top3Figures = [],
  top3Prode = [],
}: ShareableMatchCardProps) {
  return (
    <View style={[styles.shadowWrap, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <View style={styles.card}>
        <LinearGradient
          colors={["#0F172A", "#020617"]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.inner}>
          {/* Branding dominante */}
          <View style={styles.brandBlock}>
            <Image source={LOGO_SOURCE} style={styles.logoBig} resizeMode="contain" />
            <Text style={styles.brandName}>tercertiempoxd</Text>
          </View>

          {/* Partido */}
          <View style={[styles.glassBox, styles.matchBox]}>
            <View style={styles.matchRow}>
              <Text style={styles.teamSide} numberOfLines={1}>
                {teamAName}
              </Text>
              <Text style={styles.scoreBig}>
                {scoreA ?? 0}
                <Text style={styles.scoreBigDim}>-</Text>
                {scoreB ?? 0}
              </Text>
              <Text style={[styles.teamSide, { textAlign: "right" }]} numberOfLines={1}>
                {teamBName}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={14}
                color="rgba(255,255,255,0.65)"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.location} numberOfLines={1}>
                {locationName ? locationName : "Cancha"}
              </Text>
            </View>
          </View>

          {/* Héroe y villano */}
          <View style={[styles.glassBox, styles.heroVillainRow]}>
            <View style={styles.half}>
              <View style={styles.hvTitleRow}>
                <MaterialCommunityIcons name="crown" size={16} color="#F59E0B" />
                <Text style={styles.mvpTitle}>MVP</Text>
              </View>
              <Text style={styles.hvName} numberOfLines={1}>
                {clampName(mvp?.name || "—")}
              </Text>
              <Text style={styles.mvpValue}>{formatRating(mvp?.rating)}</Text>
            </View>

            <View style={styles.hvDivider} />

            <View style={styles.half}>
              <View style={[styles.hvTitleRow, { justifyContent: "flex-end" }]}>
                <Text style={styles.troncoTitle}>TRONCO</Text>
                <MaterialCommunityIcons name="tree" size={16} color="#A8A29E" />
              </View>
              <Text style={[styles.hvName, { textAlign: "right" }]} numberOfLines={1}>
                {clampName(tronco?.name || "—")}
              </Text>
              <Text style={styles.troncoValue}>{formatRating(tronco?.rating)}</Text>
            </View>
          </View>

          {/* Rankings compactos */}
          <View style={styles.rankingsRow}>
            <View style={[styles.glassBox, styles.rankCol]}>
              <Text style={styles.rankTitle}>⭐ Figuras</Text>
              {top3Figures.slice(0, 3).map((p, i) => (
                <View key={`${p.name}-${i}`} style={styles.rankLine}>
                  <Text style={styles.rankPos}>#{i + 1}</Text>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {clampName(p.name)}
                  </Text>
                  <Text style={styles.rankVal}>{p.rating.toFixed(1)}</Text>
                </View>
              ))}
              {top3Figures.length === 0 && <Text style={styles.rankEmpty}>—</Text>}
            </View>

            <View style={[styles.glassBox, styles.rankCol]}>
              <Text style={styles.rankTitle}>🔮 Prode</Text>
              {top3Prode.slice(0, 3).map((p, i) => (
                <View key={`${p.name}-${i}`} style={styles.rankLine}>
                  <Text style={styles.rankPos}>#{i + 1}</Text>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {clampName(p.name)}
                  </Text>
                  <Text style={styles.rankValGold}>{p.points}</Text>
                </View>
              ))}
              {top3Prode.length === 0 && <Text style={styles.rankEmpty}>—</Text>}
            </View>
          </View>

          {/* Footer */}
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

  glassBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
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

  matchBox: {
    paddingVertical: 16,
  },
  matchRow: { flexDirection: "row", alignItems: "center" },
  teamSide: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreBig: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: 1,
    marginHorizontal: 8,
  },
  scoreBigDim: { color: "rgba(255,255,255,0.55)" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  location: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  heroVillainRow: {
    flexDirection: "row",
    paddingVertical: 14,
  },
  half: { flex: 1 },
  hvDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginHorizontal: 12,
  },
  hvTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mvpTitle: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  troncoTitle: {
    color: "#A8A29E",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginRight: 6,
  },
  hvName: {
    marginTop: 8,
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "800",
  },
  mvpValue: {
    marginTop: 6,
    color: "#FBBF24",
    fontSize: 18,
    fontWeight: "900",
  },
  troncoValue: {
    marginTop: 6,
    color: "#A8A29E",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },

  rankingsRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  rankCol: { flex: 1, paddingVertical: 12 },
  rankTitle: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  rankLine: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  rankPos: {
    width: 26,
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "900",
  },
  rankName: {
    flex: 1,
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "700",
  },
  rankVal: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "900",
  },
  rankValGold: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "900",
  },
  rankEmpty: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontStyle: "italic",
  },

  footer: { alignItems: "center", paddingTop: 6 },
  footerSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
