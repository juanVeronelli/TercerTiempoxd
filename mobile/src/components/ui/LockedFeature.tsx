import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

const OVERLAY_BG = "#18181b";
const LOCK_ICON_COLOR = "#71717a";
const MESSAGE_COLOR = "#a1a1aa";

export type LockedFeatureProps = {
  /** Si true, muestra el overlay de bloqueo; si false, solo los children. */
  isLocked: boolean;
  /** Mensaje que explica cómo desbloquear (ej: "Invita a un amigo para ver el Ranking"). */
  lockMessage: string;
  /** Contenido real; visible cuando no está bloqueado. */
  children: React.ReactNode;
  /** Estilo opcional del contenedor envolvente. */
  style?: ViewStyle;
  /** 'friendly' = overlay suave sobre la card, más orgánico y amigable. */
  variant?: "default" | "friendly";
};

/**
 * Wrapper que muestra un overlay tipo "nivel bloqueado" cuando isLocked es true.
 * Si está desbloqueado, renderiza los children con normalidad.
 */
export function LockedFeature({
  isLocked,
  lockMessage,
  children,
  style,
  variant = "default",
}: LockedFeatureProps) {
  const isFriendly = variant === "friendly";

  return (
    <View style={[styles.wrapper, style]} collapsable={false}>
      <View
        style={[styles.contentSlot, isLocked && styles.contentSlotLocked]}
        pointerEvents={isLocked ? "none" : "auto"}
      >
        {children}
      </View>

      {isLocked && (
        <View
          style={[
            styles.overlay,
            isFriendly && styles.overlayFriendly,
          ]}
          pointerEvents="auto"
        >
          <View style={[styles.overlayInner, isFriendly && styles.overlayInnerFriendly]}>
            <MaterialCommunityIcons
              name="lock"
              size={isFriendly ? 48 : 64}
              color={isFriendly ? "#94a3b8" : LOCK_ICON_COLOR}
              style={[styles.lockIcon, isFriendly && styles.lockIconFriendly]}
            />
            <Text style={[styles.message, isFriendly && styles.messageFriendly]}>
              {lockMessage}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: "relative",
  },
  contentSlot: {
    flex: 1,
  },
  contentSlotLocked: {
    opacity: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayFriendly: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayInner: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 280,
    paddingHorizontal: 24,
  },
  overlayInnerFriendly: {
    width: "100%",
    maxWidth: 320,
    minHeight: 140,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 20,
    backgroundColor: "rgba(30, 41, 59, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockIcon: {
    marginBottom: 20,
    opacity: 0.9,
  },
  lockIconFriendly: {
    marginBottom: 14,
    opacity: 0.9,
  },
  message: {
    color: MESSAGE_COLOR,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "500",
  },
  messageFriendly: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
});
