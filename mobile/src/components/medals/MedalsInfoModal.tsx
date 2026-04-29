import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { MEDALS_INFO } from "../../constants/MedalsInfo";
import type { MedalItem } from "../../constants/MedalsInfo";

type MedalsInfoModalProps = {
  visible: boolean;
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function MedalRow({ medal }: { medal: MedalItem }) {
  return (
    <View style={styles.medalRow}>
      <View style={[styles.medalIconBox, { backgroundColor: medal.color + "20" }]}>
        <MaterialCommunityIcons
          name={medal.icon}
          size={24}
          color={medal.color}
        />
      </View>
      <View style={styles.medalContent}>
        <Text style={[styles.medalName, { color: medal.color }]}>{medal.name}</Text>
        <Text style={styles.medalDesc}>{medal.description}</Text>
        <Text style={styles.howToEarnLabel}>Cómo se gana</Text>
        <Text style={styles.howToEarnText}>{medal.howToEarn}</Text>
      </View>
    </View>
  );
}

export function MedalsInfoModal({ visible, onClose }: MedalsInfoModalProps) {
  const medals = MEDALS_INFO ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIconBox}>
              <Ionicons name="information-circle" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Glosario de Medallas</Text>
            <Text style={styles.subtitle}>
              Qué significa cada medalla y cómo se consigue
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {medals.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  No hay medallas configuradas todavía.
                </Text>
              </View>
            ) : (
              <>
                {medals.map((medal) => (
                  <MedalRow key={medal.id} medal={medal} />
                ))}
                <View style={{ height: 24 }} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: SCREEN_WIDTH,
    height: "70%",
    maxHeight: "70%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerIconBox: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 20,
    padding: 4,
  },
  scroll: { flex: 1, minHeight: 200 },
  scrollContent: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  medalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 14,
  },
  medalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  medalContent: { flex: 1 },
  medalName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  medalDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  howToEarnLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  howToEarnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
});
