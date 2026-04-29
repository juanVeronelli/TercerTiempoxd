import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "../../../../src/constants/Colors";
import apiClient from "../../../../src/api/apiClient";
import { formatUserFacingError } from "../../../../src/api/apiErrors";
import { useCustomAlert } from "../../../../src/context/AlertContext";
import { LeagueHomeHeader } from "../../../../src/components/ui/LeagueHomeHeader";
import { Skeleton } from "../../../../src/components/ui/Skeleton";

type VoteRow = {
  voter_name: string;
  target_name: string;
  overall: number;
};

export default function MatchVotesScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const router = useRouter();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!matchId) {
        setLoading(false);
        return;
      }
      try {
        // Mantener comportamiento: si falla el fetch, mostramos igualmente la pantalla.
        await apiClient.get(`/match/${matchId}/details`);
      } catch (e: unknown) {
        showAlert(
          "Error",
          formatUserFacingError(e, "No se pudo cargar el detalle de votos."),
          undefined,
          "error",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId, showAlert]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LeagueHomeHeader
          title="VOTOS DEL PARTIDO"
          addTopSafeArea={false}
          onBackPress={() => router.back()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Skeleton width="100%" height={120} borderRadius={16} />
          <View style={{ height: 16 }} />
          <Skeleton width="100%" height={260} borderRadius={18} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LeagueHomeHeader
        title="VOTOS DEL PARTIDO"
        addTopSafeArea={false}
        onBackPress={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.promoCard}>
          <View style={styles.promoIconWrap}>
            <Ionicons
              name="lock-closed"
              size={30}
              color={Colors.accentGold}
            />
          </View>
          <Text style={styles.promoTitle}>Votos anónimos</Text>
          <Text style={styles.promoSubtitle}>
            En Tercer Tiempo, los votos son secretos: nadie puede ver quién votó a quién.
          </Text>
          <TouchableOpacity
            style={styles.promoButton}
            activeOpacity={0.9}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text style={styles.promoButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  promoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  promoIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: Colors.accentGoldSubtle,
  },
  promoTitle: {
    color: Colors.textHeading,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  promoSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },
  promoButton: {
    backgroundColor: Colors.accentGold,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  promoButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.textHeading,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  votesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  votesHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  votesHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: Colors.accentGoldSubtle,
  },
  votesTitle: {
    color: Colors.textHeading,
    fontSize: 16,
    fontWeight: "800",
  },
  votesSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  votesList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  voterCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voterHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  voterAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: Colors.accentGoldSubtle,
  },
  voterTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  voterSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  voterVotesList: {
    marginTop: 4,
  },
  voterVoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  voterVoteTarget: {
    flex: 1,
    marginRight: 8,
  },
  voteTargetName: {
    color: Colors.textHeading,
    fontSize: 13,
    fontWeight: "600",
  },
  voteTargetLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  voteRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.accentGoldSubtle,
  },
  voteRatingText: {
    color: Colors.accentGold,
    fontSize: 13,
    fontWeight: "800",
  },
});

