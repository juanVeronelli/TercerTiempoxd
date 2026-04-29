import { Colors } from "../../constants/Colors";

export const Typography = {
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  title: {
    color: Colors.textHeading,
    fontSize: 18,
    fontWeight: "800" as const,
  },
  body: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "500" as const,
  },
} as const;

