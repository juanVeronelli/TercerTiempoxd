import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_THEME } from "./profileConstants";
import type { BannerPreset } from "./profileConstants";

type ProfileBannerModalProps = {
  visible: boolean;
  onClose: () => void;
  availableBanners: BannerPreset[];
  currentBannerId: string | null | undefined;
  activeAccent: string;
  onSelect: (bannerId: string) => void;
};

export function ProfileBannerModal({
  visible,
  onClose,
  availableBanners,
  currentBannerId,
  activeAccent,
  onSelect,
}: ProfileBannerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>PORTADAS PREMIUM</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {availableBanners.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              style={[
                styles.bannerOption,
                currentBannerId === banner.id && {
                  borderColor: activeAccent,
                  borderWidth: 2,
                },
              ]}
              onPress={() => onSelect(banner.id)}
            >
              <Image source={banner.source} style={styles.bannerPreview} resizeMode="cover" />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerName}>{banner.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PROFILE_THEME.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: PROFILE_THEME.cardBorder,
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  bannerOption: {
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#111827",
  },
  bannerPreview: { width: "100%", height: "100%" },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
    padding: 10,
  },
  bannerName: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 5,
  },
});
