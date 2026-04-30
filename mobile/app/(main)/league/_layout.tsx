import { Tabs, usePathname, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
    height: 96,
    paddingBottom: 34,
    paddingTop: 8,
    ...(isProfileFromSelector ? { display: "none" as const } : {}),
  } as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: "#6B7280",
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.3,
          marginTop: 4,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 2,
        },
      }}
    >
      {/* 1. HOME */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 2. PARTIDOS — solo visible dentro de una liga */}
      <Tabs.Screen
        name="match"
        options={{
          title: "Partidos",
          href: isInsideLeague ? "/(main)/league/match" : null,
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

      {/* 3. RANKING — solo visible dentro de una liga */}
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

      {/* TIENDA (TTP) */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Tienda",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "storefront" : "storefront-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* PERFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
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
      <Tabs.Screen
        name="stats"
        options={{
          href: null,
          title: "Mi rendimiento",
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="predictions" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}

export default function LeagueTabsLayout() {
  return (
    <LeagueProvider>
      <LeagueTabsContent />
    </LeagueProvider>
  );
}
