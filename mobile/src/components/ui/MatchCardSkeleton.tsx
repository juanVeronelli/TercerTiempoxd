import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./Skeleton";

const CARD_HEIGHT = 200;

export function MatchCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton
        width="100%"
        height={CARD_HEIGHT}
        borderRadius={20}
        style={styles.skeleton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  skeleton: {
    alignSelf: "stretch",
  },
});
