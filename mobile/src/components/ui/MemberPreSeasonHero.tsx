import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";
import { Colors } from "../../constants/Colors";

export type MemberPreSeasonHeroProps = {
  leagueId: string;
  leagueName?: string;
};

/**
 * Hero para miembros en liga sin partidos: "Sala de espera".
 * Transmite que no es un error, sino pretemporada en curso.
 */
export function MemberPreSeasonHero({
  leagueId,
  leagueName = "la liga",
}: MemberPreSeasonHeroProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleShare = async () => {
    const message = inviteCode
      ? `¡Sumate a ${leagueName} en Tercer Tiempo! Usá este código para unirte: ${inviteCode}`
      : `¡Unite a ${leagueName} en Tercer Tiempo! Pedile el código de invitación al admin.`;
    try {
      await Share.share({
        message,
        title: `Invitar a ${leagueName}`,
      });
    } catch {
      // User cancelled or share not available
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingCard]}>
        <ActivityIndicator size="small" color={Colors.heroTealAccent} />
        <Text style={styles.loadingText}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Marca de agua: grande, sale desde la esquina, no se ve completa */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Ionicons
          name="hourglass-outline"
          size={130}
          color={Colors.heroTealAccent}
          style={styles.watermarkIcon}
        />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconContainer}>
          <Ionicons name="hourglass-outline" size={26} color={Colors.heroTealAccent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>PRETEMPORADA</Text>
          <Text style={styles.description}>
            Esperando a que el admin programe el primer partido!
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Ionicons name="share-outline" size={18} color={Colors.heroTealAccent} />
          <Text style={styles.shareBtnText}>Compartir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.heroTealBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.heroTealBorder,
    position: "relative",
    overflow: "hidden",
    minHeight: 100,
    justifyContent: "center",
    shadowColor: Colors.heroTealBorder,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  watermarkWrap: {
    position: "absolute",
    bottom: -45,
    right: -35,
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkIcon: {
    opacity: 0.07,
    transform: [{ rotate: "15deg" }],
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  loadingText: {
    color: Colors.heroTealTextSub,
    fontSize: 12,
    marginTop: 8,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(34, 211, 238, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.4)",
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    color: Colors.heroTealText,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  description: {
    color: Colors.heroTealTextSub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "400",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.heroTealAccent,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  shareBtnText: {
    color: Colors.heroTealAccent,
    fontSize: 11,
    fontWeight: "700",
  },
});
