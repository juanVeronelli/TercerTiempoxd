import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import apiClient from "../../../../src/api/apiClient";
import { useCurrentUser } from "../../../../src/hooks/useCurrentUser";
import { UserAvatar } from "../../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../../src/components/ui/Skeleton";

const { width } = Dimensions.get("window");

// --- INTERFACES ---

interface VoteData {
  overall: number;
  pace: number;
  defense: number;
  technique: number;
  physical: number;
  attack: number;
  comment: string;
}

interface StatRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: keyof typeof Ionicons.glyphMap;
}

// --- COMPONENTE PRINCIPAL ---

export default function VoteScreen() {
  const { matchId } = useLocalSearchParams();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);

  // Estado para saber si ya votó (Pantalla de Bloqueo)
  const [hasVotedAlready, setHasVotedAlready] = useState(false);

  // Estado del Carousel
  const [currentIndex, setCurrentIndex] = useState(0);

  // Estado de Votos
  const [votes, setVotes] = useState<{ [key: string]: VoteData }>({});

  const [showSummary, setShowSummary] = useState(false);
  const [sending, setSending] = useState(false);

  // 1. Cargar Jugadores y Verificar Estado
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!matchId) return;
      try {
        const res = await apiClient.get(`/match/${matchId}/vote-list`);

        // Si el backend dice que ya votó, activamos el bloqueo
        if (res.data.hasVoted) {
          setHasVotedAlready(true);
          setLoading(false);
          return;
        }

        const playersList = res.data.players;
        setPlayers(playersList);

        // Inicializar votos vacíos
        const initialVotes: any = {};
        playersList.forEach((p: any) => {
          initialVotes[p.id] = {
            overall: 0,
            pace: 0,
            defense: 0,
            technique: 0,
            physical: 0,
            attack: 0,
            comment: "",
          };
        });
        setVotes(initialVotes);
      } catch (error: any) {
        if (error.response?.data?.error === "TIMEOUT") {
          showAlert("Tiempo Finalizado", "La votación ha cerrado.", [
            { text: "Volver", onPress: () => router.back() },
          ]);
        } else {
          console.error(error);
          showAlert("Error", "No se pudo cargar la lista.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [matchId]);

  // 2. Navegación Carousel
  const handleNext = () => {
    if (currentIndex < players.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleReview();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // 3. Actualizar Voto
  const updateVote = (field: keyof VoteData, value: any) => {
    const currentPlayerId = players[currentIndex].id;
    setVotes((prev) => ({
      ...prev,
      [currentPlayerId]: { ...prev[currentPlayerId], [field]: value },
    }));
  };

  // 4. Revisar (Validación de Ceros)
  const handleReview = () => {
    // Buscamos si alguien tiene Overall 0
    const missing = players.find((p) => votes[p.id].overall === 0);

    if (missing) {
      showAlert(
        "Votos Incompletos",
        `No puedes finalizar hasta puntuar el Overall de todos.\n\nFalta: ${missing.full_name}.`,
      );
      // Movemos el carousel al jugador que falta
      const index = players.findIndex((p) => p.id === missing.id);
      setCurrentIndex(index);
      return;
    }

    // Si todo está bien, mostramos el modal
    setShowSummary(true);
  };

  // 5. Enviar Votos
  const handleSubmit = async () => {
    try {
      setSending(true);

      const votesArray = Object.keys(votes).map((votedId) => ({
        voted_user_id: votedId,
        ...votes[votedId],
      }));

      await apiClient.post(`/match/${matchId}/vote`, { votes: votesArray });

      showAlert("¡Enviado!", "Tus votos se han guardado correctamente.", [
        { text: "OK", onPress: () => router.replace(`/(main)/league/match`) },
      ]);
    } catch (error: any) {
      console.error(error);
      const msg =
        error.response?.data?.message || "No se pudo enviar la votación.";
      showAlert("Error", msg);
    } finally {
      setSending(false);
      setShowSummary(false);
    }
  };

  // --- RENDER ---

  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Skeleton width="100%" height={48} borderRadius={12} style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton width="100%" height={420} borderRadius={20} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    );

  // PANTALLA DE BLOQUEO: YA VOTÓ
  if (hasVotedAlready) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center", padding: 20 },
        ]}
      >
        <Ionicons
          name="checkmark-done-circle"
          size={80}
          color="#10B981"
          style={{ marginBottom: 20 }}
        />
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: "900",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          ¡YA HAS VOTADO!
        </Text>
        <Text
          style={{
            color: "#9CA3AF",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 30,
          }}
        >
          Tus calificaciones para este partido ya fueron registradas. No es
          posible editar los votos una vez enviados.
        </Text>
        <TouchableOpacity
          style={styles.navBtnPrimary}
          onPress={() => router.replace("/(main)/league/match")}
        >
          <Text style={styles.navBtnTextPrimary}>VOLVER AL CALENDARIO</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (players.length === 0) return null;

  const currentPlayer = players[currentIndex];
  const isMe = currentPlayer.id === userId;
  const currentVote = votes[currentPlayer.id];
  const isLast = currentIndex === players.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          VOTACIÓN ({currentIndex + 1}/{players.length})
        </Text>
        {/* El botón Resumen ahora valida antes de abrir */}
        <TouchableOpacity onPress={handleReview}>
          <Text style={{ color: "#F59E0B", fontWeight: "bold", fontSize: 12 }}>
            RESUMEN
          </Text>
        </TouchableOpacity>
      </View>

      {/* BARRA DE PROGRESO */}
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${((currentIndex + 1) / players.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {/* TARJETA DEL JUGADOR */}
        <View style={styles.playerCard}>
          <View style={styles.avatarLarge}>
            <UserAvatar
              imageUrl={currentPlayer.profile_photo_url}
              name={currentPlayer.full_name}
              size={96}
            />
          </View>
          <Text style={styles.playerNameLarge}>{currentPlayer.full_name}</Text>
          <Text style={styles.playerUsername}>
            @{currentPlayer.username || "jugador"}
          </Text>
          {isMe && (
            <View style={styles.meBadge}>
              <Text style={styles.meBadgeText}>TU USUARIO</Text>
            </View>
          )}
        </View>

        {/* OVERALL (OBLIGATORIO) */}
        <View style={styles.sectionContainer}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={styles.labelTitle}>OVERALL (Puntaje General)</Text>
            <Text style={styles.scoreDisplay}>
              {currentVote.overall > 0 ? currentVote.overall : "-"}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.numBtnBig,
                  currentVote.overall === num && styles.numBtnBigSelected,
                ]}
                onPress={() => updateVote("overall", num)}
              >
                <Text
                  style={[
                    styles.numTextBig,
                    currentVote.overall === num && { color: "white" },
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ESTADÍSTICAS DETALLADAS (Oculto si soy yo) */}
        {!isMe ? (
          <View style={styles.statsContainer}>
            <Text style={styles.sectionSubtitle}>DETALLES TÉCNICOS</Text>

            <StatRow
              label="Ritmo / Físico"
              value={currentVote.pace}
              onChange={(v) => updateVote("pace", v)}
              icon="flash"
            />
            <StatRow
              label="Técnica / Control"
              value={currentVote.technique}
              onChange={(v) => updateVote("technique", v)}
              icon="football"
            />
            <StatRow
              label="Defensa"
              value={currentVote.defense}
              onChange={(v) => updateVote("defense", v)}
              icon="shield"
            />
            <StatRow
              label="Ataque / Definición"
              value={currentVote.attack}
              onChange={(v) => updateVote("attack", v)}
              icon="flame"
            />
            <StatRow
              label="Físico / Resistencia"
              value={currentVote.physical}
              onChange={(v) => updateVote("physical", v)}
              icon="fitness"
            />
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Ionicons name="eye-off-outline" size={20} color="#6B7280" />
            <Text style={styles.infoBoxText}>
              Las estadísticas detalladas están deshabilitadas para el voto
              propio.
            </Text>
          </View>
        )}

        {/* COMENTARIO */}
        <View style={styles.sectionContainer}>
          <Text style={styles.labelTitle}>COMENTARIO (Opcional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder={
              isMe ? "Autocrítica..." : "Opinión sobre su partido..."
            }
            placeholderTextColor="#6B7280"
            multiline
            value={currentVote.comment}
            onChangeText={(t) => updateVote("comment", t)}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FOOTER NAV */}
      <View style={styles.footerNav}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentIndex === 0 ? "#4B5563" : "white"}
          />
        </TouchableOpacity>

        <View style={styles.paginatorDots}>
          {players.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.navBtnPrimary} onPress={handleNext}>
          {isLast ? (
            <Text style={styles.navBtnTextPrimary}>FINALIZAR</Text>
          ) : (
            <Ionicons name="chevron-forward" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {/* MODAL DE RESUMEN Y CONFIRMACIÓN */}
      <Modal visible={showSummary} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>RESUMEN FINAL</Text>
            <ScrollView style={{ maxHeight: 400, width: "100%" }}>
              {players.map((p) => (
                <View key={p.id} style={styles.summaryRow}>
                  <Text style={styles.summaryName}>{p.full_name}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Text style={{ color: "#F59E0B" }}>
                      Ov: {votes[p.id]?.overall}
                    </Text>
                    {votes[p.id]?.comment ? (
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={14}
                        color="#60A5FA"
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowSummary(false)}
              >
                <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
                  VOLVER
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleSubmit}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text style={{ color: "#111827", fontWeight: "bold" }}>
                    ENVIAR VOTOS
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTE PARA FILAS DE STATS ---
const StatRow = ({ label, value, onChange, icon }: StatRowProps) => {
  return (
    <View style={{ marginBottom: 15 }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}
      >
        <Ionicons
          name={icon}
          size={14}
          color="#9CA3AF"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.statLabel}>{label}</Text>
        <Text
          style={{
            color: value > 0 ? "#F59E0B" : "#4B5563",
            marginLeft: "auto",
            fontWeight: "bold",
          }}
        >
          {value > 0 ? value : "-"}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.numBtnSmall,
              value === num && styles.numBtnSmallSelected,
            ]}
            onPress={() => onChange(num)}
          >
            <Text
              style={[styles.numTextSmall, value === num && { color: "white" }]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
  },
  headerTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },

  progressBarBg: { height: 4, backgroundColor: "#374151", width: "100%" },
  progressBarFill: { height: "100%", backgroundColor: "#F59E0B" },

  content: { padding: 20 },

  playerCard: { alignItems: "center", marginBottom: 25 },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  playerNameLarge: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  playerUsername: { color: "#9CA3AF", fontSize: 14, marginBottom: 5 },
  meBadge: {
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 5,
  },
  meBadgeText: { color: "#60A5FA", fontSize: 10, fontWeight: "bold" },

  sectionContainer: { marginBottom: 25 },
  labelTitle: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  scoreDisplay: { color: "#F59E0B", fontSize: 24, fontWeight: "900" },

  numBtnBig: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  numBtnBigSelected: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  numTextBig: { color: "#6B7280", fontSize: 16, fontWeight: "bold" },

  statsContainer: {
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 15,
    textTransform: "uppercase",
  },
  statLabel: { color: "#D1D5DB", fontSize: 12 },

  numBtnSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  numBtnSmallSelected: { backgroundColor: "#3B82F6" },
  numTextSmall: { color: "#6B7280", fontSize: 10, fontWeight: "bold" },

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 25,
  },
  infoBoxText: { color: "#9CA3AF", fontSize: 12, marginLeft: 10, flex: 1 },

  commentInput: {
    backgroundColor: "#1F2937",
    color: "white",
    borderRadius: 12,
    padding: 15,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#374151",
  },

  footerNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  navBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  navBtnDisabled: { opacity: 0.5 },
  navBtnPrimary: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  navBtnTextPrimary: { color: "#111827", fontWeight: "900" },

  paginatorDots: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#374151" },
  dotActive: { backgroundColor: "#F59E0B", width: 8, height: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  summaryName: { color: "white", fontWeight: "bold" },
  modalButtons: { flexDirection: "row", marginTop: 20, gap: 15 },
  modalCancel: {
    flex: 1,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 10,
  },
  modalConfirm: {
    flex: 1,
    padding: 15,
    alignItems: "center",
    backgroundColor: "#F59E0B",
    borderRadius: 10,
  },
});
