import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

// Mismo estilo que Pretemporada pero en azul de match (primary)
const THEME = {
  bg: "#1E3A5F",
  border: "#2563EB",
  accent: Colors.primary,
  text: "#FFFFFF",
  textSub: "#93C5FD",
};

export type AdminFirstMatchHeroProps = {
  /** Navegación al crear partido (ej: router.push a match/create con leagueId) */
  onProgramMatch: () => void;
};

/**
 * Tarjeta protagonista para admins: mismo estilo que Pretemporada, azul match.
 */
export function AdminFirstMatchHero({
  onProgramMatch,
}: AdminFirstMatchHeroProps) {
  return (
    <View style={styles.container}>
      {/* Marca de agua: grande, sale desde la esquina, no se ve completa */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Ionicons
          name="calendar"
          size={130}
          color={THEME.accent}
          style={styles.watermarkIcon}
        />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconContainer}>
          <Ionicons name="calendar" size={26} color={THEME.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>PRIMER PARTIDO</Text>
          <Text style={styles.description}>
            La liga está lista. Convoca a los jugadores y programa el primer
            partido de fútbol en cancha (5, 7 u 11).
          </Text>
        </View>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={onProgramMatch}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={THEME.accent} />
          <Text style={styles.ctaBtnText}>Crear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.bg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    position: "relative",
    overflow: "hidden",
    minHeight: 100,
    justifyContent: "center",
    shadowColor: THEME.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  watermarkWrap: {
    position: "absolute",
    bottom: -45,
    right: -35,
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkIcon: {
    opacity: 0.07,
    transform: [{ rotate: "15deg" }],
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(38, 72, 209, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(38, 72, 209, 0.5)",
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  description: {
    color: THEME.textSub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.accent,
    backgroundColor: "rgba(38, 72, 209, 0.2)",
  },
  ctaBtnText: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: "700",
  },
});
