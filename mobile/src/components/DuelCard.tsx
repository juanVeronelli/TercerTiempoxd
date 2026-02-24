import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import apiClient from "../api/apiClient";
import { useRouter } from "expo-router";
import { useCustomAlert } from "../context/AlertContext";
import { UserAvatar } from "./ui/UserAvatar";
import { Skeleton } from "./ui/Skeleton";
import { Colors } from "../constants/Colors";

interface DuelCardProps {
  matchId: string;
  isAdmin: boolean;
  onRefresh?: () => void;
  leagueId?: string;
}

export const DuelCard = ({
  matchId,
  isAdmin,
  onRefresh,
  leagueId,
}: DuelCardProps) => {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [duel, setDuel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDuel = async () => {
    try {
      const res = await apiClient.get(`/match/${matchId}/duel`);
      setDuel(res.data);
    } catch (error) {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (matchId) fetchDuel();
  }, [matchId]);

  const handleGenerateDuel = async () => {
    try {
      setGenerating(true);
      const res = await apiClient.post(
        `/match/${matchId}/duel/generate`,
        {},
      );
      setDuel(res.data.duel);
      showAlert("¡Duelo Listo!", "Cruces asignados correctamente.");
      if (onRefresh) onRefresh();
      fetchDuel();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Error al generar.";
      showAlert("Error", msg);
    } finally {
      setGenerating(false);
    }
  };

  const navigateToProfile = (playerId: string) => {
    router.push(`/(main)/profile/${playerId}` as any);
  };

  const navigateToPredictions = () => {
    if (leagueId) {
      router.push({
        pathname: "/(main)/league/predictions",
        params: { leagueId },
      });
    } else {
      router.push(`/(main)/league/match/${matchId}` as any);
    }
  };

  if (loading)
    return (
      <View style={styles.cardContainer}>
        <Skeleton width="100%" height={150} borderRadius={20} style={{ alignSelf: "stretch" }} />
      </View>
    );

  // ==============================================================================
  // ESTADO VACÍO
  // ==============================================================================
  if (!duel) {
    return (
      <View style={[styles.cardContainer, styles.emptyContainer]}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons
            name="sword-cross"
            size={16}
            color={Colors.accentGold}
          />
          <Text style={styles.headerTitle}>DUELO DE LA FECHA</Text>
        </View>

        {isAdmin ? (
          <View style={styles.emptyContent}>
            <Text style={styles.emptyText}>
              Aún no se ha definido el enfrentamiento estelar.
            </Text>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateDuel}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="flash" size={16} color={Colors.textInverse} />
                  <Text style={styles.generateBtnText}>GENERAR CRUCE (IA)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mysteryContent}>
            <View style={styles.mysteryIcons}>
              <Ionicons
                name="person"
                size={24}
                color={Colors.textSecondary}
                style={{ opacity: 0.5 }}
              />
              <Text style={styles.vsTextMuted}>VS</Text>
              <Ionicons
                name="person"
                size={24}
                color={Colors.textSecondary}
                style={{ opacity: 0.5 }}
              />
            </View>
            <Text style={styles.emptyText}>
              Aun no hay un duelo de la fecha asignado
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ==============================================================================
  // ESTADO ACTIVO
  // ==============================================================================
  const p1 = duel.challenger;
  const p2 = duel.rival;
  if (!p1 || !p2) return null;

  // winner_id (snake_case) o winnerId (camelCase); también winner.id por si la API devuelve la relación
  const winnerId =
    duel.winner_id ?? (duel as any).winnerId ?? duel.winner?.id ?? null;
  const isFinished = !!winnerId;

  // Título Dinámico
  const headerText = isFinished ? "GANADOR DEL DUELO" : "DUELO ESTELAR";
  const headerIcon = "sword-cross";

  const renderPlayerColumn = (player: any) => {
    const isWinner = winnerId === player.id;
    const isLoser = winnerId && !isWinner;
    const opacity = isLoser ? 0.5 : 1;

    // Datos
    const avg = Number(player.stats?.overall || 5).toFixed(1);
    const mvps = player.stats?.mvps || 0;

    const hasFrame = player.avatar_frame && player.avatar_frame !== "simple";
    const borderColor = isWinner || hasFrame ? Colors.accentGold : Colors.borderLight;
    const borderWidth = isWinner ? 3 : 2;

    return (
      <View style={[styles.playerColumn, { opacity }]}>
        <View style={{ height: 20 }} />

        {/* Avatar */}
        <TouchableOpacity
          onPress={() => navigateToProfile(player.id)}
          activeOpacity={0.8}
          style={styles.avatarContainerRelative}
        >
          <View style={[styles.avatarCircle, { borderColor, borderWidth }]}>
            <UserAvatar
              imageUrl={player.profile_photo_url}
              name={player.full_name}
              size={64}
            />
          </View>
          {isWinner && (
            <View style={styles.duelWinnerBadge}>
              <MaterialCommunityIcons name="sword-cross" size={12} color={Colors.textInverse} />
            </View>
          )}
        </TouchableOpacity>

        {/* Nombre */}
        <Text
          style={[styles.playerName, isWinner && { color: Colors.accentGold }]}
          numberOfLines={1}
        >
          {player.full_name?.split(" ")[0]}
        </Text>

        {/* STATS */}
        <View style={styles.statsRowSimple}>
          <Text style={styles.statText}>
            AVG: <Text style={styles.statValue}>{avg}</Text>
          </Text>
          <View style={styles.statSeparator} />
          <Text style={styles.statText}>
            MVP: <Text style={styles.statValue}>{mvps}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.cardContainer}>
      {/* HEADER */}
      <View style={styles.headerRowCenter}>
        <View
          style={[
            styles.headerBadge,
            isFinished && { backgroundColor: Colors.accentGold },
          ]}
        >
          <MaterialCommunityIcons
            name={headerIcon as any}
            size={12}
            color={Colors.textInverse}
          />
          <Text style={styles.headerBadgeText}>{headerText}</Text>
        </View>
      </View>

      {/* CONTENIDO PRINCIPAL */}
      <View style={styles.duelBody}>
        {renderPlayerColumn(p1)}
        <View style={styles.vsCenterContainer}>
          <View style={styles.vsLine} />
          <View style={styles.vsCircle}>
            <Text style={styles.vsTextMain}>VS</Text>
          </View>
          <View style={styles.vsLine} />
        </View>
        {renderPlayerColumn(p2)}
      </View>

      {/* FOOTER PREDICCIONES (Si no terminó) */}
      {!isFinished && (
        <View style={styles.footerAction}>
          <Text style={styles.footerHint}>¿Quién crees que ganará?</Text>
          <TouchableOpacity
            style={styles.predictButton}
            onPress={navigateToPredictions}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="crystal-ball"
              size={14}
              color={Colors.accentGold}
            />
            <Text style={styles.predictBtnText}>PREDECIR RESULTADO</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.accentGold} />
          </TouchableOpacity>
        </View>
      )}

      {/* FOOTER RESULTADO (Si terminó) */}
      {isFinished && (
        <View style={styles.footerResult}>
          <Text style={styles.footerResultText}>
            ¡Enfrentamiento finalizado!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // CONTAINER
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
    shadowColor: Colors.textInverse,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // HEADER COMÚN
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  headerTitle: {
    color: Colors.accentGold,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },

  // EMPTY STATE
  emptyContainer: {
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceMuted,
  },
  emptyContent: { alignItems: "center", paddingBottom: 20 },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 15,
    textAlign: "center",
  },
  generateBtn: {
    backgroundColor: Colors.accentGold,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  generateBtnText: { color: Colors.textInverse, fontWeight: "bold", fontSize: 11 },
  mysteryContent: { alignItems: "center", paddingBottom: 20 },
  mysteryIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 10,
  },
  vsTextMuted: {
    color: Colors.textSecondary,
    fontWeight: "900",
    fontSize: 14,
    opacity: 0.5,
  },

  // HEADER ACTIVO
  headerRowCenter: { alignItems: "center", marginTop: 15, marginBottom: 10 },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: Colors.textInverse,
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // DUEL BODY
  duelBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerColumn: { alignItems: "center", flex: 1 },

  avatarContainerRelative: { position: "relative", marginBottom: 8 },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceDark,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 32 },
  duelWinnerBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: Colors.accentGold,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  playerName: {
    color: Colors.textPrimary,
    fontWeight: "bold",
    fontSize: 13,
    marginBottom: 2,
    textAlign: "center",
  },

  // STATS
  statsRowSimple: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statText: { color: Colors.textSecondary, fontSize: 10, fontWeight: "600" },
  statValue: { color: Colors.accentGold, fontWeight: "900" },
  statSeparator: {
    width: 1,
    height: 10,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 6,
  },

  // CENTER VS
  vsCenterContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceDark,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginVertical: 5,
  },
  vsTextMain: {
    color: Colors.accentGold,
    fontWeight: "900",
    fontSize: 14,
    fontStyle: "italic",
  },
  vsLine: { width: 1, height: 15, backgroundColor: Colors.borderLight },

  // FOOTER ACTION
  footerAction: {
    backgroundColor: "rgba(0,0,0,0.1)",
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  footerHint: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontStyle: "italic",
    marginBottom: 6,
  },
  predictButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.accentGold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.accentGoldSubtle,
  },
  predictBtnText: {
    color: Colors.accentGold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // FOOTER RESULTADO
  footerResult: {
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.status.warningSubtle,
  },
  footerResultText: { color: Colors.accentGold, fontSize: 11, fontWeight: "bold" },
});
