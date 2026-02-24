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
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [userPlanType, setUserPlanType] = useState<string>("FREE");

  useEffect(() => {
    const load = async () => {
      if (!matchId) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get(`/match/${matchId}/details`);
        const breakdown =
          (res.data?.votes_breakdown as VoteRow[] | undefined) ?? [];
        setVotes(breakdown);
        setUserPlanType(
          String(res.data?.userPlanType ?? "FREE").toUpperCase(),
        );
      } catch (e) {
        console.error(e);
        showAlert("Error", "No se pudo cargar el detalle de votos.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId, showAlert]);

  const isPro = userPlanType === "PRO";

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

  const showPromo = !isPro;

  const votesByVoter = votes.reduce<Record<string, VoteRow[]>>((acc, v) => {
    if (!acc[v.voter_name]) acc[v.voter_name] = [];
    acc[v.voter_name].push(v);
    return acc;
  }, {});

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
        {showPromo ? (
          <View style={styles.promoCard}>
            <View style={styles.promoIconWrap}>
              <Ionicons
                name="lock-closed"
                size={30}
                color={Colors.accentGold}
              />
            </View>
            <Text style={styles.promoTitle}>Votos anónimos protegidos</Text>
            <Text style={styles.promoSubtitle}>
              Solo los equipos con Plan PRO pueden ver el detalle de quién votó
              a quién en cada partido.
            </Text>
            <TouchableOpacity
              style={styles.promoButton}
              activeOpacity={0.9}
              onPress={() => router.push("/(main)/paywall")}
            >
              <Text style={styles.promoButtonText}>
                Desbloquear con Plan PRO
              </Text>
            </TouchableOpacity>
          </View>
        ) : votes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin votos registrados</Text>
            <Text style={styles.emptySubtitle}>
              Nadie cargó votos para este partido todavía.
            </Text>
          </View>
        ) : (
          <View style={styles.votesCard}>
            <View style={styles.votesHeader}>
              <View style={styles.votesHeaderIconWrap}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={24}
                  color={Colors.accentGold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.votesTitle}>Quién votó a quién</Text>
                <Text style={styles.votesSubtitle}>
                  Cada tarjeta muestra a un votante y a quiénes calificó.
                </Text>
              </View>
            </View>
            <View style={styles.votesList}>
              {Object.entries(votesByVoter).map(([voterName, voterVotes]) => (
                <View key={voterName} style={styles.voterCard}>
                  <View style={styles.voterHeader}>
                    <View style={styles.voterAvatar}>
                      <Ionicons
                        name="person"
                        size={18}
                        color={Colors.accentGold}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voterTitle} numberOfLines={1}>
                        {voterName}
                      </Text>
                      <Text style={styles.voterSubtitle}>
                        {voterVotes.length} voto
                        {voterVotes.length > 1 ? "s" : ""} en este partido
                      </Text>
                    </View>
                  </View>
                  <View style={styles.voterVotesList}>
                    {voterVotes.map((v, index) => (
                      <View
                        key={`${v.voter_name}-${v.target_name}-${index}`}
                        style={styles.voterVoteRow}
                      >
                        <View style={styles.voterVoteTarget}>
                          <Text
                            style={styles.voteTargetName}
                            numberOfLines={1}
                          >
                            {v.target_name}
                          </Text>
                          <Text style={styles.voteTargetLabel}>calificado</Text>
                        </View>
                        <View style={styles.voteRatingPill}>
                          <MaterialCommunityIcons
                            name="star"
                            size={14}
                            color={Colors.accentGold}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.voteRatingText}>
                            {Number(v.overall).toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

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

