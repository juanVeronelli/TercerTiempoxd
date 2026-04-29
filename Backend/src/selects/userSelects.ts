import type { Prisma } from "../generated/client/index.js";

export const selectUserPublicLite = {
  id: true,
  full_name: true,
  username: true,
  profile_photo_url: true,
  avatar_frame: true,
  accent_color: true,
} satisfies Prisma.usersSelect;

export const selectUserPublicProfile = {
  id: true,
  username: true,
  email: true, // usado por el front como fallback
  profile_photo_url: true,
  banner_url: true,
  bio: true,
  main_position: true,
  plan_type: true,
} satisfies Prisma.usersSelect;

