import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../src/constants/Colors";
import { useCustomAlert } from "../../src/context/AlertContext";
import { authService } from "../../src/services/authService";
import { useRouter } from "expo-router";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token || !newPassword || !confirmPassword) {
      showAlert("Error", "Completa todos los campos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      showAlert(
        "Listo",
        "Tu contraseña fue actualizada. Ahora puedes iniciar sesión.",
        [{ text: "Ir al login", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.error || "No se pudo restablecer la contraseña.";
      showAlert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Restablecer contraseña</Text>
        <Text style={styles.subtitle}>
          Pega el código o token que recibiste por email y elige una nueva contraseña.
        </Text>

        <Text style={styles.label}>TOKEN / CÓDIGO</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Token de recuperación"
            placeholderTextColor={Colors.placeholder}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>NUEVA CONTRASEÑA</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.placeholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
        </View>

        <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Repite la contraseña"
            placeholderTextColor={Colors.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading ? { opacity: 0.7 } : null]}
          disabled={loading}
          onPress={handleReset}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Actualizar contraseña</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: Colors.surfaceDark,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  inputContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 16,
    justifyContent: "center",
  },
  input: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    backgroundColor: Colors.white,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: Colors.background,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
});

