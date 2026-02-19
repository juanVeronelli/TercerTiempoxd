import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeMediaView,
  NativeAsset,
  NativeAssetType,
  TestIds,
  NativeAdRequestOptions,
} from "react-native-google-mobile-ads";
import { Colors } from "../../constants/Colors";

// Unit ID de Prueba para Native Advanced (Android: 2247696110, iOS: 3986624511)
const NATIVE_AD_UNIT_ID = TestIds.NATIVE;

export type NativeAdCardProps = {
  /** Opciones de request (aspect ratio, ad choices placement, etc.) */
  requestOptions?: NativeAdRequestOptions;
  /** Estilo del contenedor */
  style?: object;
};

/**
 * Componente de Native Advanced Ad integrado en la UI.
 * Muestra icono, título, body, star rating, MediaView (video/imagen) y CTA.
 * Usa TestIds.NATIVE en desarrollo; cambiar a tu Unit ID en producción.
 */
export function NativeAdCard({
  requestOptions,
  style,
}: NativeAdCardProps) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const adRef = useRef<NativeAd | null>(null);

  const loadAd = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ad = await NativeAd.createForAdRequest(
        NATIVE_AD_UNIT_ID,
        requestOptions || undefined,
      );
      adRef.current = ad;
      setNativeAd(ad);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el anuncio.");
      setNativeAd(null);
    } finally {
      setLoading(false);
    }
  }, [requestOptions]);

  useEffect(() => {
    loadAd();
    return () => {
      if (adRef.current) {
        adRef.current.destroy();
        adRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>Cargando anuncio...</Text>
      </View>
    );
  }

  if (error || !nativeAd) {
    return (
      <View style={[styles.placeholder, styles.errorPlaceholder, style]}>
        <Text style={styles.placeholderText}>{error || "Sin anuncios"}</Text>
      </View>
    );
  }

  const starRating = nativeAd.starRating ?? 0;
  const hasStars = starRating > 0;

  return (
    <View style={[styles.wrapper, style]}>
      <NativeAdView nativeAd={nativeAd} style={styles.nativeAdView}>
        {/* Fila superior: Icono + Título + AdChoices */}
        <View style={styles.headerRow}>
          {nativeAd.icon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={styles.icon}
                resizeMode="cover"
              />
            </NativeAsset>
          )}
          <View style={styles.titleBlock}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            )}
          </View>
        </View>

        {/* Body */}
        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.body} numberOfLines={3}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        {/* MediaView: video o imagen principal */}
        <NativeMediaView style={styles.mediaView} />

        {/* Fila inferior: Star Rating + CTA */}
        <View style={styles.footerRow}>
          {hasStars && (
            <NativeAsset assetType={NativeAssetType.STAR_RATING}>
              <View style={styles.starRow}>
                <Text style={styles.starText}>
                  {"★".repeat(Math.round(starRating))}
                  {"☆".repeat(5 - Math.round(starRating))}
                </Text>
                <Text style={styles.starValue}>{starRating.toFixed(1)}</Text>
              </View>
            </NativeAsset>
          )}
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
            </TouchableOpacity>
          </NativeAsset>
        </View>
      </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nativeAdView: {
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
  },
  titleBlock: {
    flex: 1,
    marginLeft: 12,
  },
  headline: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  advertiser: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  body: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  mediaView: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  starText: {
    fontSize: 14,
    color: Colors.accentGold,
    letterSpacing: 1,
  },
  starValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  placeholder: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorPlaceholder: {
    opacity: 0.7,
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
