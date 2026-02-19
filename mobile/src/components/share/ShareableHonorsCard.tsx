import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

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

export function ShareableHonorsCard({ leaders }: ShareableHonorsCardProps) {
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
            <Text style={styles.brandSubtitle}>SALÓN DE LA FAMA</Text>
          </View>

          {/* Honors - glassBox widget, columnas alineadas */}
          <View style={[styles.glassBox, styles.listBlock]}>
            <Text style={styles.listTitle}>🏆 Premios acumulados</Text>
            <View style={styles.tableHeader}>
              <View style={styles.colPosWrap} />
              <Text style={styles.colJugador}>Jugador</Text>
              <View style={styles.colStatWrap}>
                <MaterialCommunityIcons name="trophy" size={12} color="#F59E0B" />
              </View>
              <View style={styles.colStatWrap}>
                <MaterialCommunityIcons name="tree" size={12} color="#EF4444" />
              </View>
              <View style={styles.colStatWrap}>
                <MaterialCommunityIcons name="ghost" size={12} color="#A78BFA" />
              </View>
              <View style={styles.colStatWrap}>
                <MaterialCommunityIcons name="sword-cross" size={12} color="#10B981" />
              </View>
              <View style={styles.colStatWrap}>
                <MaterialCommunityIcons name="crystal-ball" size={12} color="#22D3EE" />
              </View>
            </View>

            {leaders.slice(0, 5).map((p, idx) => (
              <View key={`${p.name}-${idx}`} style={styles.row}>
                <Text style={styles.colPos}>#{idx + 1}</Text>
                <Text style={styles.colJugador} numberOfLines={1}>
                  {p.name || "Jugador"}
                </Text>
                <Text style={[styles.colStat, { color: "#F59E0B" }]}>{p.mvp}</Text>
                <Text style={[styles.colStat, { color: "#EF4444" }]}>{p.tronco}</Text>
                <Text style={[styles.colStat, { color: "#A78BFA" }]}>{p.fantasma}</Text>
                <Text style={[styles.colStat, { color: "#10B981" }]}>{p.duel}</Text>
                <Text style={[styles.colStat, { color: "#22D3EE" }]}>{p.prode}</Text>
              </View>
            ))}

            {leaders.length === 0 && (
              <Text style={styles.empty}>Aún no hay medallero.</Text>
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
    gap: 16,
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
    color: "rgba(248,250,252,0.95)",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  colPosWrap: { width: 26 },
  colPos: {
    width: 26,
    color: "rgba(148,163,184,0.9)",
    fontSize: 10,
    fontWeight: "900",
  },
  colStatWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  colJugador: {
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
    color: "rgba(248,250,252,0.95)",
    fontSize: 11,
    fontWeight: "800",
  },
  colStat: {
    width: 24,
    textAlign: "center" as const,
    fontSize: 11,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
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

