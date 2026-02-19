import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ShareProfileButtonProps = {
  accentColor: string;
  onShare: () => void;
};

export function ShareProfileButton({ accentColor, onShare }: ShareProfileButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: accentColor }]}
      onPress={onShare}
      activeOpacity={0.8}
    >
      <Ionicons name="share-social" size={20} color="black" style={{ marginRight: 10 }} />
      <Text style={styles.buttonText}>COMPARTIR EN REDES</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  buttonText: {
    color: "black",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
