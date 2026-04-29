import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { NotificationBell } from "../NotificationBell";
import { TtpBadge } from "./TtpBadge";
import { IconButton } from "./IconButton";

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
  /** Mostrar saldo TTP a la derecha (default: true) */
  showTtp?: boolean;
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
  showTtp = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  // Valores iniciales generosos a la derecha si hay TTP + campana, para evitar solapamiento en el 1er frame.
  const [leftW, setLeftW] = useState(48);
  const [rightW, setRightW] = useState(showTtp ? 132 : 48);

  const { padLeft, padRight } = useMemo(() => {
    // Padding asimétrico: el título queda estrictamente entre la columna izq. y la der.
    const l = Math.max(8, leftW) + 6;
    const r = Math.max(8, rightW) + 6;
    return { padLeft: l, padRight: r };
  }, [leftW, rightW]);

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
      <View
        style={styles.leftSlot}
        onLayout={(e) => setLeftW(Math.ceil(e.nativeEvent.layout.width))}
      >
        {showBack ? (
          <IconButton
            onPress={
              onBackPress ??
              (() => {
                if (navigation.canGoBack()) navigation.goBack();
                else router.replace("/(main)" as any);
              })
            }
            accessibilityLabel="Volver"
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </IconButton>
        ) : null}
      </View>

      {/* Centro: título centrado en la fila (alineado con iconos) */}
      <View
        style={[
          styles.centerSlot,
          {
            top: insets.top || 10,
            height: HEADER_HEIGHT,
            paddingLeft: padLeft,
            paddingRight: padRight,
          },
          centerAlign === "left" && styles.centerSlotLeft,
        ]}
        pointerEvents="box-none"
      >
        {centerElement ?? (
          <Text
            style={[styles.title, centerAlign === "left" && styles.titleLeft]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        )}
      </View>

      {/* Derecha: iconos alineados */}
      <View
        style={styles.rightSlot}
        onLayout={(e) => setRightW(Math.ceil(e.nativeEvent.layout.width))}
      >
        {showTtp ? <TtpBadge minimal /> : null}
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
  },
  centerSlotLeft: {
    alignItems: "flex-start",
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
    textAlign: "center",
    width: "100%",
  },
  titleLeft: {
    textAlign: "left",
  },
});
