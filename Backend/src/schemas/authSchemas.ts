import { z } from "zod";

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "oldPassword es requerido"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
