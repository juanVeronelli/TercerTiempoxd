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
import { useRouter } from "expo-router";
import { Colors } from "../../src/constants/Colors";
import { useCustomAlert } from "../../src/context/AlertContext";
import { authService } from "../../src/services/authService";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      showAlert("Error", "Por favor ingresa tu email.");
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      showAlert(
        "Revisa tu correo",
        "Si el email existe en nuestra base, te enviamos instrucciones para restablecer tu contraseña.",
        [{ text: "Aceptar", onPress: () => router.push("/(auth)/reset-password") }],
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.error || "No se pudo iniciar la recuperación.";
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
        <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
        <Text style={styles.subtitle}>
          Ingresa tu email y te enviaremos un enlace para restablecerla.
        </Text>

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={Colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading ? { opacity: 0.7 } : null]}
          disabled={loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Enviar instrucciones</Text>
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

