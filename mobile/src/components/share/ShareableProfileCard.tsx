import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { formatPositionForDisplay } from "../../constants/Positions";
import { UserAvatar } from "../ui/UserAvatar";

const CARD_WIDTH = 340;
const CARD_HEIGHT = 520;

export type ShareableProfileCardProps = {
  bannerSource: ImageSourcePropType | null;
  photoUrl: string | null;
  name: string;
  username: string;
  mainPosition: string;
  isPro?: boolean;
  frameSource: ImageSourcePropType | null;
  frameColor: string;
  frameWidth: number;
  accentColor: string;
  showcaseItems: {
    id: string;
    label: string;
    icon: string;
    value: string | number;
    color: string;
  }[];
};

const LOGO_SOURCE = require("../../../assets/images/Logo.png");

const ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  soccer: "soccer",
  "chart-line": "chart-line",
  star: "star",
  trophy: "trophy",
  history: "history",
  tree: "tree",
  "sword-cross": "sword-cross",
  "crystal-ball": "crystal-ball",
};

export function ShareableProfileCard({
  bannerSource,
  photoUrl,
  name,
  username,
  mainPosition,
  isPro = false,
  frameSource,
  frameColor,
  frameWidth,
  accentColor,
  showcaseItems = [],
}: ShareableProfileCardProps) {
  const displayName = (name || "Usuario").trim();
  const iconName = (icon: string) =>
    ICON_MAP[icon] ?? "soccer";

  return (
    <View style={[styles.shadowWrap, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <View style={styles.card}>
        <LinearGradient
          colors={["#1F2937", "#0F172A", "#020617"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.inner}>
          {/* Banner */}
          <View style={styles.bannerContainer}>
            {bannerSource ? (
              <Image
                source={bannerSource}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.defaultBanner}>
                <Ionicons
                  name="image-outline"
                  size={36}
                  color="rgba(255,255,255,0.1)"
                />
              </View>
            )}
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>

          {/* Avatar con marco + nombre (solapado al banner) */}
          <View style={styles.profileInfo}>
            <View
              style={[
                styles.avatarFrame,
                !frameSource && {
                  borderColor: frameColor,
                  borderWidth: frameWidth,
                },
              ]}
            >
              <UserAvatar
                imageUrl={photoUrl}
                name={displayName}
                size={100}
              />
              {frameSource ? (
                <Image
                  source={frameSource}
                  style={styles.avatarFrameOverlay}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Text style={styles.userName} numberOfLines={2}>
              {displayName}
            </Text>
            <Text style={styles.userHandle}>@{username || "usuario"}</Text>
            <View
              style={[
                styles.positionBadge,
                {
                  borderColor: accentColor + "50",
                  backgroundColor: accentColor + "18",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="soccer-field"
                size={12}
                color={accentColor}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.positionText, { color: accentColor }]}>
                {formatPositionForDisplay(mainPosition)}
              </Text>
            </View>
          </View>

          {/* Vitrina - glassBox estilo widget */}
          {showcaseItems.length > 0 && (
            <View style={[styles.glassBox, styles.showcaseBlock]}>
              <Text style={styles.showcaseTitle}>🏆 VITRINA DE JUGADOR</Text>
              <View style={styles.showcaseRow}>
                {showcaseItems.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.showcaseSlot}>
                    <View
                      style={[
                        styles.showcaseIconBox,
                        { borderColor: item.color },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={iconName(item.icon) as any}
                        size={20}
                        color={item.color}
                      />
                    </View>
                    <Text style={styles.showcaseValue}>{item.value}</Text>
                    <Text style={styles.showcaseLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Branding + footer */}
          <View style={styles.footer}>
            <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
            <Text style={styles.footerSub}>tercertiempoxd</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
    backgroundColor: "#1F2937",
  },
  card: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#1F2937",
  },
  inner: {
    flex: 1,
    overflow: "hidden",
  },
  bannerContainer: {
    height: 100,
    backgroundColor: "#111827",
  },
  bannerImage: { width: "100%", height: "100%" },
  defaultBanner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  proBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proText: { fontSize: 9, fontWeight: "900", color: "black" },

  profileInfo: {
    alignItems: "center",
    marginTop: -40,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  avatarFrame: {
    width: 170,
    height: 170,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 12,
  },
  avatarFrameOverlay: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 54,
  },
  userName: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 2,
    textAlign: "center",
  },
  userHandle: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  positionText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  glassBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 20,
  },
  showcaseBlock: { marginBottom: 12 },
  showcaseTitle: {
    color: "rgba(248,250,252,0.95)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  showcaseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  showcaseSlot: {
    flex: 1,
    alignItems: "center",
  },
  showcaseIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  showcaseValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  showcaseLabel: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },

  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: { width: 48, height: 48, opacity: 0.9 },
  footerSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "lowercase",
  },
});
