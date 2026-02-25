import React, { useRef, useEffect } from "react";
import {
  View,
  ViewStyle,
  Platform,
  InteractionManager,
} from "react-native";

export type MeasureFrame = { x: number; y: number; width: number; height: number };

type CoachmarkHighlightProps = {
  highlighted: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  borderRadius?: number;
  /** Se llama con el frame en coordenadas ventana cuando highlighted pasa a true (para spotlight). */
  onMeasure?: (frame: MeasureFrame) => void;
};

const MEASURE_DELAY_MS = Platform.OS === "android" ? 220 : 90;
const MEASURE_RETRY_DELAY_MS = Platform.OS === "android" ? 200 : 120;
const MAX_RETRIES = Platform.OS === "android" ? 3 : 2;

function frameKey(f: MeasureFrame) {
  return `${f.x}|${f.y}|${f.width}|${f.height}`;
}

function isValidFrame(width: number, height: number) {
  return width >= 1 && height >= 1;
}

/**
 * Envuelve un widget para el coachmark: cuando highlighted es true, mide y reporta
 * el frame (onMeasure) de forma estable, con reintentos en Android y sin repetir el mismo frame.
 */
export function CoachmarkHighlight({
  highlighted,
  children,
  style,
  onMeasure,
}: CoachmarkHighlightProps) {
  const ref = useRef<View>(null);
  const onMeasureRef = useRef(onMeasure);
  const cancelledRef = useRef(false);
  const lastReportedKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  onMeasureRef.current = onMeasure;

  useEffect(() => {
    if (!highlighted || !ref.current) return;
    cancelledRef.current = false;

    const report = (frame: MeasureFrame) => {
      if (cancelledRef.current) return;
      const key = frameKey(frame);
      if (lastReportedKeyRef.current === key) return;
      lastReportedKeyRef.current = key;
      onMeasureRef.current?.(frame);
    };

    const runMeasure = (retryCount: number) => {
      if (cancelledRef.current || !ref.current) return;
      ref.current.measureInWindow((x, y, width, height) => {
        if (cancelledRef.current) return;
        const frame: MeasureFrame = { x, y, width, height };
        if (isValidFrame(width, height)) {
          report(frame);
          return;
        }
        if (retryCount < MAX_RETRIES) {
          timeoutRef.current = setTimeout(
            () => runMeasure(retryCount + 1),
            MEASURE_RETRY_DELAY_MS,
          );
        }
      });
    };

    const scheduleMeasure = () => {
      if (cancelledRef.current) return;
      timeoutRef.current = setTimeout(() => runMeasure(0), MEASURE_DELAY_MS);
    };

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (cancelledRef.current) return;
        InteractionManager.runAfterInteractions(() => {
          if (!cancelledRef.current) scheduleMeasure();
        });
      });
    });

    return () => {
      cancelledRef.current = true;
      lastReportedKeyRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [highlighted]);

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  );
}
