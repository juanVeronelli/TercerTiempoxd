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
  ActivityIndicator,
} from "react-native";
import { PROFILE_THEME } from "./profileConstants";

type ProfileChangePasswordModalProps = {
  visible: boolean;
  onClose: () => void;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentChange: (v: string) => void;
  onNewChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSave: () => void;
  changing: boolean;
  activeAccent: string;
};

export function ProfileChangePasswordModal({
  visible,
  onClose,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentChange,
  onNewChange,
  onConfirmChange,
  onSave,
  changing,
  activeAccent,
}: ProfileChangePasswordModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <Text style={styles.title}>CAMBIAR CONTRASEÑA</Text>
          <Text style={styles.subtitle}>
            Ingresa tu contraseña actual y la nueva.
          </Text>
          <TextInput
            style={styles.editInput}
            value={currentPassword}
            onChangeText={onCurrentChange}
            placeholder="Contraseña actual"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.editInput}
            value={newPassword}
            onChangeText={onNewChange}
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.editInput}
            value={confirmPassword}
            onChangeText={onConfirmChange}
            placeholder="Repetir nueva contraseña"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: activeAccent }]}
              onPress={onSave}
              disabled={changing}
            >
              {changing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>ACTUALIZAR</Text>
              )}
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
  subtitle: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 25,
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
