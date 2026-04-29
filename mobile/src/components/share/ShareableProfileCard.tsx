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
  const iconName = (icon: string) => ICON_MAP[icon] ?? "soccer";

  return (
    <View style={[styles.root, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <LinearGradient
        colors={["#0c1222", "#070b14", "#050810"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        {/* Accent bar — uses user accent color */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Header */}
        <View style={styles.header}>
          <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Tercer Tiempo</Text>
        </View>

        {/* Banner */}
        <View style={styles.bannerWrap}>
          {bannerSource ? (
            <Image
              source={bannerSource}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.defaultBanner}>
              <View style={styles.bannerPlaceholder} />
            </View>
          )}
          {isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          )}
        </View>

        {/* Profile: avatar + name + position */}
        <View style={styles.profileBlock}>
          <View
            style={[
              styles.avatarWrap,
              !frameSource && {
                borderColor: accentColor,
                borderWidth: frameWidth,
              },
            ]}
          >
            <UserAvatar
              imageUrl={photoUrl}
              name={displayName}
              size={88}
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
          <View style={[styles.positionBadge, { borderColor: accentColor + "60", backgroundColor: accentColor + "18" }]}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={11}
              color={accentColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.positionText, { color: accentColor }]}>
              {formatPositionForDisplay(mainPosition)}
            </Text>
          </View>
        </View>

        {/* Showcase */}
        {showcaseItems.length > 0 && (
          <View style={styles.showcase}>
            <View style={styles.showcaseHeader}>
              <MaterialCommunityIcons name="trophy" size={12} color="rgba(255,255,255,0.6)" />
              <Text style={styles.showcaseTitle}>Vitrina</Text>
            </View>
            <View style={styles.showcaseRow}>
              {showcaseItems.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.showcaseSlot}>
                  <View style={[styles.showcaseIconWrap, { borderColor: item.color + "50" }]}>
                    <MaterialCommunityIcons
                      name={iconName(item.icon) as any}
                      size={18}
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>tercertiempoxd</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0c1222",
  },
  inner: {
    flex: 1,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.9,
    zIndex: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
  },
  logo: { width: 26, height: 26, opacity: 0.95 },
  brand: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  bannerWrap: {
    height: 72,
    backgroundColor: "rgba(0,0,0,0.3)",
    marginHorizontal: 18,
    borderRadius: 10,
    overflow: "hidden",
  },
  bannerImage: { width: "100%", height: "100%" },
  defaultBanner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  proBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EAB308",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  proText: { fontSize: 9, fontWeight: "800", color: "#0c1222" },

  profileBlock: {
    alignItems: "center",
    marginTop: -32,
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
    backgroundColor: "rgba(15,23,42,0.8)",
  },
  avatarFrameOverlay: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userName: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  userHandle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  positionText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  showcase: {
    marginHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  showcaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  showcaseTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
  showcaseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  showcaseValue: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  showcaseLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 18,
  },
  footerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "lowercase",
  },
});
