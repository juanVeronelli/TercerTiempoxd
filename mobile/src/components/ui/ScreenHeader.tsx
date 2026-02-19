import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { NotificationBell } from "../NotificationBell";

const SIDE_WIDTH = 88;

export type ScreenHeaderProps = {
  /** Título centrado en el header */
  title: string;
  /** Si es true, muestra el botón Atrás a la izquierda (default: false) */
  showBack?: boolean;
  /** Si es true, muestra la campana de notificaciones a la derecha (default: true) */
  showBell?: boolean;
  /** Elemento opcional a la derecha (reemplaza o complementa la campana según showBell) */
  rightAction?: React.ReactNode;
  /** Elemento opcional para el centro (reemplaza el título) - ej. selector de liga */
  centerElement?: React.ReactNode;
  /** Alineación del centro: "center" (default) o "left" (para Home/selector de liga) */
  centerAlign?: "center" | "left";
  /** Estilo opcional del contenedor */
  style?: ViewStyle;
};

/**
 * Cabecera unificada con centrado matemático perfecto.
 * Usa contenedores de ancho fijo a izquierda y derecha para que el título
 * quede centrado independientemente de si hay botón atrás o campana.
 */
export function ScreenHeader({
  title,
  showBack = false,
  showBell = true,
  rightAction,
  centerElement,
  centerAlign = "center",
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top || 12,
          paddingBottom: 12,
        },
        style,
      ]}
    >
      {/* Izquierda: ancho fijo 88 o 0 si no hay back y centro a la izq (Home) */}
      <View style={[styles.side, !showBack && centerAlign === "left" && styles.sideCollapsed]}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Centro: título o elemento custom */}
      <View style={[styles.center, centerAlign === "left" && styles.centerLeft]}>
        {centerElement ?? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      {/* Derecha: ancho fijo 48 para equilibrio */}
      <View style={[styles.side, styles.rightRow]}>
        {rightAction}
        {showBell ? (
          <NotificationBell />
        ) : !rightAction ? (
          <View style={styles.placeholder} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
  },
  side: {
    width: SIDE_WIDTH,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideCollapsed: {
    width: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  rightRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  placeholder: {
    width: SIDE_WIDTH,
    height: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  centerLeft: {
    alignItems: "flex-start",
    paddingLeft: 0,
  },
  title: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "700",
  },
});
