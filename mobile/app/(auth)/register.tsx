import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { useCustomAlert } from "../../src/context/AlertContext";
import { authService } from "../../src/services/authService";
import { PLAYER_POSITIONS } from "../../src/constants/Positions";

export default function RegisterScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [mainPosition, setMainPosition] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [acceptsPrivacy, setAcceptsPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      showAlert("Error", "Por favor completa todos los campos.");
      return;
    }

    if (!mainPosition) {
      showAlert(
        "Posición requerida",
        "Selecciona tu posición en la cancha para continuar."
      );
      return;
    }

    if (!acceptsPrivacy) {
      showAlert(
        "Requerido",
        "Debes aceptar la Política de Privacidad para continuar.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setPasswordsMatch(false);
      showAlert("Error", "Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        fullName,
        username,
        email,
        password,
        confirmPassword,
        mainPosition,
        acceptsMarketing,
      });

      showAlert(
        "¡Verifica tu email!",
        "Te enviamos un código de verificación a tu correo.",
        [
          {
            text: "Continuar",
            onPress: () =>
              router.replace({
                pathname: "/(auth)/verification",
                params: { email },
              }),
          },
        ],
      );
    } catch (error: any) {
      const msg = error.response?.data?.error || "Error al registrarse";
      showAlert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const onChangeConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    setPasswordsMatch(value === password || value.length === 0);
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
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/Logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>ÚNETE AL EQUIPO</Text>
          <Text style={styles.subtitle}>CREA TU CUENTA</Text>
        </View>

        {/* TARJETA DE FORMULARIO */}
        <View style={styles.card}>
          {/* FULL NAME */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>NOMBRE COMPLETO</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor={Colors.placeholder}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                testID="e2e-register-fullName"
              />
            </View>
          </View>

          {/* USERNAME */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>USUARIO</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="at"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.input}
                placeholder="juanperez10"
                placeholderTextColor={Colors.placeholder}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                testID="e2e-register-username"
              />
            </View>
          </View>

          {/* EMAIL */}
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
                placeholder="juan@ejemplo.com"
                placeholderTextColor={Colors.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="e2e-register-email"
              />
            </View>
          </View>

          {/* PASSWORD */}
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
                testID="e2e-register-password"
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

          {/* POSITION */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>POSICIÓN EN LA CANCHA</Text>
            <View style={styles.positionRow}>
              {PLAYER_POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={[
                    styles.positionChip,
                    mainPosition === pos && styles.positionChipSelected,
                  ]}
                  onPress={() => setMainPosition(pos)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.positionChipText,
                      mainPosition === pos && styles.positionChipTextSelected,
                    ]}
                  >
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CONFIRM PASSWORD */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONFIRMAR CONTRASEÑA</Text>
            <View
              style={[
                styles.inputContainer,
                !passwordsMatch && confirmPassword
                  ? { borderColor: Colors.status.error }
                  : null,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.input}
                placeholder="Repite tu contraseña"
                placeholderTextColor={Colors.placeholder}
                value={confirmPassword}
                onChangeText={onChangeConfirmPassword}
                secureTextEntry={!showPassword}
                testID="e2e-register-confirmPassword"
              />
            </View>
            {!passwordsMatch && confirmPassword ? (
              <Text style={styles.errorText}>
                Las contraseñas no coinciden.
              </Text>
            ) : null}
          </View>

          {/* PRIVACY / MARKETING - Checkbox con testID separado del link para E2E (tap no abre política) */}
          <View style={styles.checkboxSection}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptsPrivacy((v) => !v)}
              testID="e2e-register-accept-privacy"
              accessibilityLabel="Acepto la Política de Privacidad"
              activeOpacity={0.7}
            >
              <Ionicons
                name={acceptsPrivacy ? "checkbox-outline" : "square-outline"}
                size={22}
                color={acceptsPrivacy ? Colors.white : Colors.textSecondary}
                style={styles.checkboxIcon}
              />
              <Text style={styles.checkboxText}>
                Acepto la{" "}
                <Text
                  style={styles.linkText}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    router.push("/(auth)/privacy-policy");
                  }}
                >
                  Política de Privacidad
                </Text>
                .
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptsMarketing((v) => !v)}
              testID="e2e-register-accept-marketing"
              accessibilityLabel="Acepto recibir novedades y actualizaciones"
              activeOpacity={0.7}
            >
              <Ionicons
                name={acceptsMarketing ? "checkbox-outline" : "square-outline"}
                size={22}
                color={acceptsMarketing ? Colors.white : Colors.textSecondary}
                style={styles.checkboxIcon}
              />
              <Text style={styles.checkboxText}>
                Acepto recibir novedades y actualizaciones.
              </Text>
            </TouchableOpacity>
          </View>

          {/* BOTÓN REGISTRO */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            activeOpacity={0.8}
            disabled={loading}
            testID="e2e-register-submit"
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.registerButtonText}>CREAR CUENTA</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginLink}>Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: Platform.OS === "android" ? "flex-start" : "center",
    padding: 25,
    paddingTop: Platform.OS === "android" ? 50 : 60,
    paddingBottom: Platform.OS === "android" ? 32 : 40,
  },

  // HEADER
  header: { alignItems: "center", marginBottom: 30 },
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
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "white",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  subtitle: {
    fontSize: 10,
    color: Colors.accentGold,
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

  // INPUTS
  inputGroup: { marginBottom: 15 },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceDark,
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
  errorText: {
    color: Colors.status.errorSubtle,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  // BUTTON
  registerButton: {
    backgroundColor: Colors.white,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    shadowColor: "white",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  registerButtonText: {
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
  loginLink: { color: Colors.accentGold, fontWeight: "bold", fontSize: 13 },
  checkboxSection: {
    marginTop: 6,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  checkboxIcon: {
    marginRight: 10,
  },
  checkboxText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
    flexWrap: "wrap",
  },
  linkText: {
    color: Colors.accentGold,
    textDecorationLine: "underline",
  },
  positionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  positionChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceDark,
  },
  positionChipSelected: {
    borderColor: Colors.accentGold,
    backgroundColor: Colors.accentGold + "20",
  },
  positionChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  positionChipTextSelected: {
    color: Colors.accentGold,
  },
});
