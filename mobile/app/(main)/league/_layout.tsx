import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Colors } from "../../../src/constants/Colors";
import { LeagueProvider } from "../../../src/context/LeagueContext";

export default function LeagueTabsLayout() {
  useEffect(() => {
    // En Expo Go (SDK 53+) las push no están soportadas en Android; evitar cargar expo-notifications
    if (Constants.appOwnership === "expo") return;
    import("../../../src/services/pushTokenService").then((m) =>
      m.registerPushToken(),
    );
  }, []);

  return (
    <LeagueProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a1b26",
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: "#6B7280",
        tabBarShowLabel: false,
      }}
    >
      {/* 1. HOME */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 2. RANKING */}
      <Tabs.Screen
        name="ranking"
        options={{
          title: "Ranking",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "trophy" : "trophy-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 3. PARTIDOS (testID y label para E2E Maestro) */}
      <Tabs.Screen
        name="match"
        options={{
          title: "Partidos",
          href: "/(main)/league/match",
          tabBarTestID: "tab-partidos",
          tabBarAccessibilityLabel: "Partidos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "football" : "football-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 4. MI RENDIMIENTO */}
      <Tabs.Screen
        name="stats"
        options={{
          title: "Mi Rendimiento",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "analytics" : "analytics-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 5. PERFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Rutas sin tab en la barra (acceso por navegación) */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="predictions" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
    </LeagueProvider>
  );
}
