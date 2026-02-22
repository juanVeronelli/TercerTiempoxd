import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserAvatar } from "../ui/UserAvatar";

export type PlayerForAccordion = {
  id: string;
  name: string;
  photo?: string | null;
  team?: string;
};

type AccordionSection = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  players: PlayerForAccordion[];
};

const NUM_COLUMNS = 3;

type Props = {
  confirmed: PlayerForAccordion[];
  pending: PlayerForAccordion[];
  declined?: PlayerForAccordion[];
  isExternal?: boolean;
  totalThresholdForCollapse?: number;
};

export function PlayerAccordionGrid({
  confirmed,
  pending,
  declined = [],
  isExternal = false,
  totalThresholdForCollapse = 15,
}: Props) {
  const totalPlayers = confirmed.length + pending.length + declined.length;
  const hasSetInitial = useRef(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    confirmed: true,
    pending: true,
    declined: true,
  });

  useEffect(() => {
    if (hasSetInitial.current || totalPlayers === 0) return;
    hasSetInitial.current = true;
    if (totalPlayers > totalThresholdForCollapse) {
      setExpanded({ confirmed: true, pending: false, declined: false });
    } else {
      setExpanded({ confirmed: true, pending: true, declined: true });
    }
  }, [totalPlayers, totalThresholdForCollapse]);

  const sections = useMemo<AccordionSection[]>(() => {
    return [
      {
        key: "confirmed",
        title: "Confirmados",
        icon: "checkmark-circle",
        color: "#10B981",
        players: confirmed,
      },
      {
        key: "pending",
        title: "Pendientes",
        icon: "time",
        color: "#F59E0B",
        players: pending,
      },
      {
        key: "declined",
        title: "Bajas",
        icon: "close-circle",
        color: "#EF4444",
        players: declined,
      },
    ];
  }, [confirmed, pending, declined]);

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderPlayerChip = useCallback(
    ({ item }: { item: PlayerForAccordion }) => (
      <View style={styles.chip}>
        <UserAvatar
          imageUrl={item.photo}
          name={item.name}
          size={36}
        />
        <Text style={styles.chipName} numberOfLines={1}>
          {item.name}
        </Text>
        {!isExternal && item.team && (
          <Text
            style={[
              styles.chipTeam,
              { color: item.team === "A" ? "#3B82F6" : "#8B5CF6" },
            ]}
          >
            {item.team === "A" ? "A" : "B"}
          </Text>
        )}
      </View>
    ),
    [isExternal]
  );

  return (
    <View style={styles.container}>
      {sections.map((section) => {
        const isOpen = expanded[section.key];
        const count = section.players.length;

        return (
          <View key={section.key} style={styles.accordion}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection(section.key)}
              activeOpacity={0.7}
            >
              <View style={styles.accordionLeft}>
                <View
                  style={[
                    styles.accordionIconWrap,
                    { backgroundColor: `${section.color}20` },
                  ]}
                >
                  <Ionicons
                    name={section.icon}
                    size={16}
                    color={section.color}
                  />
                </View>
                <Text style={styles.accordionTitle}>
                  {section.title} ({count})
                </Text>
              </View>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.accordionContent}>
                {count === 0 ? (
                  <Text style={styles.emptyText}>Ninguno</Text>
                ) : (
                  <FlatList
                    data={section.players}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPlayerChip}
                    numColumns={NUM_COLUMNS}
                    scrollEnabled={false}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.gridContent}
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  accordion: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  accordionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  accordionTitle: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  accordionContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
  gridContent: { paddingTop: 4 },
  row: {
    justifyContent: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
    minWidth: "30%",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chipName: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  chipTeam: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },
});
