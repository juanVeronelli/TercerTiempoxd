import React from "react";
import Constants from "expo-constants";

export type NativeAdCardWrapperProps = {
  style?: object;
  /** Si true (usuario PRO), no se muestran anuncios */
  isPro?: boolean;
};

/**
 * Wrapper que solo monta NativeAdCard en development/production builds.
 * En Expo Go no se importa NativeAdCard (evita crash: RNGoogleMobileAdsModule no existe).
 * Usuarios PRO no ven anuncios.
 */
export function NativeAdCardWrapper({ isPro, ...props }: NativeAdCardWrapperProps) {
  if (Constants.appOwnership === "expo") return null;
  if (isPro) return null;
  // Carga dinámica: solo en dev client / production, nunca en Expo Go
  const { NativeAdCard } = require("./NativeAdCard");
  return <NativeAdCard {...props} />;
}
