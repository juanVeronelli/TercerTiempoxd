import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { UserAvatar } from "../ui/UserAvatar";
import { PROFILE_THEME } from "./profileConstants";
import { formatPositionForDisplay } from "../../constants/Positions";
import { PRESET_BANNERS } from "./profileConstants";
import type { AvatarFramePreset } from "./profileConstants";

export type ProfileUser = {
  name?: string;
  surname?: string;
  username?: string;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  mainPosition?: string;
  bio?: string | null;
  planType?: string;
};

type ProfileHeaderCardProps = {
  user: ProfileUser | null;
  activeFrame: AvatarFramePreset;
  activeAccent: string;
  uploading: boolean;
  onPickImage: () => void;
  onEditName?: () => void;
  onEditBio?: () => void;
  onEditPosition?: () => void;
};

export function ProfileHeaderCard({
  user,
  activeFrame,
  activeAccent,
  uploading,
  onPickImage,
  onEditName,
  onEditBio,
  onEditPosition,
}: ProfileHeaderCardProps) {
  const bannerDef = user?.bannerUrl
    ? PRESET_BANNERS.find((b) => b.id === user.bannerUrl)
    : undefined;
  const isPro = user?.planType === "PRO";
  const frameColorResolved = activeFrame.color === "accent" ? activeAccent : activeFrame.color;

  return (
    <View style={styles.profileCard}>
      <View style={styles.bannerContainer}>
        {bannerDef ? (
          <Image source={bannerDef.source} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={styles.defaultBanner}>
            <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.1)" />
          </View>
        )}
        {isPro && (
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        )}
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.avatarContainer}>
          <View
            style={[
              styles.avatarFrame,
              !activeFrame.source && {
                borderColor: frameColorResolved,
                borderWidth: activeFrame.width,
              },
            ]}
          >
            <UserAvatar
              imageUrl={user?.photoUrl}
              name={[user?.name, user?.surname].filter(Boolean).join(" ") || "Usuario"}
              size={100}
            />
            {activeFrame.source ? (
              <Image
                source={activeFrame.source}
                style={styles.avatarFrameOverlay}
                resizeMode="contain"
              />
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.editAvatarBtn, { backgroundColor: activeAccent }]}
            onPress={onPickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="camera" size={14} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {onEditName ? (
          <TouchableOpacity
            onPress={onEditName}
            style={styles.tappableText}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.userName}>
              {user?.name} {user?.surname}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.userName}>
            {user?.name} {user?.surname}
          </Text>
        )}
        <Text style={styles.userHandle}>@{user?.username || "usuario"}</Text>

        {onEditPosition ? (
          <TouchableOpacity
            onPress={onEditPosition}
            style={[
              styles.positionBadge,
              { borderColor: activeAccent + "40", backgroundColor: activeAccent + "15" },
            ]}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons
              name="soccer-field"
              size={14}
              color={activeAccent}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.positionText, { color: activeAccent }]}>
              {formatPositionForDisplay(user?.mainPosition)}
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.positionBadge,
              { borderColor: activeAccent + "40", backgroundColor: activeAccent + "15" },
            ]}
          >
            <MaterialCommunityIcons
              name="soccer-field"
              size={14}
              color={activeAccent}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.positionText, { color: activeAccent }]}>
              {formatPositionForDisplay(user?.mainPosition)}
            </Text>
          </View>
        )}

        {onEditBio ? (
          <TouchableOpacity
            onPress={onEditBio}
            style={styles.tappableBio}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.bioText}>{user?.bio || "Escribe una biografía..."}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.bioText}>{user?.bio || "Escribe una biografía..."}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: PROFILE_THEME.cardBg,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
    marginBottom: 25,
  },
  bannerContainer: { height: 140, backgroundColor: "#111827" },
  bannerImage: { width: "100%", height: "100%" },
  defaultBanner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  proBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: PROFILE_THEME.accentGold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proText: { fontSize: 10, fontWeight: "900", color: "black" },
  profileInfo: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 25,
    marginTop: -25,
  },
  avatarContainer: { position: "relative", marginBottom: 24 },
  avatarFrame: {
    padding: 0,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarFrameOverlay: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 54,
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: PROFILE_THEME.cardBg,
  },
  tappableText: {
    alignItems: "center",
  },
  userName: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 2,
    textAlign: "center",
  },
  userHandle: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 15,
  },
  positionText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  tappableBio: {
    width: "100%",
    alignItems: "center",
  },
  bioText: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
