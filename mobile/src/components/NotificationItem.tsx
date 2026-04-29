import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { Notification } from "../types/notifications";
import { Colors } from "../constants/Colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ACCENT = Colors.primary;
const UNREAD_BG = `${ACCENT}1A`;
const UNREAD_BORDER = ACCENT;
const READ_BG = "#0F172A";
const READ_TEXT = "#64748B";
const DANGER_BG = "#DC2626";

function getIconForType(
  type: Notification["type"],
): keyof typeof MaterialCommunityIcons.glyphMap {
  if (
    type.startsWith("MATCH_") ||
    type.startsWith("REMINDER_") ||
    type === "VOTING_CLOSED_RESULTS"
  ) {
    return "whistle";
  }
  if (
    type.startsWith("AWARD_") ||
    type.startsWith("DUEL_") ||
    type === "RANKING_OVERTAKE"
  ) {
    return "trophy";
  }
  if (type.startsWith("PREDICTION")) {
    return "chart-line";
  }
  return "bell-outline";
}

export type NotificationItemProps = {
  item: Notification;
  onPress: () => void;
  onDelete: () => void;
};

function NotificationItemInner({
  item,
  onPress,
  onDelete,
}: NotificationItemProps) {
  const isRead = !!item.is_read;

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={onDelete}
      activeOpacity={0.9}
    >
      <MaterialCommunityIcons name="trash-can" size={24} color="#FFF" />
    </TouchableOpacity>
  );

  const content = (
    <TouchableOpacity
      style={[
        styles.contentRow,
        isRead ? styles.contentRead : styles.contentUnread,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.iconCircle,
          isRead ? styles.iconCircleRead : styles.iconCircleUnread,
        ]}
      >
        <MaterialCommunityIcons
          name={getIconForType(item.type)}
          size={22}
          color={isRead ? READ_TEXT : ACCENT}
        />
      </View>
      <View style={styles.textBlock}>
        <Text
          style={[styles.title, isRead ? styles.titleRead : styles.titleUnread]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.body, isRead ? styles.bodyRead : styles.bodyUnread]}
          numberOfLines={2}
        >
          {item.body}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={isRead ? READ_TEXT : "rgba(255,255,255,0.5)"}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      {content}
    </Swipeable>
  );
}

export function NotificationItem(props: NotificationItemProps) {
  return (
    <View style={styles.wrapper}>
      <NotificationItemInner {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    minHeight: 72,
  },
  contentUnread: {
    backgroundColor: UNREAD_BG,
    borderLeftColor: UNREAD_BORDER,
  },
  contentRead: {
    backgroundColor: READ_BG,
    borderLeftColor: "transparent",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: `${ACCENT}25`,
  },
  iconCircleRead: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  textBlock: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    marginBottom: 4,
  },
  titleUnread: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  titleRead: {
    color: READ_TEXT,
    fontWeight: "500",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  bodyUnread: {
    color: "rgba(255,255,255,0.85)",
  },
  bodyRead: {
    color: "#475569",
  },
  chevron: {
    opacity: 0.7,
  },
  deleteAction: {
    backgroundColor: DANGER_BG,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
    marginBottom: 8,
  },
});
