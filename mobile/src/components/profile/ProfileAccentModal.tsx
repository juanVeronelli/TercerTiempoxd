import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_THEME } from "./profileConstants";
import type { AccentColorPreset } from "./profileConstants";

type ProfileAccentModalProps = {
  visible: boolean;
  onClose: () => void;
  availableAccentColors: AccentColorPreset[];
  activeAccent: string;
  onSelect: (color: string) => void;
};

export function ProfileAccentModal({
  visible,
  onClose,
  availableAccentColors,
  activeAccent,
  onSelect,
}: ProfileAccentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>COLOR DE ACENTO</Text>
          <View style={styles.gridSelector}>
            {availableAccentColors.map((accent) => (
              <TouchableOpacity
                key={accent.id}
                style={styles.frameOption}
                onPress={() => onSelect(accent.color)}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: accent.color,
                    borderWidth: 2,
                    borderColor: activeAccent === accent.color ? "white" : "transparent",
                  }}
                />
                <Text style={[styles.optionLabel, { marginTop: 8 }]}>{accent.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>CERRAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    backgroundColor: PROFILE_THEME.cardBg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 1,
  },
  gridSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  frameOption: { alignItems: "center", width: 70 },
  optionLabel: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  cancelButtonText: { color: PROFILE_THEME.textSecondary, fontWeight: "bold" },
});
