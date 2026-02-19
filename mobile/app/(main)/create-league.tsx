import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import { useCustomAlert } from "../../src/context/AlertContext";
import apiClient from "../../src/api/apiClient";

// Habilitar animaciones en Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function CreateOrJoinLeagueScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const switchTab = (tab: "create" | "join") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert("Atención", "Ingresa un nombre para la liga.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/leagues", { name, description });
      showAlert("¡Éxito!", "Liga creada correctamente.", [
        { text: "Continuar", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      showAlert(
        "Error",
        error.response?.data?.error || "Error al crear liga.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) {
      showAlert("Código inválido", "El código debe tener 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/leagues/join", { code: inviteCode });
      showAlert("¡Bienvenido!", "Te has unido a la liga.", [
        { text: "Ir a la Liga", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      showAlert("Error", error.response?.data?.error || "Error al unirse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* HEADER MINIMALISTA */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TÍTULO PRINCIPAL */}
          <View style={styles.titleContainer}>
            <MaterialCommunityIcons
              name="trophy-variant-outline"
              size={40}
              color="white"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.screenTitle}>COMPETICIÓN</Text>
            <Text style={styles.screenSubtitle}>
              ADMINISTRA O ÚNETE A UN TORNEO
            </Text>
          </View>

          {/* TARJETA UNIFICADA CON TABS INTEGRADOS */}
          <View style={styles.mainCard}>
            {/* SELECTOR DE MODO (Títulos Clickeables) */}
            <View style={styles.tabHeader}>
              <TouchableOpacity
                onPress={() => switchTab("create")}
                style={styles.tabButton}
                testID="e2e-create-league-tab"
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "create"
                      ? styles.tabTextActive
                      : styles.tabTextInactive,
                  ]}
                >
                  CREAR
                </Text>
                {activeTab === "create" && <View style={styles.activeDot} />}
              </TouchableOpacity>

              <View style={styles.verticalDivider} />

              <TouchableOpacity
                onPress={() => switchTab("join")}
                style={styles.tabButton}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "join"
                      ? styles.tabTextActive
                      : styles.tabTextInactive,
                  ]}
                >
                  UNIRSE
                </Text>
                {activeTab === "join" && (
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: Colors.status.success },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* CONTENIDO DEL FORMULARIO */}
            <View style={styles.formContent}>
              {activeTab === "create" ? (
                <>
                  <Text style={styles.formDescription}>
                    Funda una nueva liga, invita a tus amigos y gestiona los
                    partidos.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>NOMBRE</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="shield-outline"
                        size={18}
                        color={Colors.textSecondary}
                        style={{ marginRight: 10 }}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Torneo Verano 2026"
                        placeholderTextColor={Colors.placeholder}
                        value={name}
                        onChangeText={setName}
                        testID="e2e-create-league-name"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>DESCRIPCIÓN</Text>
                    <View
                      style={[styles.inputContainer, styles.textAreaContainer]}
                    >
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Reglas, premios, detalles..."
                        placeholderTextColor={Colors.placeholder}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleCreate}
                    disabled={loading}
                    testID="e2e-create-league-submit"
                    accessibilityLabel="CREAR LIGA"
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.background} />
                    ) : (
                      <Text style={styles.actionButtonText}>CREAR LIGA</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.formDescription}>
                    Ingresa el código de 6 dígitos que te proporcionó el
                    administrador.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>CÓDIGO DE ACCESO</Text>
                    <View style={[styles.inputContainer, styles.codeContainer]}>
                      <TextInput
                        style={styles.codeInput}
                        placeholder="------"
                        placeholderTextColor={Colors.placeholder}
                        value={inviteCode}
                        onChangeText={(text) =>
                          setInviteCode(text.toUpperCase())
                        }
                        maxLength={6}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: Colors.status.success,
                        shadowColor: Colors.status.success,
                      },
                    ]}
                    onPress={handleJoin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text
                        style={[styles.actionButtonText, { color: "white" }]}
                      >
                        UNIRSE AHORA
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // HEADER
  header: { padding: 20, alignItems: "flex-end" },
  backBtn: { padding: 5, backgroundColor: Colors.surface, borderRadius: 20 },

  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },

  // TITULO PRINCIPAL
  titleContainer: { alignItems: "center", marginBottom: 30 },
  screenTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: Colors.accentGold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 5,
  },

  // TARJETA PRINCIPAL UNIFICADA
  mainCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
    shadowColor: Colors.textInverse,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // HEADER DE LA TARJETA (TABS)
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surfaceElevated,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  tabTextActive: { color: "white" },
  tabTextInactive: { color: Colors.textSecondary },

  verticalDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 15,
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentBlue,
    position: "absolute",
    bottom: 8,
  },

  // CONTENIDO FORMULARIO
  formContent: { padding: 25 },
  formDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },

  // INPUTS (Estilo Login)
  inputGroup: { marginBottom: 20 },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
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

  textAreaContainer: { height: 100, alignItems: "flex-start", paddingTop: 12 },
  textArea: { height: 80, textAlignVertical: "top" },

  // CODE INPUT
  codeContainer: {
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: Colors.textSecondary,
  },
  codeInput: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 8,
    width: "100%",
  },

  // BOTON
  actionButton: {
    backgroundColor: "white",
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
  actionButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
