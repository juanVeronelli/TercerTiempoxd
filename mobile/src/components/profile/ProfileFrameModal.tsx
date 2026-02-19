import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_THEME } from "./profileConstants";
import type { AvatarFramePreset } from "./profileConstants";

type ProfileFrameModalProps = {
  visible: boolean;
  onClose: () => void;
  availableFrames: AvatarFramePreset[];
  activeFrame: AvatarFramePreset;
  activeAccent: string;
  onSelect: (frame: AvatarFramePreset) => void;
};

export function ProfileFrameModal({
  visible,
  onClose,
  availableFrames,
  activeFrame,
  activeAccent,
  onSelect,
}: ProfileFrameModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>MARCO DE AVATAR</Text>
          <View style={styles.gridSelector}>
            {availableFrames.map((frame) => (
              <TouchableOpacity
                key={frame.id}
                style={styles.frameOption}
                onPress={() => onSelect(frame)}
              >
                <View style={styles.framePreviewCircle}>
                  {frame.source ? (
                    <>
                      <View
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundColor: "#374151",
                          borderRadius: 25,
                        }}
                      />
                      <Image
                        source={frame.source}
                        style={styles.framePreviewImage}
                        resizeMode="contain"
                      />
                    </>
                  ) : (
                    <View
                      style={[
                        {
                          width: "100%",
                          height: "100%",
                          borderRadius: 25,
                          backgroundColor: "#374151",
                          borderColor: frame.color === "accent" ? activeAccent : frame.color,
                          borderWidth: frame.width,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text style={[styles.optionLabel, { marginTop: 8 }]}>{frame.name}</Text>
                {activeFrame.id === frame.id && (
                  <View style={[styles.checkCircle, { backgroundColor: activeAccent }]}>
                    <Ionicons name="checkmark" size={10} color="black" />
                  </View>
                )}
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
  framePreviewCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  framePreviewImage: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  optionLabel: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  checkCircle: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
