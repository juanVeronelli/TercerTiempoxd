import type { users } from "../generated/client/index.js";

/**
 * Devuelve una versión segura del usuario para exponer vía API.
 * Nunca incluye password_hash ni campos internos sensibles.
 */
export function sanitizeUser(user: Partial<users> | null | undefined) {
  if (!user) return null;

  // Devolvemos tanto aliases seguros (camelCase) como los campos originales
  // que el frontend ya usa (snake_case). Nunca incluimos password_hash ni datos sensibles.
  return {
    // Aliases amigables
    id: user.id ?? undefined,
    username: user.username ?? undefined,
    fullName: user.full_name ?? undefined,
    email: user.email ?? undefined,
    photo: user.profile_photo_url ?? undefined,
    bannerUrl: user.banner_url ?? undefined,
    bio: user.bio ?? undefined,
    mainPosition: user.main_position ?? undefined,
    accentColor: user.accent_color ?? undefined,
    avatarFrame: user.avatar_frame ?? undefined,
    planType: user.plan_type ?? undefined,

    // Campos originales que ya consume el mobile
    full_name: user.full_name ?? undefined,
    profile_photo_url: user.profile_photo_url ?? undefined,
    banner_url: user.banner_url ?? undefined,
    main_position: user.main_position ?? undefined,
    accent_color: user.accent_color ?? undefined,
    avatar_frame: user.avatar_frame ?? undefined,
    plan_type: user.plan_type ?? undefined,
    showcase_items: (user as any).showcase_items ?? undefined,
    notifications_enabled: (user as any).notifications_enabled ?? true,
    notificationsEnabled: (user as any).notifications_enabled ?? true,
  } as any;
}

