import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  amount: number;
};

/**
 * Overlay corto para "ganancia de TTP".
 * No bloquea toques (pointerEvents none).
 */
export function TtpGainOverlay({ visible, amount }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  const safeAmount = useMemo(() => Math.max(0, Math.floor(Number(amount) || 0)), [amount]);

  useEffect(() => {
    if (!visible || safeAmount <= 0) return;
    opacity.setValue(0);
    translateY.setValue(10);
    scale.setValue(0.98);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(650),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();
  }, [opacity, safeAmount, scale, translateY, visible]);

  if (!visible || safeAmount <= 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="cash-outline" size={16} color="#111827" />
        </View>
        <Text style={styles.text}>+{safeAmount} TTP</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 54,
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  text: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});

