// Carga .env para que EXPO_PUBLIC_* esté disponible (obligatorio prefijo para Expo)
require("dotenv").config();

const appJson = require("./app.json");
const dsn =
  typeof process.env.EXPO_PUBLIC_SENTRY_DSN === "string"
    ? process.env.EXPO_PUBLIC_SENTRY_DSN.trim()
    : "";
const apiUrl =
  typeof process.env.EXPO_PUBLIC_API_URL === "string"
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : "";

// AdMob: desde env (EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, EXPO_PUBLIC_ADMOB_IOS_APP_ID) o IDs de prueba
const ADMOB_APP_IDS = {
  android:
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim() ||
    "ca-app-pub-3940256099942544~3347511713",
  ios:
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() ||
    "ca-app-pub-3940256099942544~1458002511",
};

// Package Android (identificador de la app para el build)
const ANDROID_PACKAGE = "com.jiveronell28.mobile";

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    name: "Tercer Tiempo",
    slug: "mobile",
    version: "1.0.0",
    ios: {
      ...appJson.expo?.ios,
      bundleIdentifier: "com.jiveronell28.mobile",
      supportsTablet: true,
    },
    android: {
      ...appJson.expo?.android,
      package: ANDROID_PACKAGE,
      adaptiveIcon: appJson.expo?.android?.adaptiveIcon || {
        foregroundImage: "./assets/images/IconAdaptive.png",
        backgroundColor: "#ffffff",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      ["@sentry/react-native/expo", { url: "https://sentry.io/", project: "tercertiempo-app", organization: "tercertiempo" }],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: ADMOB_APP_IDS.android,
          iosAppId: ADMOB_APP_IDS.ios,
        },
      ],
    ],
    extra: {
      ...appJson.expo?.extra,
      EXPO_PUBLIC_SENTRY_DSN: dsn || undefined,
      EXPO_PUBLIC_API_URL: apiUrl || undefined,
      // RevenueCat: usa EXPO_PUBLIC_REVENUECAT_API_KEY del .env (tu test key)
      EXPO_PUBLIC_REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() || undefined,
    },
  },
  "react-native-google-mobile-ads": {
    android_app_id: ADMOB_APP_IDS.android,
    ios_app_id: ADMOB_APP_IDS.ios,
  },
};
