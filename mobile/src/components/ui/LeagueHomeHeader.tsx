import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { NotificationBell } from "../NotificationBell";

export type LeagueHomeHeaderProps = {
  /** Título centrado en el header (opcional) */
  title?: string;
  /** ID de la liga para navegar a settings (solo home) */
  leagueId?: string | null;
  /** Mostrar icono de configuración (solo en home de liga) */
  showSettings?: boolean;
  /** Si el padre ya aplica safe area top (ej. SafeAreaView), usar false para evitar doble espacio */
  addTopSafeArea?: boolean;
  /** Acción al tocar atrás; si no se pasa, va al selector de ligas */
  onBackPress?: () => void;
};

/**
 * Header: flecha atrás (va a selector de ligas), título centrado,
 * configuración (solo home) y campana.
 */
export function LeagueHomeHeader({
  title = "",
  leagueId,
  showSettings = false,
  addTopSafeArea = true,
  onBackPress,
}: LeagueHomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const paddingTop = addTopSafeArea ? (insets.top || 12) : 8;
  const handleBack = onBackPress ?? (() => router.replace("/(main)"));

  return (
    <View style={[styles.container, { paddingTop }]}>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={26} color={Colors.white} />
      </TouchableOpacity>

      <View style={styles.center}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {showSettings && leagueId && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(main)/league/settings",
                params: { leagueId },
              })
            }
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  title: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 44,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
