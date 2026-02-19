import React from "react";
import { View, Text, Image, StyleSheet, ImageSourcePropType } from "react-native";

const FALLBACK_BG = "#333333";

/**
 * Obtiene hasta 2 iniciales del nombre.
 * "Lionel Messi" -> "LM", "Pedri" -> "PE", "María" -> "MA"
 */
function getInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function isValidUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== "string") return false;
  const t = url.trim();
  return t.length > 0 && (t.startsWith("http://") || t.startsWith("https://"));
}

export type UserAvatarProps = {
  /** URL de la foto de perfil (opcional) */
  imageUrl?: string | null;
  /** Nombre para las iniciales (requerido) */
  name: string;
  /** Tamaño del avatar en px (default 40) */
  size?: number;
  /** Estilo opcional del contenedor */
  style?: object;
};

/**
 * Avatar de usuario: muestra imagen circular si hay imageUrl válida,
 * sino un círculo con iniciales sobre fondo oscuro.
 */
export function UserAvatar({
  imageUrl,
  name,
  size = 40,
  style,
}: UserAvatarProps) {
  const showImage = isValidUrl(imageUrl);

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    style,
  ];

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUrl! }}
        style={containerStyle}
        resizeMode="cover"
      />
    );
  }

  const initials = getInitials(name);
  const fontSize = Math.max(12, Math.floor(size * 0.42));

  return (
    <View style={[containerStyle, styles.fallback]}>
      <Text style={[styles.initials, { fontSize }]} numberOfLines={1}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: FALLBACK_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
