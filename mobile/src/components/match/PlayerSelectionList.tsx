import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserAvatar } from "../ui/UserAvatar";

export type PlayerItem = {
  id: string;
  name: string;
  photo: string | null;
  status: string;
};

type Props = {
  players: PlayerItem[];
  rivalType: "INTERNAL" | "EXTERNAL";
  onTogglePlayer: (playerId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export function PlayerSelectionList({
  players,
  rivalType,
  onTogglePlayer,
  searchQuery,
  onSearchChange,
}: Props) {
  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  }, [players, searchQuery]);

  const getStatusMeta = (status: string) => {
    const isLocal = status === "LOCAL";
    const isVisita = status === "VISITANTE";
    const color = isLocal
      ? rivalType === "EXTERNAL"
        ? "#10B981"
        : "#3B82F6"
      : isVisita
        ? "#EF4444"
        : "#374151";
    const text = isLocal
      ? rivalType === "EXTERNAL"
        ? "JUEGA"
        : "EQUIPO A"
      : isVisita
        ? "EQUIPO B"
        : "NO CITA";
    return { color, text, isSelected: isLocal || isVisita };
  };

  const renderItem = ({ item, index }: { item: PlayerItem; index: number }) => {
    const meta = getStatusMeta(item.status);
    return (
      <TouchableOpacity
        style={[
          styles.row,
          meta.isSelected && {
            backgroundColor: `${meta.color}18`,
          },
        ]}
        onPress={() => onTogglePlayer(item.id)}
        activeOpacity={0.7}
        testID={index === 0 ? "e2e-match-create-first-player" : undefined}
      >
        <UserAvatar
          imageUrl={item.photo}
          name={item.name}
          size={28}
        />
        <Text
          style={[
            styles.name,
            meta.isSelected && { color: "white", fontWeight: "700" },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View style={[styles.checkWrap, meta.isSelected && { borderColor: meta.color }]}>
          {meta.isSelected ? (
            <Ionicons name="checkmark" size={14} color={meta.color} />
          ) : (
            <View style={styles.checkEmpty} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Buscar por nombre..."
          placeholderTextColor="#6B7280"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredPlayers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
        windowSize={10}
        nestedScrollEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: { paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  name: {
    flex: 1,
    marginLeft: 10,
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  checkEmpty: {},
});
