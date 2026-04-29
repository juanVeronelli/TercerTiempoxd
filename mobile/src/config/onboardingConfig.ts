import { Colors } from "../constants/Colors";

export const ONBOARDING_STORAGE_KEY = "@onboarding_viewed";

export const ONBOARDING_ANIMATION = {
  slideTransitionMs: 400,
  featureStaggerMs: 80,
  heroBreathMs: 2200,
  shimmerCycleMs: 2200,
  particleDurationMs: 520,
  coachPulseMs: 2000,
} as const;

export const ONBOARDING_LAYOUT = {
  heroHeightFactor: 0.42,
  heroMaxWidthFactor: 0.7,
  heroCornerRadius: 32,
  horizontalPadding: 24,
  verticalPadding: 32,
} as const;

export type OnboardingSlideKey = "intro" | "audience" | "features" | "cta";

export type OnboardingSlide = {
  key: OnboardingSlideKey;
  title: string;
  subtitle: string;
  pills: string[];
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: "intro",
    title: "Donde el partido continúa",
    subtitle:
      "Tercer Tiempo es el punto de encuentro digital para tu equipo: antes, durante y después del juego.",
    pills: ["Coordina partidos", "Mantén vivo el equipo", "Comparte el post‑partido"],
  },
  {
    key: "audience",
    title: "Para equipos que viven el deporte",
    subtitle:
      "Amateurs, ligas locales, grupos de amigos o clubes: si hay camiseta, hay Tercer Tiempo.",
    pills: [
      "Capitanes y organizadores",
      "Equipos amateur y ligas",
      "Grupos de amigos que juegan seguido",
    ],
  },
  {
    key: "features",
    title: "Todo el ecosistema del equipo",
    subtitle:
      "Agenda, asistencia, resultados, MVPs, chat y el after. Todo en un solo lugar.",
    pills: ["Planifica partidos", "Confirma quién va", "Celebra el post‑partido"],
  },
  {
    key: "cta",
    title: "Es hora del Tercer Tiempo",
    subtitle:
      "Únete a tu equipo, crea el tuyo y que el partido nunca termine.",
    pills: [],
  },
];

export const ONBOARDING_BACKGROUND_GRADIENTS: string[][] = [
  [Colors.background, "#162447", "#1f4068"],
  ["#120b2f", "#3b0f5f", Colors.accentGold],
  ["#021b79", Colors.primary, "#00c9ff"],
  ["#141e30", "#243b55", Colors.accentGold],
];

