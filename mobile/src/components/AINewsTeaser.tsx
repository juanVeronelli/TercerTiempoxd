import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

// TEMA IA: Indigo Profundo + Dorado (Premium Tech)
const AI_THEME = {
  bg: "#1E1B4B", // Indigo muy oscuro (El fondo que te gusta)
  border: "#4338ca", // Borde Indigo un poco más claro
  gold: "#F59E0B", // Dorado (Tu color principal) - Reemplaza al Cyan
  text: "#FFFFFF", // Blanco
  textSub: "#C7D2FE", // Lavanda muy claro para lectura fácil
};

export const AINewsTeaser = () => {
  return (
    <View style={styles.container}>
      {/* Badge "Próximamente" - Ahora en Dorado */}
      <View style={styles.comingSoonBadge}>
        <Ionicons name="hourglass-outline" size={10} color={AI_THEME.gold} />
        <Text style={styles.comingSoonText}>PRÓXIMAMENTE</Text>
      </View>

      <View style={styles.contentRow}>
        {/* Icono de IA */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="robot-confused-outline"
            size={30}
            color={AI_THEME.gold}
          />
          {/* Destello decorativo */}
          <View style={styles.sparkle}>
            <MaterialCommunityIcons
              name="star-four-points"
              size={12}
              color="white"
            />
          </View>
        </View>

        {/* Textos */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            DIARIO CON{" "}
            <Text style={{ color: AI_THEME.gold, fontWeight: "900" }}>IA</Text>
          </Text>
          <Text style={styles.description}>
            Crónicas, entrevistas y análisis de partido generados
            automáticamente por la IA.
          </Text>
        </View>
      </View>

      {/* Marca de agua de fondo (Sutil en blanco/dorado) */}
      <View style={styles.techGrid} />
      <View style={styles.techCircle} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: AI_THEME.bg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: AI_THEME.border,
    position: "relative",
    overflow: "hidden",
    minHeight: 115,
    justifyContent: "center",
    // Sombra violeta para destacar
    shadowColor: "#4338ca",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  comingSoonBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)", // Borde dorado sutil
    zIndex: 10,
    gap: 4,
  },
  comingSoonText: {
    color: AI_THEME.gold,
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    zIndex: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(67, 56, 202, 0.3)", // Fondo indigo translúcido
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(67, 56, 202, 0.5)",
    position: "relative",
  },
  sparkle: {
    position: "absolute",
    top: -6,
    right: -6,
    opacity: 0.9,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  description: {
    color: AI_THEME.textSub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
  },

  // --- ELEMENTOS DE FONDO ---
  techGrid: {
    position: "absolute",
    bottom: -30,
    right: -20,
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    transform: [{ rotate: "15deg" }],
    zIndex: 1,
  },
  techCircle: {
    position: "absolute",
    bottom: -20,
    right: -10,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 15,
    borderColor: "rgba(245, 158, 11, 0.03)", // Anillo dorado apenas visible
    zIndex: 1,
  },
});
