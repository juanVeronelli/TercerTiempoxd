import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type MedalItem = {
  id: string;
  name: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  description: string;
  howToEarn: string;
};

/**
 * Glosario de medallas: significado y cómo se gana cada una.
 * Usado en el modal "Info de Medallas" y en cualquier pantalla que muestre medallas.
 */
export const MEDALS_INFO: MedalItem[] = [
  {
    id: "mvp",
    name: "MVP",
    icon: "trophy",
    color: "#F59E0B",
    description: "Jugador más valioso del partido, elegido por votación de los participantes.",
    howToEarn: "Recibí la mayor cantidad de votos como MVP después del partido.",
  },
  {
    id: "oracle",
    name: "Oracle",
    icon: "crystal-ball",
    color: "#D4AF37",
    description: "Mejor predictor del partido en el Prode (predicciones pre-partido).",
    howToEarn: "Acertaste más preguntas del Prode que el resto en ese partido.",
  },
  {
    id: "tronco",
    name: "Tronco / Rústico",
    icon: "tree",
    color: "#EF4444",
    description: "Jugador que recibió la peor valoración del partido (anti-MVP).",
    howToEarn: "La votación del partido te ubicó como el de menor rendimiento.",
  },
  {
    id: "fantasma",
    name: "Fantasma",
    icon: "ghost",
    color: "#A78BFA",
    description: "Se lo asigna a quien no se presentó o no cumplió con el partido.",
    howToEarn: "Te marcaron como ausente o no confirmado en el partido.",
  },
  {
    id: "segundo",
    name: "2º puesto",
    icon: "medal",
    color: "#9CA3AF",
    description: "Segunda mejor valoración del partido en la votación.",
    howToEarn: "Quedaste segundo en el ranking de ratings del partido.",
  },
  {
    id: "tercero",
    name: "3º puesto",
    icon: "medal",
    color: "#B45309",
    description: "Tercera mejor valoración del partido en la votación.",
    howToEarn: "Quedaste tercero en el ranking de ratings del partido.",
  },
];

/** Mapeo honor_type (API) -> id de MEDALS_INFO */
export const HONOR_TYPE_TO_MEDAL_ID: Record<string, string> = {
  MVP: "mvp",
  TRONCO: "tronco",
  FANTASMA: "fantasma",
  ORACLE: "oracle",
  FIGURE: "segundo", // o segundo/tercero según posición
};

/**
 * Devuelve el nombre a mostrar para una medalla.
 * Si la liga tiene custom_medal_names[id], lo usa; si no, el nombre por defecto de MEDALS_INFO.
 */
export function getMedalDisplayName(
  medalId: string,
  customOverrides?: Record<string, string> | null,
): string {
  const custom = customOverrides?.[medalId]?.trim();
  if (custom) return custom;
  const item = MEDALS_INFO.find((m) => m.id === medalId);
  return item?.name ?? medalId;
}
