import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";
import { Colors } from "../../constants/Colors";

type ScreenSkeletonProps = {
  /** Number of placeholder blocks to show */
  lines?: number;
  /** Optional style for the container */
  style?: ViewStyle;
};

const SHIMMER_DURATION = 1200;

export const ScreenSkeleton: React.FC<ScreenSkeletonProps> = ({
  lines = 5,
  style,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.line,
            {
              width: i === 0 ? "85%" : i === lines - 1 ? "40%" : `${70 - i * 5}%`,
              opacity,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
  },
  line: {
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
});
