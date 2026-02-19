import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./Skeleton";

export function RankingRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width="100%" height={56} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
});
