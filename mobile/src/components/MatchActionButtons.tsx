import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../api/apiClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Colors } from "../constants/Colors";

interface MatchActionButtonsProps {
  leagueId: string;
}

export const MatchActionButtons = ({ leagueId }: MatchActionButtonsProps) => {
  const router = useRouter();
  const [votingMatches, setVotingMatches] = useState<any[]>([]);
  const [recentResult, setRecentResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [voteRes, resultsRes] = await Promise.all([
          apiClient.get(`/match/${leagueId}/voting`),
          apiClient.get(`/match/${leagueId}/recent-results`),
        ]);

        setVotingMatches(voteRes.data || []);

        // Solo nos interesa el último resultado para mostrar
        if (resultsRes.data && resultsRes.data.length > 0) {
          setRecentResult(resultsRes.data[0]);
        } else {
          setRecentResult(null);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) fetchData();
  }, [leagueId]);

  if (loading) return <View style={{ height: 20 }} />; // Espacio vacío mientras carga silenciosamente

  // Si no hay nada que mostrar, no renderizamos nada
  if (votingMatches.length === 0 && !recentResult) return null;

  return (
    <View style={styles.container}>
      {/* 1. BOTÓN VER RESULTADOS (VERDE) */}
      {recentResult && (
        <View style={styles.cardWrapper}>
          <View style={styles.headerBox}>
            <Text style={[styles.headerText, { color: Colors.status.success }]}>
              RESULTADOS DISPONIBLES
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                borderColor: Colors.status.success,
                backgroundColor: Colors.status.successSubtle,
              },
            ]}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: "/(main)/league/match/results",
                params: { matchId: recentResult.id },
              })
            }
          >
            <View style={styles.cardContent}>
              <View style={{ flex: 1 }}>
<Text style={[styles.cardTitle, { color: Colors.status.success }]}>
                VER RESULTADOS
                </Text>
                <Text style={styles.cardSubtitle}>
                  {recentResult.location_name} •{" "}
                  {format(new Date(recentResult.date_time), "d MMM", {
                    locale: es,
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: Colors.status.successLight },
                ]}
              >
                <Ionicons
                  name="stats-chart"
                  size={24}
                  color={Colors.status.success}
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. BOTÓN VOTAR (DORADO) - Mapeamos por si hay más de uno pendiente */}
      {votingMatches.map((match) => (
        <View key={match.id} style={styles.cardWrapper}>
          <View style={styles.headerBox}>
            <Text style={[styles.headerText, { color: Colors.accentGold }]}>
              PARTIDO TERMINADO
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                borderColor: Colors.accentGold,
                backgroundColor: Colors.status.warningSubtle,
              },
            ]}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: "/(main)/league/match/vote",
                params: { matchId: match.id },
              })
            }
          >
            <View style={styles.cardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: Colors.accentGold }]}>
                  MANDA TUS VOTOS
                </Text>
                <Text style={styles.cardSubtitle}>{match.location_name}</Text>
              </View>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: Colors.accentGoldLight },
                ]}
              >
                <Ionicons name="star" size={24} color={Colors.accentGold} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20, // Espacio antes de lo que siga
  },
  cardWrapper: {
    marginBottom: 15,
  },
  headerBox: {
    marginBottom: 8,
    marginTop: 5,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  actionCard: {
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "900",
    fontStyle: "italic",
    marginBottom: 4,
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
