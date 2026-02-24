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

export type ScreenHeaderProps = {
  /** Título centrado en el header */
  title: string;
  /** Si es true, muestra el botón Atrás a la izquierda (default: false) */
  showBack?: boolean;
  /** Acción custom al presionar Atrás; si no se pasa, usa router.back() */
  onBackPress?: () => void;
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

const HEADER_HEIGHT = 44;

/**
 * Cabecera unificada: título centrado absoluto, acciones a los lados.
 */
export function ScreenHeader({
  title,
  showBack = false,
  onBackPress,
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
          paddingTop: insets.top || 10,
          minHeight: HEADER_HEIGHT + (insets.top || 10),
        },
        style,
      ]}
    >
      {/* Izquierda */}
      <View style={styles.leftSlot}>
        {showBack ? (
          <TouchableOpacity
            onPress={onBackPress ?? (() => router.back())}
            style={styles.iconBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Centro: título centrado en la fila (alineado con iconos) */}
      <View
        style={[
          styles.centerSlot,
          {
            top: insets.top || 10,
            height: HEADER_HEIGHT,
          },
          centerAlign === "left" && styles.centerSlotLeft,
        ]}
        pointerEvents="box-none"
      >
        {centerElement ?? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      {/* Derecha: iconos alineados */}
      <View style={styles.rightSlot}>
        {rightAction}
        {showBell ? <NotificationBell /> : null}
        {!rightAction && !showBell ? <View style={{ width: 44 }} /> : null}
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
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  leftSlot: {
    minWidth: 44,
    height: HEADER_HEIGHT,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  centerSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 64,
  },
  centerSlotLeft: {
    alignItems: "flex-start",
    paddingLeft: 44 + 8,
  },
  rightSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    minWidth: 44,
  },
  title: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
