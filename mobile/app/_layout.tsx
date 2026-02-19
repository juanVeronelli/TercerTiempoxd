import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AlertProvider } from "../src/context/AlertContext";

// DSN: Expo solo expone variables con prefijo EXPO_PUBLIC_*. Fallback a extra por si process.env no se inlinó.
function getSentryDsn(): string {
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_SENTRY_DSN === "string"
      ? process.env.EXPO_PUBLIC_SENTRY_DSN.trim()
      : "";
  const fromExtra =
    typeof Constants.expoConfig?.extra?.EXPO_PUBLIC_SENTRY_DSN === "string"
      ? Constants.expoConfig.extra.EXPO_PUBLIC_SENTRY_DSN.trim()
      : "";
  const dsn = fromEnv || fromExtra;
  return dsn && dsn.startsWith("http") ? dsn : "";
}

const SENTRY_DSN = getSentryDsn();

// Inicializar AdMob (solo en dev builds; en Expo Go el módulo no existe)
try {
  const { mobileAds } = require("react-native-google-mobile-ads");
  mobileAds().initialize().catch(() => {});
} catch {
  // Expo Go o módulo no disponible
}

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    tracesSampleRate: 0.2,
    debug: false,
    environment: __DEV__ ? "development" : "production",
    release: Application.nativeApplicationVersion ?? undefined,
    dist: Application.nativeBuildVersion ?? undefined,
  });
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AlertProvider>
        {/* headerShown: false → cada pantalla usa su propio ScreenHeader (navegación + título + notificaciones) */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </AlertProvider>
    </GestureHandlerRootView>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
