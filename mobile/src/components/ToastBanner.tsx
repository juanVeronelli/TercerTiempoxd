import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import type { AlertType } from "./CustomAlert";
import { Colors } from "../constants/Colors";

const TYPE_STYLES: Record<
  AlertType,
  { bg: string; border: string; icon: "check" | "x" | "alert-triangle" | "info" }
> = {
  success: {
    bg: "rgba(34, 197, 94, 0.18)",
    border: "rgba(34, 197, 94, 0.45)",
    icon: "check",
  },
  error: {
    bg: "rgba(239, 68, 68, 0.16)",
    border: "rgba(239, 68, 68, 0.45)",
    icon: "x",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.14)",
    border: "rgba(245, 158, 11, 0.5)",
    icon: "alert-triangle",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.14)",
    border: "rgba(59, 130, 246, 0.45)",
    icon: "info",
  },
};

export type ToastPayload = {
  message: string;
  type: AlertType;
  durationMs?: number;
  onPress?: () => void;
};

type Props = {
  payload: ToastPayload | null;
  onDismiss: () => void;
};

export function ToastBanner({ payload, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismissNow = useCallback(() => {
    opacity.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onDismissRef.current)();
    });
    translateY.value = withTiming(14, { duration: 180 });
  }, [opacity, translateY]);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    if (!payload?.message?.trim()) {
      opacity.value = 0;
      return;
    }

    translateY.value = 20;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withTiming(0, { duration: 240 });

    const ms = payload.durationMs ?? (payload.type === "error" ? 4200 : 2800);
    dismissTimer.current = setTimeout(() => {
      dismissNow();
    }, ms);

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };
  }, [payload, dismissNow, opacity, translateY]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!payload?.message?.trim()) return null;

  const cfg = TYPE_STYLES[payload.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 8 }, aStyle]}
    >
      <Pressable
        onPress={() => {
          payload.onPress?.();
          dismissNow();
        }}
        style={[styles.bar, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      >
        <Feather name={cfg.icon} size={18} color={Colors.textPrimary} style={styles.icon} />
        <Text style={styles.text}>{payload.message}</Text>
        {payload.onPress ? <Feather name="chevron-right" size={16} color={Colors.textSecondary} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 420,
    width: "100%",
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  icon: { marginTop: 1 },
  text: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "700",
  },
});
