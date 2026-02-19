import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_THEME } from "./profileConstants";
import type { ShowcaseOptionPreset } from "./profileConstants";

type ProfileShowcaseModalProps = {
  visible: boolean;
  onClose: () => void;
  availableOptions: ShowcaseOptionPreset[];
  showcaseSelection: string[];
  activeAccent: string;
  onToggleItem: (id: string) => void;
  onSave: () => void;
  saving: boolean;
};

export function ProfileShowcaseModal({
  visible,
  onClose,
  availableOptions,
  showcaseSelection,
  activeAccent,
  onToggleItem,
  onSave,
  saving,
}: ProfileShowcaseModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !saving && onClose()}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.title}>PERSONALIZAR VITRINA</Text>
            <TouchableOpacity onPress={() => !saving && onClose()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>
            Selecciona hasta 3 estadísticas desbloqueadas.
          </Text>
          <View style={styles.optionsGrid}>
            {availableOptions.map((opt) => {
              const isSelected = showcaseSelection.includes(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.optionItem,
                    isSelected && {
                      borderColor: activeAccent,
                      backgroundColor: activeAccent + "10",
                    },
                  ]}
                  onPress={() => onToggleItem(opt.id)}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={24}
                    color={isSelected ? activeAccent : "#666"}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && { color: "white", fontWeight: "bold" },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: activeAccent }]}>
                      <Ionicons name="checkmark" size={10} color="black" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: activeAccent }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
            )}
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
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    flex: 1,
    textAlign: "center",
    letterSpacing: 1,
  },
  subtitle: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 25,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
    marginBottom: 25,
  },
  optionItem: {
    width: "30%",
    height: 85,
    backgroundColor: PROFILE_THEME.bg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
    padding: 5,
  },
  optionLabel: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 8,
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
  saveButton: { padding: 16, alignItems: "center", borderRadius: 12 },
  saveButtonText: { color: "white", fontWeight: "900" },
});
