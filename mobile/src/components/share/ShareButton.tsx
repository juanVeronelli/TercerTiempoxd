import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

export type ShareButtonVariant = "filled" | "outline";

export type ShareButtonProps = {
  onPress: () => void;
  variant?: ShareButtonVariant;
  /** Color del botón (relleno o borde). Por defecto Colors.primary */
  accentColor?: string;
  /** Texto corto opcional, ej. "Compartir" para espacios reducidos */
  shortLabel?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

const DEFAULT_ACCENT = Colors.primary;

export function ShareButton({
  onPress,
  variant = "filled",
  accentColor = DEFAULT_ACCENT,
  shortLabel = false,
  style,
  textStyle,
}: ShareButtonProps) {
  const isFilled = variant === "filled";
  const bg = isFilled ? accentColor : "transparent";
  const borderColor = accentColor;
  const iconColor = isFilled ? Colors.white : accentColor;
  const labelColor = isFilled ? Colors.white : accentColor;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isFilled ? styles.filled : styles.outline,
        { backgroundColor: bg, borderColor },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Ionicons
        name="share-social"
        size={20}
        color={iconColor}
        style={styles.icon}
      />
      <Text
        style={[
          styles.label,
          { color: labelColor },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {shortLabel ? "Compartir" : "Compartir en redes"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        }
      : { elevation: 3 }),
  },
  filled: {
    // backgroundColor set inline
  },
  outline: {
    backgroundColor: "transparent",
  },
  icon: {
    marginRight: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
