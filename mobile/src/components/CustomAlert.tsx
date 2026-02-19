import React, { useEffect } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { Colors } from "../constants/Colors";

export type AlertType = "success" | "error" | "warning" | "info";

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export interface CustomAlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

export interface CustomAlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: CustomAlertButton[];
}

const CONTAINER_BG = Colors.surface ?? "#1E293B";
const MESSAGE_COLOR = Colors.textSecondary ?? "#94A3B8";
const BORDER_RADIUS = 20;
const CARD_MAX_WIDTH = 340;

const TYPE_CONFIG: Record<
  AlertType,
  { border: string; accent: string; icon: "check" | "x" | "alert-triangle" | "info" }
> = {
  success: { border: Colors.border, accent: Colors.success, icon: "check" },
  error: { border: Colors.border, accent: Colors.status.error, icon: "x" },
  warning: { border: Colors.border, accent: Colors.accentGold, icon: "alert-triangle" },
  info: { border: Colors.border, accent: Colors.primary, icon: "info" },
};

const SPRING_CONFIG = {
  damping: 14,
  stiffness: 120,
  mass: 0.8,
};

interface CustomAlertProps extends CustomAlertOptions {
  visible: boolean;
  onDismiss: () => void;
}

export function CustomAlert({
  visible,
  onDismiss,
  title,
  message,
  type = "info",
  buttons = [{ text: "Aceptar", style: "default" }],
}: CustomAlertProps) {
  const overlayOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(60);
  const cardScale = useSharedValue(0.85);

  const config = TYPE_CONFIG[type];

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = 0;
      cardOpacity.value = 0;
      cardTranslateY.value = 60;
      cardScale.value = 0.85;
      overlayOpacity.value = withTiming(1, { duration: 220 });
      cardOpacity.value = withTiming(1, { duration: 280 });
      cardTranslateY.value = withSpring(0, SPRING_CONFIG);
      cardScale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [visible]);

  const closeWithAnimation = () => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    cardOpacity.value = withTiming(0, { duration: 220 });
    cardTranslateY.value = withTiming(50, { duration: 220 });
    cardScale.value = withTiming(0.92, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  };

  const handlePress = (btn: CustomAlertButton) => {
    closeWithAnimation();
    btn.onPress?.();
  };

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }));

  const buttonStyles = (style: AlertButtonStyle = "default") => {
    const isCancel = style === "cancel";
    const isDestructive = style === "destructive";
    const base: ViewStyle[] = [styles.button];
    if (buttons.length === 1) {
      base.push(styles.buttonSingle);
    } else {
      base.push(styles.buttonMulti);
    }
    if (isCancel) {
      base.push(styles.buttonCancel);
    } else if (isDestructive) {
      base.push(styles.buttonDestructive);
    } else {
      base.push({ backgroundColor: config.accent });
    }
    return base;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeWithAnimation}
    >
      <Pressable style={styles.overlayWrap} onPress={closeWithAnimation}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlayBg, overlayAnimatedStyle]} />
        <Pressable style={styles.centered} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              { borderColor: config.border },
              cardAnimatedStyle,
            ]}
          >
            <View style={styles.iconCircle}>
              <Feather name={config.icon} size={24} color={config.accent} />
            </View>

            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={[styles.buttonsRow, buttons.length === 1 && styles.buttonsRowSingle]}>
              {buttons.map((btn, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.85}
                  style={buttonStyles(btn.style ?? "default")}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      btn.style === "cancel" && styles.buttonTextCancel,
                      btn.style === "destructive" && styles.buttonTextDestructive,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayBg: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: CONTAINER_BG,
    borderRadius: BORDER_RADIUS,
    padding: 28,
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  message: {
    color: MESSAGE_COLOR,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 12,
    width: "100%",
    alignSelf: "stretch",
  },
  buttonsRowSingle: {
    justifyContent: "stretch",
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSingle: {
    flex: 1,
    minWidth: 0,
  },
  buttonMulti: {
    flex: 1,
    minWidth: 0,
  },
  buttonCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDestructive: {
    backgroundColor: "#B91C1C",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  buttonTextCancel: {
    color: Colors.textSecondary,
  },
  buttonTextDestructive: {
    color: "#FFFFFF",
  },
});
