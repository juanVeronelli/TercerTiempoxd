import React, { useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/constants/Colors";
import { authService } from "../../src/services/authService";
import * as SecureStore from "expo-secure-store";

export default function VerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);

  const email = params.email as string | undefined;

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    if (!email || code.length !== 6) return;
    setLoading(true);
    try {
      const response = await authService.verifyEmail({ email, code });
      const token = response.data?.token;
      if (token) {
        await SecureStore.setItemAsync("userToken", token);
        router.replace("/(main)");
      } else {
        router.replace("/(auth)/login");
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || "No se pudo verificar el código.";
      alert(msg);
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
        <Text style={styles.title}>Verifica tu email</Text>
        <Text style={styles.subtitle}>
          Hemos enviado un código de 6 dígitos a{" "}
          <Text style={{ fontWeight: "700" }}>{email}</Text>
        </Text>

        <View style={styles.otpContainer}>
          <TextInput
            style={styles.otpInput}
            value={code}
            onChangeText={(value) => {
              if (/^\d*$/.test(value) && value.length <= 6) {
                setCode(value);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={Colors.placeholder}
            textAlign="center"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            code.length !== 6 || loading ? { opacity: 0.6 } : null,
          ]}
          disabled={code.length !== 6 || loading}
          onPress={handleVerify}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Verificar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ¿No recibiste el código?
          </Text>
          <Text style={styles.footerHighlight}>
            Reenviar en {seconds}s
          </Text>
        </View>
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
    marginBottom: 24,
  },
  otpContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  otpInput: {
    width: "70%",
    height: 55,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    color: "white",
    fontSize: 24,
    letterSpacing: 16,
    fontWeight: "700",
  },
  button: {
    backgroundColor: Colors.white,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    color: Colors.background,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  footerHighlight: {
    color: Colors.accentGold,
    fontSize: 12,
    marginTop: 2,
  },
});

