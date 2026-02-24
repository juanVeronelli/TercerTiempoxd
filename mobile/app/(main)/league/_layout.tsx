import { useEffect } from "react";
import { Tabs, usePathname, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Colors } from "../../../src/constants/Colors";
import { LeagueProvider, useLeagueContext } from "../../../src/context/LeagueContext";

function LeagueTabsContent() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ leagueId?: string }>();
  const leagueContext = useLeagueContext();
  const leagueId = leagueContext?.leagueId ?? params?.leagueId ?? null;
  const isInsideLeague = Boolean(leagueId) || pathname.includes("/league/ranking") || pathname.includes("/league/match") || pathname.includes("/league/stats");
  /** Ocultar tab bar cuando se entra al perfil desde el selector (sin liga en contexto) */
  const isProfileFromSelector = pathname.includes("/league/profile") && !leagueId;

  const tabBarStyle = {
    backgroundColor: "#1a1b26",
    borderTopWidth: 0,
    height: 80,
    paddingBottom: 10,
    paddingTop: 10,
    ...(isProfileFromSelector ? { display: "none" as const } : {}),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
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

      {/* 2. RANKING — solo visible dentro de una liga */}
      <Tabs.Screen
        name="ranking"
        options={{
          title: "Ranking",
          href: isInsideLeague ? "/(main)/league/ranking" : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "trophy" : "trophy-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 3. PARTIDOS — solo visible dentro de una liga */}
      <Tabs.Screen
        name="match"
        options={{
          title: "Partidos",
          href: isInsideLeague ? "/(main)/league/match" : null,
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

      {/* 4. MI RENDIMIENTO — solo visible dentro de una liga */}
      <Tabs.Screen
        name="stats"
        options={{
          title: "Mi Rendimiento",
          href: isInsideLeague ? "/(main)/league/stats" : null,
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
  );
}

export default function LeagueTabsLayout() {
  useEffect(() => {
    if (Constants.appOwnership === "expo") return;
    import("../../../src/services/pushTokenService").then((m) =>
      m.registerPushToken(),
    );
  }, []);

  return (
    <LeagueProvider>
      <LeagueTabsContent />
    </LeagueProvider>
  );
}
