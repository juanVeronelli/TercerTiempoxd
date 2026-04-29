export function initMobileAds() {
  try {
    // En Expo Go no existe el módulo.
    const { mobileAds } = require("react-native-google-mobile-ads");
    mobileAds().initialize().catch(() => {});
  } catch {
    // módulo no disponible
  }
}

