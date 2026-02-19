import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

const SKELETON_DARK = "#27272a";
const SKELETON_LIGHT = "#3f3f46";
const SHIMMER_DURATION = 1400;
const SHINE_WIDTH_RATIO = 0.5; // ancho de la banda de brillo (50% del contenedor)

export type SkeletonProps = {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const progress = useSharedValue(0);
  const layoutWidth = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) layoutWidth.value = w;
  };

  const animatedShine = useAnimatedStyle(() => {
    const w = layoutWidth.value;
    const shineWidth = w * SHINE_WIDTH_RATIO;
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [-shineWidth, w]
    );
    return {
      width: shineWidth,
      transform: [{ translateX }],
    };
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shine,
          {
            borderRadius,
          },
          animatedShine,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: SKELETON_DARK,
    overflow: "hidden",
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: SKELETON_LIGHT,
    opacity: 0.9,
  },
});
