/**
 * Sistema de diseño — Tercer Tiempo
 * Paleta centralizada con nombres semánticos (por función, no por tono).
 * Estética dark mode / deportiva.
 */
export const Colors = {
  // —— Fondos ——
  /** Fondo principal de pantallas */
  background: "#0F172A",
  /** Tarjetas, modales, contenedores elevados */
  surface: "#1F2937",
  /** Variante de superficie (headers, algunas cards) */
  surfaceElevated: "#1E293B",
  /** Interiores oscuros: inputs, contenido interno de cards */
  surfaceDark: "#111827",
  /** Superficie con opacidad (estados vacíos, dashed) */
  surfaceMuted: "rgba(31, 41, 55, 0.5)",
  /** Alias para compatibilidad */
  card: "#1E293B",
  inputBg: "#111827",

  // —— Acento principal (CTA, links, tab activo) ——
  primary: "#2648D1",
  accent: "#2648D1",
  neutral: "#1E293B",

  // —— Acento secundario / highlight (badges, iconos destacados, “activo”) ——
  /** Dorado: badges, botones secundarios, estado activo */
  accentGold: "#F59E0B",
  /** Dorado con transparencia (fondos suaves) */
  accentGoldLight: "rgba(245, 158, 11, 0.2)",
  /** Muy sutil para bordes o fondos */
  accentGoldSubtle: "rgba(245, 158, 11, 0.05)",
  /** Fondo de tarjeta/card seleccionada */
  accentGoldCardBg: "rgba(245, 158, 11, 0.08)",

  // —— Texto ——
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  /** Labels, hints, texto deshabilitado */
  textMuted: "#6B7280",
  /** Títulos de sección ligeramente más claros */
  textHeading: "#f1f5f9",
  /** Texto sobre fondos claros (ej. botón dorado) */
  textInverse: "#000000",
  /** Texto en inputs / readonly (gris claro) */
  textTertiary: "#D1D5DB",
  white: "#FFFFFF",

  // —— Bordes y divisores ——
  border: "#334155",
  /** Bordes más marcados / separadores */
  borderLight: "#374151",

  // —— Estados semánticos (form, resultados, alertas) ——
  status: {
    success: "#10B981",
    successSubtle: "rgba(16, 185, 129, 0.1)",
    successLight: "rgba(16, 185, 129, 0.2)",
    warning: "#F59E0B",
    warningSubtle: "rgba(245, 158, 11, 0.1)",
    error: "#EF4444",
    errorSubtle: "rgba(239, 68, 68, 0.1)",
    draw: "#9CA3AF",
    drawSubtle: "rgba(148, 163, 184, 0.1)",
  },
  /** Compatibilidad con componentes existentes */
  success: "#22C55E",
  error: "#F97373",

  // —— Equipos / Duelo ——
  teamA: "#3B82F6",
  teamB: "#EF4444",

  // —— Form (Victoria / Derrota / Empate) ——
  formWin: "#10B981",
  formLoss: "#EF4444",
  formDraw: "#9CA3AF",

  // —— UI específicos ——
  /** Handle de modales, elementos neutros */
  modalHandle: "#475569",
  /** Placeholders, iconos deshabilitados */
  placeholder: "#4B5563",
  /** Iconos en estados bloqueados o secundarios */
  iconMuted: "#64748b",
  /** Fondo de ad placeholders */
  adPlaceholder: "#1a1a2e",
  adPlaceholderBorder: "#4B5563",

  // —— Hero pretemporada (teal/cian) ——
  heroTealBg: "#164E63",
  heroTealBorder: "#0E7490",
  heroTealAccent: "#22D3EE",
  heroTealText: "#FFFFFF",
  heroTealTextSub: "#A5F3FC",

  // —— Hero invitación (indigo) ——
  heroInviteBg: "#1E1B4B",
  heroInviteBorder: "#4338ca",
  heroInviteTextSub: "#C7D2FE",

  // —— Podium (medallas ranking) ——
  podiumGold: "#FFD700",
  podiumSilver: "#C0C0C0",
  podiumBronze: "#CD7F32",

  // —— Trofeos / badges (perfil) ——
  trophyMvp: "#F59E0B",
  trophyMatches: "#E5E7EB",
  trophyBest: "#10B981",
  trophyLast: "#F472B6",
  trophyTronco: "#EF4444",
  trophyDuel: "#10B981",
};
