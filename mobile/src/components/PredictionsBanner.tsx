import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const ACTIVE_COLOR = "#F59E0B"; // Dorado

interface PredictionsBannerProps {
  leagueId: string;
}

export const PredictionsBanner = ({ leagueId }: PredictionsBannerProps) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        // Navegamos a la pantalla de predicciones pasando el ID de la liga
        router.push({
          pathname: "/(main)/league/predictions",
          params: { leagueId },
        });
      }}
    >
      <View style={styles.content}>
        {/* Icono Principal */}
        <View style={styles.iconBox}>
          <MaterialCommunityIcons
            name="crystal-ball"
            size={24}
            color={ACTIVE_COLOR}
          />
        </View>

        {/* Textos */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            PRODE / PREDICCIONES
          </Text>
        </View>

        {/* Botón Call To Action */}
        <View style={styles.ctaBadge}>
          <Text style={styles.ctaText}>JUGAR</Text>
          <Ionicons name="chevron-forward" size={14} color="#111827" />
        </View>
      </View>

      {/* Decoración de fondo (opcional para darle toque premium) */}
      <View style={styles.decorationCircle} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.26)", // Borde dorado sutil
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    zIndex: 2, // Para que esté sobre la decoración
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)", // Fondo dorado muy suave
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  title: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 0,
    textTransform: "uppercase",
  },
  ctaBadge: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  ctaText: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  // Elemento decorativo sutil
  decorationCircle: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    zIndex: 1,
  },
});
