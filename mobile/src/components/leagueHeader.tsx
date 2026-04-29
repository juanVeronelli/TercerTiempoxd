import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { useRouter } from "expo-router";
import { NotificationBell } from "./NotificationBell";

interface LeagueHeaderProps {
  leagueId: string;
  leagueName: string;
  onLeaguePress: () => void;
}

export const LeagueHeader = ({
  leagueId,
  leagueName,
  onLeaguePress,
}: LeagueHeaderProps) => {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      {/* Selector de Liga */}
      <TouchableOpacity style={styles.leagueDropdown} onPress={onLeaguePress}>
        <Text style={styles.leagueName}>{leagueName.toUpperCase()}</Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={Colors.white}
          style={styles.dropdownIcon}
        />
      </TouchableOpacity>

      {/* Iconos de la Derecha */}
      <View style={styles.rightIcons}>
        <NotificationBell />

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            // Navegamos pasando el leagueId correctamente
            router.push({
              pathname: "/(main)/league/settings",
              params: { leagueId: leagueId },
            });
          }}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.background,
  },
  leagueDropdown: { flexDirection: "row", alignItems: "center" },
  leagueName: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.white,
    fontStyle: "italic",
  },
  dropdownIcon: { marginLeft: 8 },
  rightIcons: { flexDirection: "row", alignItems: "center" },
  iconButton: { marginLeft: 20, position: "relative" },
});
