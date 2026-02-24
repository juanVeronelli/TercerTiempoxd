import React, { useRef, useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

export type MeasureFrame = { x: number; y: number; width: number; height: number };

type CoachmarkHighlightProps = {
  highlighted: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  borderRadius?: number;
  /** Se llama con el frame en coordenadas ventana cuando highlighted pasa a true (para spotlight). */
  onMeasure?: (frame: MeasureFrame) => void;
};

/**
 * Envuelve un widget para el coachmark: cuando highlighted es true, mide y reporta
 * el frame (onMeasure) para que el modal dibuje el spotlight (opacar todo menos este widget).
 */
export function CoachmarkHighlight({
  highlighted,
  children,
  style,
  onMeasure,
}: CoachmarkHighlightProps) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!highlighted || !onMeasure || !ref.current) return;
    const id = requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onMeasure({ x, y, width, height });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [highlighted, onMeasure]);

  return <View ref={ref} style={style} collapsable={false}>{children}</View>;
}
