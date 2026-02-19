import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Skeleton } from "../ui/Skeleton";
import { PROFILE_THEME } from "./profileConstants";

export function ProfileLoadingSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Skeleton
          width="100%"
          height={56}
          borderRadius={12}
          style={{ flex: 1 }}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Skeleton
          width="100%"
          height={320}
          borderRadius={24}
          style={{ marginBottom: 24 }}
        />
        <Skeleton
          width="100%"
          height={200}
          borderRadius={16}
          style={{ marginBottom: 24 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PROFILE_THEME.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 10,
  },
  content: { paddingHorizontal: 20 },
});
