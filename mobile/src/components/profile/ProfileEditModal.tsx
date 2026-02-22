import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { PROFILE_THEME } from "./profileConstants";
import { PLAYER_POSITIONS } from "../../constants/Positions";

export type EditType = "NAME" | "BIO" | "POSITION" | null;

type ProfileEditModalProps = {
  visible: boolean;
  onClose: () => void;
  editType: EditType;
  tempValue: string;
  tempName: string;
  tempSurname: string;
  onTempValueChange: (v: string) => void;
  onTempNameChange: (v: string) => void;
  onTempSurnameChange: (v: string) => void;
  onSave: () => void;
  activeAccent: string;
};

export function ProfileEditModal({
  visible,
  onClose,
  editType,
  tempValue,
  tempName,
  tempSurname,
  onTempValueChange,
  onTempNameChange,
  onTempSurnameChange,
  onSave,
  activeAccent,
}: ProfileEditModalProps) {
  const title =
    editType === "NAME"
      ? "EDITAR NOMBRE"
      : editType === "BIO"
        ? "EDITAR BIOGRAFÍA"
        : "ELIGE TU POSICIÓN";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          {editType === "NAME" && (
            <>
              <TextInput
                style={styles.editInput}
                value={tempName}
                onChangeText={onTempNameChange}
                placeholder="Nombre"
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.editInput}
                value={tempSurname}
                onChangeText={onTempSurnameChange}
                placeholder="Apellido"
                placeholderTextColor="#999"
              />
            </>
          )}
          {editType === "BIO" && (
            <TextInput
              style={[styles.editInput, { height: 100, textAlignVertical: "top" }]}
              value={tempValue}
              onChangeText={onTempValueChange}
              placeholder="Escribe algo..."
              placeholderTextColor="#999"
              multiline
              maxLength={150}
              autoFocus
            />
          )}
          {editType === "POSITION" && (
            <View style={styles.positionSelector}>
              {PLAYER_POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={[
                    styles.positionOption,
                    tempValue === pos && {
                      backgroundColor: activeAccent,
                      borderColor: activeAccent,
                    },
                  ]}
                  onPress={() => onTempValueChange(pos)}
                >
                  <Text
                    style={[styles.positionOptionText, tempValue === pos && { color: "white" }]}
                    numberOfLines={1}
                  >
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: activeAccent },
                editType === "POSITION" && !tempValue && styles.saveButtonDisabled,
              ]}
              onPress={onSave}
              disabled={editType === "POSITION" && !tempValue}
            >
              <Text style={styles.saveButtonText}>GUARDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  editInput: {
    backgroundColor: PROFILE_THEME.bg,
    color: "white",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
    marginBottom: 16,
  },
  positionSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 24,
  },
  positionOption: {
    minWidth: "47%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PROFILE_THEME.bg,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  positionOptionText: {
    color: PROFILE_THEME.textSecondary,
    fontWeight: "bold",
    fontSize: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  cancelButtonText: { color: PROFILE_THEME.textSecondary, fontWeight: "bold" },
  saveButton: { flex: 1, padding: 16, alignItems: "center", borderRadius: 12 },
  saveButtonText: { color: "white", fontWeight: "900" },
});
