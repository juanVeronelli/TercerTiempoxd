import { Platform } from "react-native";

/**
 * Inicializa AdMob si el módulo existe.
 *
 * En Expo Go y/o web el módulo puede no estar disponible; en ese caso es no-op.
 */
export function initMobileAds() {
  try {
    if (Platform.OS === "web") return;
    // Lazy require para no romper en Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MobileAds } = require("react-native-google-mobile-ads");
    if (MobileAds?.initialize) {
      void MobileAds.initialize();
    }
  } catch {
    // no-op
  }
}

