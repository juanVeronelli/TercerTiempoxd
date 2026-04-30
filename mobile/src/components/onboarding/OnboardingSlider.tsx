import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  bullets: Array<{ icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap; lib: "ion" | "mci"; text: string }>;
};

export type OnboardingSliderProps = {
  onComplete: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function OnboardingSlider({ onComplete }: OnboardingSliderProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        key: "welcome",
        title: "Bienvenido a\nTercer Tiempo",
        subtitle:
          "La app para organizar fútbol real con tu grupo y vivir el partido antes, durante y después.",
        bullets: [
          { lib: "ion", icon: "people-outline", text: "Creá una liga con tus amigos" },
          { lib: "ion", icon: "calendar-outline", text: "Programá partidos y convocá" },
          { lib: "ion", icon: "chatbubble-ellipses-outline", text: "Después del partido: informe y vestuario" },
        ],
      },
      {
        key: "attendance",
        title: "Convocatoria\nsin caos",
        subtitle:
          "Se acabó el “¿quién va?”. Cada uno confirma, se anota o va de espectador. Todo queda claro.",
        bullets: [
          { lib: "ion", icon: "checkmark-circle-outline", text: "Confirmá asistencia en un toque" },
          { lib: "ion", icon: "eye-outline", text: "Espectadores también cuentan" },
          { lib: "mci", icon: "shield-check-outline", text: "Reglas automáticas para partidos recurrentes" },
        ],
      },
      {
        key: "report",
        title: "Informe oficial\n+ medallas",
        subtitle:
          "Cuando termina el partido, votan MVP/Tronco/Fantasma y queda el ranking. Competencia sana, datos reales.",
        bullets: [
          { lib: "ion", icon: "trophy-outline", text: "MVP y medallas del partido" },
          { lib: "ion", icon: "stats-chart-outline", text: "Ranking y estadísticas" },
          { lib: "mci", icon: "crystal-ball", text: "Prode y predicciones dentro de la liga" },
        ],
      },
      {
        key: "rewards",
        title: "Misiones,\nTTP y tienda",
        subtitle:
          "Jugá, completá misiones y ganá TTP. Desbloqueá cosméticos, consumibles y apostá contra la casa.",
        bullets: [
          { lib: "ion", icon: "flash-outline", text: "Ganás TTP por misiones y actividad" },
          { lib: "ion", icon: "pricetag-outline", text: "Tienda con consumibles y cosméticos" },
          { lib: "mci", icon: "gamepad-variant-outline", text: "Apuestas y combinadas (si vas de espectador)" },
        ],
      },
    ],
    [],
  );

  const isLast = index === slides.length - 1;

  const goTo = (next: number) => {
    const nx = clamp(next, 0, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nx, animated: true });
    setIndex(nx);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const nx = Math.round(x / width);
    setIndex(clamp(nx, 0, slides.length - 1));
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="onboarding-root">
      {/* Acentos abstractos (no dibujos), súper sutiles */}
      <View pointerEvents="none" style={styles.bgAccents}>
        <View style={[styles.bgBlob, styles.bgBlobA]} />
        <View style={[styles.bgBlob, styles.bgBlobB]} />
      </View>
      {/* SafeAreaView ya aplica el inset; acá solo damos un respiro mínimo */}
      <View style={[styles.header, { paddingTop: 6 }]}>
        <Text style={styles.brand}>TERCER TIEMPO</Text>
        {!isLast ? (
          <Pressable onPress={() => onComplete()} hitSlop={14}>
            <Text style={styles.skip}>Saltar</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, minHeight: height }]}>
            <View style={styles.slideInner}>
              <View style={styles.card}>
                <View style={styles.kickerRow}>
                  <View style={styles.kickerDot} />
                  <Text style={styles.kickerText}>Tu liga, tu partido, tu historia</Text>
                </View>
                <Text style={styles.heroTitle}>{item.title}</Text>
                <Text style={styles.heroSubtitle}>{item.subtitle}</Text>

                <View style={styles.bullets}>
                  {item.bullets.map((b, i) => (
                    <View key={`${item.key}-${i}`} style={styles.bulletRow}>
                      <View style={styles.bulletIcon}>
                        {b.lib === "ion" ? (
                          <Ionicons name={b.icon as any} size={16} color={"rgba(255,255,255,0.85)"} />
                        ) : (
                          <MaterialCommunityIcons
                            name={b.icon as any}
                            size={16}
                            color={"rgba(255,255,255,0.85)"}
                          />
                        )}
                      </View>
                      <Text style={styles.bulletText}>{b.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(18, insets.bottom + 16) }]}>
        <View style={styles.dots}>
          {slides.map((s, i) => {
            const active = i === index;
            return <View key={s.key} style={[styles.dot, active && styles.dotActive]} />;
          })}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            style={[styles.cta, isLast && styles.ctaGold]}
            onPress={() => {
              if (isLast) onComplete();
              else goTo(index + 1);
            }}
          >
            <Text style={[styles.ctaText, isLast && styles.ctaTextDark]}>
              {isLast ? "Empezar" : "Siguiente"}
            </Text>
            <Ionicons
              name={isLast ? "checkmark" : "arrow-forward"}
              size={18}
              color={isLast ? Colors.textInverse : Colors.textPrimary}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  bgAccents: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bgBlob: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 999,
  },
  bgBlobA: {
    top: -180,
    left: -160,
    backgroundColor: "rgba(90,125,255,0.16)",
    transform: [{ rotate: "18deg" }],
  },
  bgBlobB: {
    bottom: -220,
    right: -180,
    backgroundColor: "rgba(245,158,11,0.10)",
    transform: [{ rotate: "-12deg" }],
  },
  header: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  skip: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  slide: {
    paddingHorizontal: 22,
    paddingBottom: 96,
  },
  slideInner: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 0,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  kickerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.accentGold,
  },
  kickerText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    marginTop: 12,
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "650",
  },
  bullets: {
    marginTop: 18,
    gap: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  bulletText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 14,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderTopWidth: 0,
    borderTopColor: "transparent",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  dotActive: {
    width: 26,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  ctaRow: {
    alignItems: "center",
  },
  cta: {
    width: "100%",
    backgroundColor: "#5A7DFF",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  ctaGold: {
    backgroundColor: Colors.accentGold,
  },
  ctaText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  ctaTextDark: {
    color: Colors.textInverse,
  },
});

