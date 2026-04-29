import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../../constants/Colors";
import apiClient from "../../api/apiClient";

export type LeagueInviteHeroProps = {
  leagueId: string;
  onCopy?: () => void;
};

/**
 * Hero con el código de invitación de la liga. Invita a sumar amigos.
 */
export function LeagueInviteHero({ leagueId, onCopy }: LeagueInviteHeroProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchCode = useCallback(async () => {
    if (!leagueId) return;
    try {
      const res = await apiClient.get(`/leagues/${leagueId}`);
      setInviteCode(res.data.invite_code ?? null);
    } catch {
      setInviteCode(null);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  const handleCopy = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !inviteCode) return null;

  return (
    <View style={styles.card}>
      <View style={styles.bgIconWrap} pointerEvents="none">
        <MaterialCommunityIcons
          name="account-group"
          size={80}
          color={Colors.heroInviteBorder}
          style={styles.bgIcon}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Una liga no tiene sentido sin amigos</Text>
        <Text style={styles.subtitle}>
          Invitalos con este código para que se sumen a la liga y a los
          partidos de fútbol en cancha.
        </Text>

        <TouchableOpacity
          style={styles.codeRow}
          onPress={handleCopy}
          activeOpacity={0.85}
        >
          <Text style={styles.codeText} selectable>
            {inviteCode}
          </Text>
          <View style={styles.copyBadge}>
            {copied ? (
              <MaterialCommunityIcons name="check" size={18} color={Colors.surface} />
            ) : (
              <MaterialCommunityIcons name="content-copy" size={18} color={Colors.surface} />
            )}
            <Text style={styles.copyText}>{copied ? "Copiado" : "Copiar"}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.heroInviteBg,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.heroInviteBorder,
    padding: 18,
    minHeight: 140,
    overflow: "hidden",
    position: "relative",
  },
  bgIconWrap: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  bgIcon: {
    opacity: 0.18,
    transform: [{ rotate: "-15deg" }],
  },
  content: {
    paddingTop: 2,
  },
  title: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.heroInviteTextSub,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    maxWidth: 280,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.heroInviteBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  codeText: {
    color: Colors.accentGold,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
    flex: 1,
  },
  copyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentGold,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  copyText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
});
