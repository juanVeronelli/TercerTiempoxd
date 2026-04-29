import { Colors } from "../constants/Colors";

export type RoleConfig = {
  label: string;
  color: string;
  icon: "crown" | "shield-check" | "account";
};

/**
 * Devuelve la configuración de presentación (label, color, icono) para un rol de liga.
 * Reutilizable en Home, listados de miembros, etc.
 */
export function getRoleConfig(role: string): RoleConfig {
  const normalizedRole = role?.trim().toUpperCase();

  if (normalizedRole === "OWNER") {
    return {
      label: "CREADOR",
      color: Colors.accentGold,
      icon: "crown",
    };
  }

  if (normalizedRole === "ADMIN") {
    return {
      label: "ADMIN",
      color: Colors.primary,
      icon: "shield-check",
    };
  }

  return {
    label: "MIEMBRO",
    color: Colors.textSecondary,
    icon: "account",
  };
}
