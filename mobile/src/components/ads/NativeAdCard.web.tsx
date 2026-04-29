import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export type NativeAdCardProps = {
  style?: object;
};

export function NativeAdCard({ style }: NativeAdCardProps) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.text}>Ads no disponibles en web.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
