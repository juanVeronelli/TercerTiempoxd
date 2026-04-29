import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Colors } from "../../constants/Colors";

export type EmptyStateProps = {
  /** Texto principal destacado */
  title: string;
  /** Subtítulo explicativo (gris suave) */
  message: string;
  /** Nombre del icono Feather (ej: "calendar", "award", "bell", "check") */
  iconName: React.ComponentProps<typeof Feather>["name"];
  /** Texto del botón de acción (ej: "Crear Partido") */
  actionLabel?: string;
  /** Callback al tocar el botón */
  onAction?: () => void;
};

const ICON_SIZE = 64;
const ICON_OPACITY = 0.35;

/**
 * Estado vacío reutilizable: diseño centrado, Dark Mode Premium,
 * icono grande con opacidad baja, tipografía limpia.
 * No mostrar mientras isLoading sea true.
 */
export function EmptyState({
  title,
  message,
  iconName,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather
          name={iconName}
          size={ICON_SIZE}
          color={Colors.textPrimary}
          style={styles.icon}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel != null && onAction != null && (
        <TouchableOpacity
          style={styles.button}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    minHeight: 220,
  },
  iconWrap: {
    width: ICON_SIZE + 32,
    height: ICON_SIZE + 32,
    borderRadius: (ICON_SIZE + 32) / 2,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  icon: {
    opacity: ICON_OPACITY,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 280,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    minWidth: 160,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
