import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";

const CARD_MARGIN = 20;

export const STATUS_CONFIG: Record<
  string,
  { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }
> = {
  OPEN: {
    title: "Inscripciones Abiertas",
    subtitle: "Invitá a tus amigos y esperá que confirmen asistencia.",
    icon: "calendar-outline",
    color: "#60A5FA",
  },
  ACTIVE: {
    title: "Partido en Curso",
    subtitle: "El partido está jugándose. Los equipos compiten en cancha.",
    icon: "football-outline",
    color: "#34D399",
  },
  FINISHED: {
    title: "Tercer Tiempo (Votación)",
    subtitle: "El partido terminó. ¡Entrá a calificar a los jugadores y elegí al MVP!",
    icon: "star-outline",
    color: "#FBBF24",
  },
  COMPLETED: {
    title: "Partido Cerrado",
    subtitle: "Las estadísticas están listas. Mirá los resultados finales.",
    icon: "trophy-outline",
    color: "#9CA3AF",
  },
  CANCELLED: {
    title: "Partido Cancelado",
    subtitle: "Este partido no se disputó.",
    icon: "close-circle-outline",
    color: "#F87171",
  },
};

type MatchStatusCardProps = {
  status: string;
  isAdmin: boolean;
  onStatusChange?: (newStatus: string) => void;
};

export function MatchStatusCard({ status, isAdmin, onStatusChange }: MatchStatusCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;

  const openModal = () => {
    if (isAdmin && onStatusChange) setModalVisible(true);
  };

  const selectStatus = (newStatus: string) => {
    onStatusChange?.(newStatus);
    setModalVisible(false);
  };

  const cardContent = (
    <View style={[styles.card, { borderColor: config.color + "40" }]}>
      <View style={[styles.iconWrap, { backgroundColor: config.color + "20" }]}>
        <Ionicons name={config.icon} size={26} color={config.color} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>ESTADO ACTUAL</Text>
        <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>
        {isAdmin && onStatusChange && (
          <Text style={styles.tapHint}>Toca para cambiar de fase</Text>
        )}
      </View>
      {isAdmin && onStatusChange && (
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} style={styles.chevron} />
      )}
    </View>
  );

  if (isAdmin && onStatusChange) {
    return (
      <>
        <TouchableOpacity
          onPress={openModal}
          activeOpacity={0.85}
          style={styles.wrapper}
        >
          {cardContent}
        </TouchableOpacity>

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Cambiar fase del partido</Text>
              <Text style={styles.modalSubtitle}>
                Elegí el nuevo estado. Esto afectará qué acciones pueden hacer los jugadores.
              </Text>
              {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
                const isActive = status === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.modalOption,
                      isActive && { borderColor: conf.color, backgroundColor: conf.color + "12" },
                    ]}
                    onPress={() => selectStatus(key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: conf.color + "25" }]}>
                      <Ionicons name={conf.icon} size={20} color={conf.color} />
                    </View>
                    <View style={styles.modalOptionText}>
                      <Text style={[styles.modalOptionTitle, { color: conf.color }]}>
                        {conf.title}
                      </Text>
                      <Text style={styles.modalOptionSubtitle}>{conf.subtitle}</Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={24} color={conf.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  return <View style={styles.wrapper}>{cardContent}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  label: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  tapHint: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  chevron: {
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalOptionText: { flex: 1 },
  modalOptionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  modalOptionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  modalCancel: {
    marginTop: 14,
    padding: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
