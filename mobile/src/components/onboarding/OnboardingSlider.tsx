import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Colors } from "../../constants/Colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- DATA: 3 slides ---
const ONBOARDING_SLIDES: { id: string; title: string; description: string; image: ImageSourcePropType }[] = [
  {
    id: "1",
    title: "Armá el picadito",
    description:
      "Creá tu partido, sumá a tus amigos y olvidate del caos de WhatsApp.",
    image: require("../../../assets/mocks/slide1.png"),
  },
  {
    id: "2",
    title: "El Tercer Tiempo",
    description:
      "Jueguen y pónganse puntajes de forma anónima sin pelearse.",
    image: require("../../../assets/mocks/slide2.png"),
  },
  {
    id: "3",
    title: "Convertite en Leyenda",
    description:
      "Mirá las estadísticas, ganá medallas y fijate quién es el MVP del mes.",
    image: require("../../../assets/mocks/slide3.png"),
  },
];

type SlideItem = (typeof ONBOARDING_SLIDES)[number];

export type OnboardingSliderProps = {
  onComplete: () => void;
};

/**
 * Slider de onboarding con 3 pantallas, indicador de puntos y CTA.
 *
 * PERSISTENCIA CON AsyncStorage:
 * 1. Instalá: npx expo install @react-native-async-storage/async-storage
 * 2. En onComplete, guardá el flag:
 *    await AsyncStorage.setItem('@onboarding_viewed', 'true');
 * 3. Al iniciar la app (index), ANTES de redirigir por login, verificá:
 *    const viewed = await AsyncStorage.getItem('@onboarding_viewed');
 *    if (viewed !== 'true') -> mostrar OnboardingSlider; si no -> ir a login/main
 * 4. Ejemplo de integración en app/index.tsx o en una ruta (auth)/onboarding:
 *
 *    const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
 *    useEffect(() => {
 *      AsyncStorage.getItem('@onboarding_viewed').then((v) =>
 *        setShowOnboarding(v === 'true')
 *      );
 *    }, []);
 *    if (showOnboarding === null) return <ActivityIndicator />;
 *    if (!showOnboarding) {
 *      return (
 *        <OnboardingSlider
 *          onComplete={async () => {
 *            await AsyncStorage.setItem('@onboarding_viewed', 'true');
 *            router.replace('/(auth)/login');
 *          }}
 *        />
 *      );
 *    }
 *    // ... resto del flujo (check login, redirect)
 */
export function OnboardingSlider({ onComplete }: OnboardingSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / SCREEN_WIDTH);
      if (index >= 0 && index < ONBOARDING_SLIDES.length) {
        setActiveIndex(index);
      }
    },
    []
  );

  const renderSlide = ({ item }: { item: SlideItem }) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  const goToNextSlide = useCallback(() => {
    if (isLastSlide) {
      onComplete();
    } else {
      const nextIndex = activeIndex + 1;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, isLastSlide, onComplete]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
      />

      {/* Indicador de puntos (dots) */}
      <View style={styles.dotsContainer}>
        {ONBOARDING_SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* CTA: visible siempre. En el último slide dice "Empezar a jugar" y ejecuta onComplete; antes "Siguiente" avanza */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={goToNextSlide}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLastSlide ? "Empezar a jugar" : "Siguiente"}
          </Text>
        </TouchableOpacity>
        {!isLastSlide && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onComplete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  imageContainer: {
    width: SCREEN_WIDTH - 48,
    height: 360,
    marginBottom: 24,
    alignSelf: "center",
    backgroundColor: Colors.background,
    borderRadius: 16,
    overflow: "hidden",
  },
  slideImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
    fontStyle: "italic",
  },
  description: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.accentGold,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
  },
  ctaButton: {
    backgroundColor: Colors.accentGold,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accentGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.textInverse,
    letterSpacing: 0.5,
  },
  skipButton: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
