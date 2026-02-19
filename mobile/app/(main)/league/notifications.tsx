import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { ScreenHeader } from "../../../src/components/ui/ScreenHeader";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { Skeleton } from "../../../src/components/ui/Skeleton";
import { NotificationItem } from "../../../src/components/NotificationItem";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
} from "../../../src/services/notificationService";
import type { Notification as NotificationType } from "../../../src/types/notifications";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TEST_IDS = new Set([
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
]);

function isTestId(id: string | undefined): boolean {
  return !!id && TEST_IDS.has(id);
}

function navigateFromNotification(
  router: ReturnType<typeof useRouter>,
  item: NotificationType,
) {
  const data = item.data ?? {};
  const matchId = data.matchId;
  const leagueId = data.leagueId;
  const isTest = isTestId(matchId) || isTestId(leagueId);

  switch (item.type) {
    case "MATCH_SUMMON":
    case "MATCH_UNSUMMON":
    case "MATCH_CANCELLED":
    case "REMINDER_CONFIRM":
      if (isTest) router.push("/(main)/league/match" as any);
      else if (matchId) router.push(`/(main)/league/match/${matchId}` as any);
      break;
    case "MATCH_FINISHED_VOTE":
    case "VOTING_CLOSED_RESULTS":
    case "REMINDER_VOTE":
      if (isTest) router.push("/(main)/league/match" as any);
      else if (matchId)
        router.push({
          pathname: "/(main)/league/match/vote",
          params: { matchId },
        } as any);
      break;
    case "AWARD_MVP":
    case "AWARD_GHOST":
    case "AWARD_TRUNK":
    case "AWARD_ORACLE":
      if (isTest) router.push("/(main)/league/match" as any);
      else if (matchId)
        router.push({
          pathname: "/(main)/league/match/results",
          params: { matchId },
        } as any);
      break;
    case "DUEL_PARTICIPANT":
    case "DUEL_RESULT_WIN":
    case "DUEL_RESULT_LOSS":
      router.push("/(main)/league/home" as any);
      break;
    case "PREDICTIONS_OPEN":
    case "PREDICTION_DEADLINE":
      router.push("/(main)/league/predictions" as any);
      break;
    case "RANKING_OVERTAKE":
      router.push("/(main)/league/ranking" as any);
      break;
    default:
      if (isTest) router.push("/(main)/league/match" as any);
      else if (matchId) router.push(`/(main)/league/match/${matchId}` as any);
      else if (leagueId) router.push("/(main)/league/home" as any);
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clearingRead, setClearingRead] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    try {
      setError(null);
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const res = await getNotifications(pageNum, 20);
      if (append) {
        setItems((prev) => [...prev, ...res.items]);
      } else {
        setItems(res.items ?? []);
      }
      setHasMore(
        (res.pagination?.page ?? 1) < (res.pagination?.totalPages ?? 0),
      );
    } catch (e: any) {
      setHasMore(false);
      setError(
        e?.response?.data?.error ?? e?.message ?? "Error al cargar",
      );
      if (pageNum === 1) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      loadPage(1, false);
    }, [loadPage]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadPage(1, false);
    setRefreshing(false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    loadPage(next, true);
  }, [page, hasMore, loadingMore, loadPage]);

  const handleItemPress = useCallback(
    async (item: NotificationType) => {
      if (!item.is_read) {
        try {
          await markAsRead(item.id);
          setItems((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
          );
        } catch {
          // ignore
        }
      }
      navigateFromNotification(router, item);
    },
    [router],
  );

  const handleDeleteOne = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => prev.filter((n) => n.id !== id));
    deleteNotification(id).catch(() => {
      // Re-add on failure if desired
    });
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const unreadCount = items.filter((n) => !n.is_read).length;
    if (unreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      await markAllAsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // could show toast
    } finally {
      setMarkingAllRead(false);
    }
  }, [items]);

  const handleClearRead = useCallback(async () => {
    const readIds = items.filter((n) => n.is_read).map((n) => n.id);
    if (readIds.length === 0) return;
    setClearingRead(true);
    try {
      const { deleted } = await clearReadNotifications();
      if (deleted > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems((prev) => prev.filter((n) => !n.is_read));
      }
    } catch {
      // could show toast
    } finally {
      setClearingRead(false);
    }
  }, [items]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationType }) => (
      <NotificationItem
        item={item}
        onPress={() => handleItemPress(item)}
        onDelete={() => handleDeleteOne(item.id)}
      />
    ),
    [handleItemPress, handleDeleteOne],
  );

  const keyExtractor = useCallback((item: NotificationType) => item.id, []);

  const hasRead = items.some((n) => n.is_read);
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Notificaciones"
        icon="bell"
        showBack
        rightAction={
          hasUnread || hasRead ? (
            <View style={styles.headerActions}>
              {hasUnread && (
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  disabled={markingAllRead}
                  style={styles.headerBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={22}
                    color={
                      markingAllRead ? Colors.textSecondary : Colors.accent
                    }
                  />
                </TouchableOpacity>
              )}
              {hasRead && (
                <TouchableOpacity
                  onPress={handleClearRead}
                  disabled={clearingRead}
                  style={styles.headerBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Feather
                    name="trash-2"
                    size={22}
                    color={clearingRead ? Colors.textSecondary : "#94A3B8"}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : undefined
        }
      />
      {loading && items.length === 0 && !error ? (
        <View style={styles.listContent}>
          <Skeleton
            width="100%"
            height={360}
            borderRadius={16}
            style={{ alignSelf: "stretch" }}
          />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline"
            size={48}
            color={Colors.textSecondary}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadPage(1, false)}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.accent}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title="Estás al día"
                message="No tienes notificaciones nuevas."
                iconName="check"
              />
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <Skeleton
                  width="100%"
                  height={48}
                  borderRadius={12}
                  style={{ marginHorizontal: 20 }}
                />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
