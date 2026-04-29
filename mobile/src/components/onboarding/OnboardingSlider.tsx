import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { Colors } from "../../constants/Colors";
import {
  ONBOARDING_ANIMATION,
  ONBOARDING_BACKGROUND_GRADIENTS,
  ONBOARDING_LAYOUT,
  ONBOARDING_SLIDES,
} from "../../config/onboardingConfig";

export type OnboardingSliderProps = {
  onComplete: () => void;
};

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function OnboardingSlider({ onComplete }: OnboardingSliderProps) {
  const { width, height } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const activeIndex = useSharedValue(0);
  const backgroundProgress = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const heroScale = useSharedValue(1);
  const heroTranslateY = useSharedValue(20);
  const contentOpacity = useSharedValue(0);
  const pillsOpacity = useSharedValue(0);
  const pillsOffset = useSharedValue(20);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [burstVisible, setBurstVisible] = useState(false);

  useDerivedValue(() => {
    runOnJS(setCurrentIndex)(activeIndex.value);
  }, [activeIndex]);

  useEffect(() => {
    heroScale.value = withRepeat(
      withTiming(1.03, { duration: ONBOARDING_ANIMATION.heroBreathMs }),
      -1,
      true,
    );
  }, [heroScale]);

  const runEntrance = (index: number) => {
    const baseDelay = 120;

    contentOpacity.value = 0;
    heroTranslateY.value = 30;
    pillsOffset.value = 24;
    pillsOpacity.value = 0;

    contentOpacity.value = withDelay(
      baseDelay,
      withTiming(1, { duration: 420 }),
    );
    heroTranslateY.value = withDelay(
      baseDelay * 2,
      withSpring(0, { damping: 14, stiffness: 120 }),
    );
    pillsOffset.value = withDelay(
      baseDelay * 3,
      withTiming(0, { duration: 380 }),
    );
    pillsOpacity.value = withDelay(
      baseDelay * 3,
      withTiming(1, { duration: 380 }),
    );
    backgroundProgress.value = withTiming(index, {
      duration: ONBOARDING_ANIMATION.slideTransitionMs,
    });
  };

  useEffect(() => {
    runEntrance(0);
  }, []);

  const handleAdvance = () => {
    const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;
    if (isLastSlide) {
      setBurstVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        setBurstVisible(false);
        onComplete();
      }, ONBOARDING_ANIMATION.particleDurationMs);
      return;
    }

    const nextIndex = currentIndex + 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    activeIndex.value = nextIndex;
    translateX.value = withTiming(-nextIndex * width, {
      duration: ONBOARDING_ANIMATION.slideTransitionMs,
    });
    runEntrance(nextIndex);
  };

  const handleSkip = () => {
    const lastIndex = ONBOARDING_SLIDES.length - 1;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    activeIndex.value = lastIndex;
    translateX.value = withTiming(-lastIndex * width, {
      duration: ONBOARDING_ANIMATION.slideTransitionMs,
    });
    runEntrance(lastIndex);
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
    })
    .onEnd((event) => {
      const totalSlides = ONBOARDING_SLIDES.length;
      const threshold = width * 0.2;
      const current = activeIndex.value;
      let nextIndex = current;

      if (event.translationX < -threshold || event.velocityX < -300) {
        nextIndex = Math.min(totalSlides - 1, current + 1);
      } else if (event.translationX > threshold || event.velocityX > 300) {
        nextIndex = Math.max(0, current - 1);
      }

      if (nextIndex !== current) {
        activeIndex.value = nextIndex;
      }

      translateX.value = withTiming(-nextIndex * width, {
        duration: ONBOARDING_ANIMATION.slideTransitionMs,
      });
      backgroundProgress.value = withTiming(nextIndex, {
        duration: ONBOARDING_ANIMATION.slideTransitionMs,
      });
    });

  const slidesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: heroTranslateY.value },
      { scale: heroScale.value },
      {
        translateX: interpolate(
          translateX.value,
          [-(ONBOARDING_SLIDES.length - 1) * width, 0],
          [40, -40],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const pillsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pillsOpacity.value,
    transform: [{ translateY: pillsOffset.value }],
  }));

  const gradientColors = useDerivedValue(() => {
    const index = backgroundProgress.value;
    const from = Math.floor(index);
    const to = Math.min(ONBOARDING_BACKGROUND_GRADIENTS.length - 1, from + 1);
    const t = index - from;

    const fromColors = ONBOARDING_BACKGROUND_GRADIENTS[from];
    const toColors = ONBOARDING_BACKGROUND_GRADIENTS[to];

    const c0 = interpolateColor(t, [0, 1], [fromColors[0], toColors[0]]);
    const c1 = interpolateColor(t, [0, 1], [fromColors[1], toColors[1]]);
    const c2 = interpolateColor(t, [0, 1], [fromColors[2], toColors[2]]);

    return [c0, c1, c2];
  });

  const gradientProps = useAnimatedProps(() => ({
    colors:
      gradientColors.value as unknown as [string, string, ...string[]],
  }));

  const heroHeight = height * ONBOARDING_LAYOUT.heroHeightFactor;
  const heroWidth = width * ONBOARDING_LAYOUT.heroMaxWidthFactor;

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  return (
    <View style={styles.container} testID="onboarding-root">
      <AnimatedLinearGradient
        colors={
          ONBOARDING_BACKGROUND_GRADIENTS[0] as unknown as [string, string, ...string[]]
        }
        animatedProps={gradientProps}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.header}>
        <Text style={styles.brand} testID="onboarding-brand">
          Tercer Tiempo
        </Text>
        {!isLastSlide && (
          <Pressable
            onPress={handleSkip}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Saltar onboarding"
            accessibilityHint="Omite la introducción y entra a la app"
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>Saltar</Text>
          </Pressable>
        )}
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.gestureLayer}>
          <Pressable
            style={styles.pressableOverlay}
            onPress={handleAdvance}
            accessibilityRole="button"
            accessibilityLabel={
              isLastSlide
                ? "Terminar onboarding"
                : "Ir al siguiente paso del onboarding"
            }
            accessibilityHint="Toca en cualquier parte para avanzar"
            testID="onboarding-tap-anywhere"
          >
            <Animated.View
              style={[
                styles.slidesRow,
                { width: width * ONBOARDING_SLIDES.length },
                slidesAnimatedStyle,
              ]}
            >
              {ONBOARDING_SLIDES.map((slide, index) => (
                <View
                  key={slide.key}
                  style={[styles.slide, { width }]}
                  testID={`onboarding-slide-${slide.key}`}
                >
                  <Animated.View
                    style={[
                      styles.heroContainer,
                      heroAnimatedStyle,
                      { height: heroHeight },
                    ]}
                  >
                    <View
                      style={[
                        styles.heroPlaceholder,
                        {
                          width: heroWidth,
                          height: heroHeight * 0.7,
                          borderRadius: ONBOARDING_LAYOUT.heroCornerRadius,
                        },
                      ]}
                      testID={`onboarding-hero-${slide.key}`}
                    >
                      <Text style={styles.heroPlaceholderText}>
                        {index === 0
                          ? "After‑match vibes"
                          : index === 1
                          ? "Equipos y ligas"
                          : index === 2
                          ? "Agenda + chat"
                          : "Brindis del equipo"}
                      </Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[styles.content, contentAnimatedStyle]}>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.subtitle}>{slide.subtitle}</Text>
                  </Animated.View>

                  <Animated.View
                    style={[styles.pillsContainer, pillsAnimatedStyle]}
                  >
                    {slide.pills.map((pill, pillIndex) => {
                      const itemOpacity = useSharedValue(0);
                      const itemTranslateY = useSharedValue(10);

                      useEffect(() => {
                        if (slide.key !== "features") {
                          itemOpacity.value = withTiming(1, { duration: 260 });
                          itemTranslateY.value = withTiming(0, {
                            duration: 260,
                          });
                          return;
                        }
                        const delay =
                          ONBOARDING_ANIMATION.featureStaggerMs * pillIndex;
                        itemOpacity.value = withDelay(
                          delay,
                          withTiming(1, { duration: 260 }),
                        );
                        itemTranslateY.value = withDelay(
                          delay,
                          withTiming(0, { duration: 260 }),
                        );
                      }, [pillIndex]);

                      const itemStyle = useAnimatedStyle(() => ({
                        opacity: itemOpacity.value,
                        transform: [{ translateY: itemTranslateY.value }],
                      }));

                      return (
                        <Animated.View
                          key={pill}
                          style={[styles.pill, itemStyle]}
                          testID={`onboarding-pill-${slide.key}-${pillIndex}`}
                        >
                          <Text style={styles.pillText}>{pill}</Text>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>

                  {index === ONBOARDING_SLIDES.length - 1 && (
                    <View style={styles.ctaContainer}>
                      <View
                        style={styles.primaryButtonWrapper}
                        testID="onboarding-primary-cta-wrapper"
                      >
                        <Pressable
                          style={styles.primaryButton}
                          onPress={handleAdvance}
                          accessibilityRole="button"
                          accessibilityLabel="Empezar en Tercer Tiempo"
                          accessibilityHint="Finaliza el onboarding y pasa al registro o login"
                          testID="onboarding-primary-cta"
                        >
                          <Text style={styles.primaryButtonText}>Empezar</Text>
                        </Pressable>
                        <CtaShimmer />
                        <ParticleBurst visible={burstVisible} />
                      </View>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={onComplete}
                        accessibilityRole="button"
                        accessibilityLabel="Ya tengo cuenta"
                        accessibilityHint="Te lleva a la pantalla de inicio de sesión"
                        testID="onboarding-secondary-cta"
                      >
                        <Text style={styles.secondaryButtonText}>
                          Ya tengo cuenta
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>

      <View style={styles.footer}>
        <DotsIndicator
          activeIndex={activeIndex}
          total={ONBOARDING_SLIDES.length}
        />
        <LiquidProgressBar activeIndex={activeIndex} total={ONBOARDING_SLIDES.length} />
      </View>
    </View>
  );
}

type DotsIndicatorProps = {
  activeIndex: SharedValue<number>;
  total: number;
};

function DotsIndicator({ activeIndex, total }: DotsIndicatorProps) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, index) => {
        const widthAnimated = useSharedValue(8);
        const opacityAnimated = useSharedValue(0.5);

        useDerivedValue(() => {
          const isActive = activeIndex.value === index;
          widthAnimated.value = withTiming(isActive ? 32 : 8, {
            duration: ONBOARDING_ANIMATION.slideTransitionMs,
          });
          opacityAnimated.value = withTiming(isActive ? 1 : 0.5, {
            duration: ONBOARDING_ANIMATION.slideTransitionMs,
          });
        });

        const dotStyle = useAnimatedStyle(() => ({
          width: widthAnimated.value,
          opacity: opacityAnimated.value,
        }));

        return (
          <Animated.View
            key={`dot-${index}`}
            style={[styles.dot, dotStyle]}
            testID={`onboarding-dot-${index}`}
          />
        );
      })}
    </View>
  );
}

type LiquidProgressBarProps = {
  activeIndex: SharedValue<number>;
  total: number;
};

function LiquidProgressBar({ activeIndex, total }: LiquidProgressBarProps) {
  const progress = useDerivedValue(() => {
    return (activeIndex.value + 1) / total;
  });

  const fillStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const eased = p * p * (3 - 2 * p);
    const scaleX = interpolate(eased, [0, 1], [0.05, 1]);
    const translateX = interpolate(eased, [0, 1], [-80, 0]);

    return {
      transform: [{ translateX }, { scaleX }],
    };
  });

  return (
    <View style={styles.progressContainer} testID="onboarding-progress-bar">
      <View style={styles.progressTrack} />
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

type ParticleBurstProps = {
  visible: boolean;
};

function ParticleBurst({ visible }: ParticleBurstProps) {
  const PARTICLE_COUNT = 18;

  if (!visible) {
    return null;
  }

  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <SingleParticle key={`particle-${i}`} index={i} total={PARTICLE_COUNT} />
      ))}
    </>
  );
}

type SingleParticleProps = {
  index: number;
  total: number;
};

function SingleParticle({ index, total }: SingleParticleProps) {
  const angle = (Math.PI * 2 * index) / total;
  const distance = 40;
  const delay = 30 * index;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: ONBOARDING_ANIMATION.particleDurationMs }),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const radius = distance * t;
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius * 0.9;

    return {
      opacity: 1 - t,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: 0.6 + 0.6 * (1 - t) },
      ],
    };
  });

  return <Animated.View style={[styles.particle, animatedStyle]} />;
}

function CtaShimmer() {
  const offset = useSharedValue(-1);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(2, { duration: ONBOARDING_ANIMATION.shimmerCycleMs }),
      -1,
      false,
    );
  }, [offset]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * 120 }],
  }));

  return (
    <AnimatedLinearGradient
      colors={["transparent", "rgba(255,255,255,0.9)", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[StyleSheet.absoluteFill, styles.shimmer, shimmerStyle]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 24,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  gestureLayer: {
    flex: 1,
  },
  pressableOverlay: {
    flex: 1,
  },
  slidesRow: {
    flexDirection: "row",
    height: "100%",
  },
  slide: {
    flex: 1,
    paddingHorizontal: ONBOARDING_LAYOUT.horizontalPadding,
    paddingTop: ONBOARDING_LAYOUT.verticalPadding,
    paddingBottom: 40,
    justifyContent: "flex-start",
  },
  heroContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  heroPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  heroPlaceholderText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    marginTop: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  pillsContainer: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  ctaContainer: {
    marginTop: "auto",
    gap: 12,
  },
  primaryButtonWrapper: {
    position: "relative",
    borderRadius: 999,
    overflow: "hidden",
  },
  primaryButton: {
    backgroundColor: Colors.accentGold,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: Colors.accentGold,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  primaryButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 10,
  },
  dot: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  progressContainer: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.accentGold,
    borderRadius: 999,
  },
  particle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.accentGold,
    top: "50%",
    left: "50%",
  },
  shimmer: {
    opacity: 0.4,
  },
});
