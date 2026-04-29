import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../constants/Colors";
import { getUnreadCount } from "../services/notificationService";

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const n = await getUnreadCount();
      setCount(n);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchCount();
    }, []),
  );

  useEffect(() => {
    fetchCount();
  }, []);

  const hasUnread = count != null && count > 0;
  const displayCount = count != null && count > 99 ? "99+" : String(count ?? 0);

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => router.push("/(main)/league/notifications")}
      activeOpacity={0.7}
    >
      <Ionicons
        name={hasUnread ? "notifications" : "notifications-outline"}
        size={24}
        color={Colors.white}
      />
      {!loading && hasUnread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {displayCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    marginLeft: 0,
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "bold",
  },
});
