import { Colors } from "../../constants/Colors";

export const PROFILE_THEME = {
  bg: Colors.background,
  cardBg: Colors.surface,
  cardBorder: Colors.borderLight,
  textPrimary: Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  accentGold: Colors.accentGold,
  accentGreen: Colors.status.success,
  accentBlue: Colors.primary,
  danger: Colors.status.error,
  trophyMvp: Colors.trophyMvp,
  trophyMatches: Colors.trophyMatches,
  trophyAvg: Colors.primary,
  trophyBest: Colors.trophyBest,
  trophyLast: Colors.trophyLast,
  trophyTronco: Colors.trophyTronco,
  trophyDuel: Colors.trophyDuel,
} as const;

export type BannerPreset = {
  id: string;
  source: any;
  name: string;
  cosmeticKey: string | null;
};

export type AvatarFramePreset = {
  id: string;
  width: number;
  color: string;
  name: string;
  cosmeticKey: string | null;
  source: number | null;
};

export type AccentColorPreset = {
  id: string;
  color: string;
  name: string;
  cosmeticKey: string | null;
};

export type ShowcaseOptionPreset = {
  id: string;
  label: string;
  icon: string;
  color: string;
  cosmeticKey: string | null;
};

export const PRESET_BANNERS: BannerPreset[] = [
  {
    id: "default_brand",
    source: require("../../../assets/banners/default_brand.png"),
    name: "Marca Tercer Tiempo",
    cosmeticKey: null,
  },
  {
    id: "default_network",
    source: require("../../../assets/banners/default_network.png"),
    name: "Red de Amigos",
    cosmeticKey: null,
  },
  {
    id: "default_ball",
    source: require("../../../assets/banners/default_ball.png"),
    name: "Balón Nocturno",
    cosmeticKey: null,
  },
  {
    id: "gladiator_banner",
    source: require("../../../assets/banners/gladiator_banner.png"),
    name: "Gladiador",
    cosmeticKey: "gladiator_banner",
  },
  {
    id: "neon_banner",
    source: require("../../../assets/banners/neon_banner.png"),
    name: "Neón Leyenda",
    cosmeticKey: "neon_banner",
  },
];

export const AVATAR_FRAMES: AvatarFramePreset[] = [
  { id: "none", width: 0, color: "transparent", name: "Sin Marco", cosmeticKey: null, source: null },
  { id: "simple", width: 2, color: Colors.borderLight, name: "Básico", cosmeticKey: null, source: null },
  { id: "gold", width: 4, color: Colors.accentGold, name: "Gold Pro", cosmeticKey: null, source: require("../../../assets/frames/gold_frame.png") },
  { id: "accent", width: 4, color: "accent", name: "Color Tema", cosmeticKey: null, source: null },
  { id: "danger_frame", width: 4, color: Colors.status.error, name: "Red Danger", cosmeticKey: "danger_frame", source: null },
  { id: "streak_frame", width: 4, color: "#F97316", name: "Racha", cosmeticKey: "streak_frame", source: null },
  { id: "mvp_frame", width: 4, color: "#EAB308", name: "MVP", cosmeticKey: "mvp_frame", source: require("../../../assets/frames/mvp_frame.png") },
  { id: "crown_frame", width: 5, color: "#CA8A04", name: "Corona", cosmeticKey: "crown_frame", source: null },
  { id: "duo_frame", width: 0, color: "transparent", name: "Dúo", cosmeticKey: "duo_frame", source: require("../../../assets/frames/duo_frame.png") },
  { id: "captain_frame", width: 4, color: Colors.teamA, name: "Capitán", cosmeticKey: "captain_frame", source: require("../../../assets/frames/captain_frame.png") },
  { id: "champion_frame", width: 0, color: "transparent", name: "Campeón", cosmeticKey: "champion_frame", source: require("../../../assets/frames/champion_frame.png") },
  { id: "phoenix_frame", width: 0, color: "transparent", name: "Fénix", cosmeticKey: "phoenix_frame", source: require("../../../assets/frames/phoenix_frame.png") },
  { id: "ghost_frame", width: 3, color: Colors.textSecondary, name: "Fantasma", cosmeticKey: "ghost_frame", source: null },
  { id: "duel_frame", width: 0, color: "transparent", name: "Rey del Duelo", cosmeticKey: "duel_frame", source: require("../../../assets/frames/duel_frame.png") },
  { id: "oracle_frame", width: 0, color: "transparent", name: "Oráculo", cosmeticKey: "oracle_frame", source: require("../../../assets/frames/oracle_frame.png") },
  { id: "neon_frame", width: 0, color: "transparent", name: "Neón", cosmeticKey: "neon_frame", source: require("../../../assets/frames/neon_frame.png") },
  { id: "all_rounder_frame", width: 0, color: "transparent", name: "Todo Terreno", cosmeticKey: "all_rounder_frame", source: require("../../../assets/frames/all_rounder_frame.png") },
  { id: "comeback_frame", width: 0, color: "transparent", name: "Remontada", cosmeticKey: "comeback_frame", source: require("../../../assets/frames/comeback_frame.png") },
];

export const ACCENT_COLORS: AccentColorPreset[] = [
  { id: "default", color: Colors.primary, name: "Azul Original", cosmeticKey: null },
  { id: "gold", color: Colors.accentGold, name: "Dorado", cosmeticKey: null },
  { id: "green", color: Colors.status.success, name: "Verde", cosmeticKey: null },
  { id: "purple", color: "#8B5CF6", name: "Violeta", cosmeticKey: null },
  { id: "white", color: Colors.white, name: "Blanco", cosmeticKey: null },
  { id: "accent_emerald", color: "#059669", name: "Esmeralda", cosmeticKey: "accent_emerald" },
  { id: "accent_crimson", color: "#DC2626", name: "Carmesí", cosmeticKey: "accent_crimson" },
  { id: "accent_neon_blue", color: "#06B6D4", name: "Neón Azul", cosmeticKey: "accent_neon_blue" },
];

export const SHOWCASE_OPTIONS: ShowcaseOptionPreset[] = [
  { id: "matches", label: "Partidos Jugados", icon: "soccer", color: PROFILE_THEME.trophyMatches, cosmeticKey: null },
  { id: "avg_hist", label: "Prom. Histórico", icon: "chart-line", color: PROFILE_THEME.trophyAvg, cosmeticKey: null },
  { id: "best_rating", label: "Mejor Nota", icon: "star", color: PROFILE_THEME.trophyBest, cosmeticKey: null },
  { id: "mvp", label: "MVP Ganados", icon: "trophy", color: PROFILE_THEME.trophyMvp, cosmeticKey: "showcase_mvp" },
  { id: "last_match", label: "Último Partido", icon: "history", color: PROFILE_THEME.trophyLast, cosmeticKey: "showcase_last_match" },
  { id: "tronco", label: "Troncos", icon: "tree", color: PROFILE_THEME.trophyTronco, cosmeticKey: "showcase_tronco" },
  { id: "duel", label: "Duelos Ganados", icon: "sword-cross", color: PROFILE_THEME.trophyDuel, cosmeticKey: "showcase_duel" },
  { id: "oracle", label: "Oracles (Prode)", icon: "crystal-ball", color: PROFILE_THEME.accentBlue, cosmeticKey: "showcase_oracle" },
];

export const LEGAL_URLS = {
  privacy: "https://tu-web-generica.com/privacy",
  terms: "https://tu-web-generica.com/terms",
} as const;
