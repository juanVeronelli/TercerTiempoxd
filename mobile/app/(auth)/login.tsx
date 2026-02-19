import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { useCustomAlert } from "../../src/context/AlertContext";
import { authService } from "../../src/services/authService";
import * as SecureStore from "expo-secure-store";

export default function LoginScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Error", "Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login({ email, password });

      if (response.data.token) {
        await SecureStore.setItemAsync("userToken", response.data.token);
        router.replace("/(main)");
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Credenciales inválidas";
      showAlert("Error de Acceso", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER CON LOGO */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/Logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>TERCER TIEMPO</Text>
          <Text style={styles.tagline}>EVALUATE YOUR TEAM</Text>
        </View>

        {/* TARJETA DE FORMULARIO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>

          {/* EMAIL INPUT */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
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
          </View>

          {/* PASSWORD INPUT */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ENLACE OLVIDÉ MI CONTRASEÑA */}
          <TouchableOpacity
            style={{ marginTop: 8, alignSelf: "flex-end" }}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          {/* BOTÓN LOGIN */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.loginButtonText}>INGRESAR</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta?</Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/register")}
            testID="e2e-crear-cuenta"
            accessibilityLabel="Crear cuenta"
          >
            <Text style={styles.registerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: Platform.OS === "android" ? "flex-start" : "center",
    padding: 25,
    paddingTop: Platform.OS === "android" ? 50 : 25,
    paddingBottom: Platform.OS === "android" ? 32 : 25,
  },

  // HEADER
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 140,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  logoImage: {
    width: 140,
    height: 110,
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: "white",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 10,
    color: "#F59E0B", // Dorado sutil para el slogan
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 5,
  },

  // CARD
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },

  // INPUTS
  inputGroup: { marginBottom: 20 },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceDark, // Fondo más oscuro para el input ("Inset")
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 15,
    height: 50,
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    height: "100%",
  },

  // BUTTON
  loginButton: {
    backgroundColor: Colors.white,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "white",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  loginButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // FOOTER
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
    alignItems: "center",
    gap: 5,
  },
  footerText: { color: Colors.textSecondary, fontSize: 13 },
  registerLink: { color: Colors.accentGold, fontWeight: "bold", fontSize: 13 },
});
