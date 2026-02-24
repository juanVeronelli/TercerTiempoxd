import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

const OVERLAY_FADE_DURATION = 220;
const TOOLTIP_SLIDE_DURATION = 360;
const TOOLTIP_DELAY = 100;
const EXIT_DURATION = 280;
const SPOTLIGHT_TRANSITION_DURATION = 280;

const easeOutCubic = Easing.out(Easing.cubic);

export type CoachmarkStep = {
  title: string;
  body: string;
};

export type TargetFrame = { x: number; y: number; width: number; height: number };

type CoachmarkModalProps = {
  visible: boolean;
  steps: CoachmarkStep[];
  onFinish: () => void;
  onRequestClose?: () => void;
  /** Se llama con el índice del paso actual (0-based). -1 cuando se cierra. */
  onStepChange?: (stepIndex: number) => void;
  /** Frame del widget a dejar "iluminado" (resto opaco). En coordenadas ventana. */
  targetFrame?: TargetFrame | null;
  /** Paso actual controlado por el padre (ej. para scroll primero y luego pintar). */
  stepIndexProp?: number;
  /** Si se pasa, al tocar "Siguiente" se llama esto en lugar de avanzar; el padre hace scroll y luego actualiza stepIndexProp. */
  onRequestNextStep?: (nextStep: number) => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function CoachmarkModal({
  visible,
  steps,
  onFinish,
  onRequestClose,
  onStepChange,
  targetFrame = null,
  stepIndexProp,
  onRequestNextStep,
}: CoachmarkModalProps) {
  const [internalStep, setInternalStep] = useState(0);
  const [isClosing, setClosing] = useState(false);
  /** Posición del tooltip fijada por paso para evitar "desaparece/vuelve" al hacer scroll. */
  const [tooltipAtTopLocked, setTooltipAtTopLocked] = useState<boolean | null>(null);

  const stepIndex = stepIndexProp !== undefined ? stepIndexProp : internalStep;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const opacity = useSharedValue(1);
  const spotlightOpacity = useSharedValue(1);
  const finishCalledRef = useRef(false);
  const prevTooltipAtTopRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      finishCalledRef.current = false;
      onStepChange?.(stepIndex);
      setTooltipAtTopLocked(null);
      prevTooltipAtTopRef.current = null;
    } else {
      onStepChange?.(-1);
      setInternalStep(0);
      setClosing(false);
      setTooltipAtTopLocked(null);
      spotlightOpacity.value = 1;
      prevTooltipAtTopRef.current = null;
    }
  }, [visible, stepIndex, onStepChange]);

  useEffect(() => {
    if (!visible || !targetFrame || targetFrame.width <= 0 || targetFrame.height <= 0) return;
    const widgetCenterY = targetFrame.y + targetFrame.height / 2;
    const tooltipAtTop = widgetCenterY > SCREEN_HEIGHT / 2;
    if (tooltipAtTopLocked === null) {
      setTooltipAtTopLocked(tooltipAtTop);
    }
    const prev = prevTooltipAtTopRef.current;
    prevTooltipAtTopRef.current = tooltipAtTopLocked ?? tooltipAtTop;
    if (prev !== null && prev !== (tooltipAtTopLocked ?? tooltipAtTop)) {
      spotlightOpacity.value = 0;
      spotlightOpacity.value = withTiming(1, {
        duration: SPOTLIGHT_TRANSITION_DURATION,
        easing: easeOutCubic,
      });
    } else if (prev === null) {
      spotlightOpacity.value = 1;
    }
  }, [stepIndex, visible, targetFrame, tooltipAtTopLocked]);

  useEffect(() => {
    if (!isClosing) return;
    opacity.value = withTiming(
      0,
      { duration: EXIT_DURATION, easing: easeOutCubic },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [isClosing]);

  const finishClose = () => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    onStepChange?.(-1);
    onFinish();
  };

  const handleNext = () => {
    if (isLast) {
      setClosing(true);
    } else if (onRequestNextStep) {
      onRequestNextStep(stepIndex + 1);
    } else {
      setInternalStep((i) => i + 1);
    }
  };

  const handleClose = () => {
    setClosing(true);
  };

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const spotlightAnimatedStyle = useAnimatedStyle(() => ({
    opacity: spotlightOpacity.value,
  }));

  if (!step) return null;

  const hasSpotlight = targetFrame && targetFrame.width > 0 && targetFrame.height > 0;
  const { x, y, width: w, height: h } = targetFrame ?? { x: 0, y: 0, width: 0, height: 0 };
  const spotlightPath = hasSpotlight
    ? `M 0 0 L ${SCREEN_WIDTH} 0 L ${SCREEN_WIDTH} ${SCREEN_HEIGHT} L 0 ${SCREEN_HEIGHT} Z M ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} L ${x} ${y} Z`
    : "";

  const widgetCenterY = y + h / 2;
  const tooltipAtTopComputed = hasSpotlight && widgetCenterY > SCREEN_HEIGHT / 2;
  const tooltipAtTop = tooltipAtTopLocked !== null ? tooltipAtTopLocked : tooltipAtTopComputed;

  const tooltipEntering = tooltipAtTop
    ? SlideInDown.duration(TOOLTIP_SLIDE_DURATION).delay(TOOLTIP_DELAY)
    : SlideInUp.duration(TOOLTIP_SLIDE_DURATION).delay(TOOLTIP_DELAY);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose ?? handleClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          tooltipAtTop ? styles.overlayTooltipTop : styles.overlayTooltipBottom,
          rootAnimatedStyle,
        ]}
      >
        {hasSpotlight ? (
          <Animated.View
            entering={FadeIn.duration(OVERLAY_FADE_DURATION)}
            style={[StyleSheet.absoluteFill, spotlightAnimatedStyle]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose ?? handleClose}>
              <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
                <Path d={spotlightPath} fill="rgba(0,0,0,0.75)" fillRule="evenodd" />
              </Svg>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(OVERLAY_FADE_DURATION)}
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={styles.dimFill} onPress={onRequestClose ?? handleClose} />
          </Animated.View>
        )}
        <Animated.View key={`tip-${tooltipAtTop}`} entering={tooltipEntering}>
          <Pressable style={styles.tooltipCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.tooltipHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>
                  {stepIndex + 1} / {steps.length}
                </Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={handleClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {isLast ? "Entendido" : "Siguiente"}
              </Text>
              {!isLast && (
                <Ionicons name="arrow-forward" size={18} color={Colors.background} />
              )}
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
  },
  overlayTooltipBottom: {
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  overlayTooltipTop: {
    justifyContent: "flex-start",
    paddingTop: 50,
  },
  dimFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  tooltipCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxWidth: SCREEN_WIDTH - 40,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepPill: {
    backgroundColor: Colors.primary + "25",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
});
