import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../src/constants/Colors";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Política de Privacidad</Text>
        <Text style={styles.subtitle}>
          Cómo usamos tu email y tus datos en Tercer Tiempo.
        </Text>
      </View>

      <ScrollView
        style={styles.card}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>1. Datos que recopilamos</Text>
        <Text style={styles.paragraph}>
          Recopilamos tu dirección de email, nombre de usuario y otra
          información necesaria para crear y mantener tu cuenta. Estos datos se
          utilizan para autenticarte, enviarte notificaciones relacionadas con
          tu actividad en la app y mejorar tu experiencia dentro de Tercer
          Tiempo.
        </Text>

        <Text style={styles.sectionTitle}>2. Uso de tu email</Text>
        <Text style={styles.paragraph}>
          Usamos tu email para funcionalidades esenciales como verificación de
          cuenta, recuperación de contraseña, avisos importantes de seguridad y
          notificaciones sobre tu actividad. Si aceptas recibir novedades,
          también podremos enviarte noticias, actualizaciones y contenido
          relevante sobre el producto.
        </Text>

        <Text style={styles.sectionTitle}>3. Protección de tu información</Text>
        <Text style={styles.paragraph}>
          Implementamos medidas técnicas y organizativas razonables para
          proteger tu información frente a accesos no autorizados, pérdida o
          alteración. Nunca compartiremos tu email con terceros para fines
          comerciales sin tu consentimiento explícito.
        </Text>

        <Text style={styles.sectionTitle}>4. Tus derechos</Text>
        <Text style={styles.paragraph}>
          Puedes solicitar la actualización o eliminación de tu cuenta y de tu
          información personal escribiéndonos a los canales habilitados en la
          app. También puedes revocar en cualquier momento tu consentimiento
          para recibir comunicaciones de marketing.
        </Text>
      </ScrollView>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Acepto</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
  },
  subtitle: {
    fontSize: 13,
    color: "#D1D5DB",
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },
  paragraph: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.white,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: Colors.background,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
});

