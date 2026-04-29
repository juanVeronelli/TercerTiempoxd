import type { Request, Response } from "express";
import { prisma } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sanitizeUser } from "../utils/sanitize.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/EmailService.js";
import { isValidPosition } from "../constants/positions.js";
import { grantTtpInTx } from "../services/TtpService.js";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("authController");

/**
 * Handles the registration of a new user
 */
export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      username,
      fullName,
      mainPosition,
      acceptsMarketing,
    } = req.body;

    if (!password || !confirmPassword) {
      return sendError(res, 400, { error: "Password y confirmPassword son obligatorios" });
    }

    if (password !== confirmPassword) {
      return sendError(res, 400, { error: "Las contraseñas no coinciden" });
    }

    const strongPasswordRegex =
      /^(?=.*[0-9])(?=.*[A-Za-z]).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return sendError(res, 400, {
        error: "La contraseña debe tener al menos 8 caracteres y contener al menos un número",
      });
    }

    const userExists = await prisma.users.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        id: true,
      },
    });

    if (userExists) {
      return sendError(res, 400, { error: "User already exists with this email or username" });
    }

    if (mainPosition !== undefined && mainPosition !== null && mainPosition !== "" && !isValidPosition(mainPosition)) {
      return sendError(res, 400, {
        error: "Posición inválida. Debe ser: Arquero, Defensor, Mediocampista o Delantero.",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Magic OTP para E2E/QA: email e2e@test.com siempre recibe código 000000 y no se envía email real
    const isE2ETestEmail = email === "e2e@test.com";
    const verificationCode = isE2ETestEmail
      ? "000000"
      : (crypto.randomInt(0, 1_000_000))
          .toString()
          .padStart(6, "0");

    const createData: Record<string, unknown> = {
      email,
      username,
      full_name: fullName,
      password_hash: hashedPassword,
      plan_type: "FREE",
      // Fuente de verdad del bonus: ledger (WELCOME_BONUS). Evitamos que un default de DB sume extra.
      ttp_balance: 0,
      isVerified: false,
      verificationCode,
      acceptsMarketing: !!acceptsMarketing,
    };
    if (mainPosition && mainPosition.trim()) {
      createData.main_position = mainPosition.trim();
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: createData as Parameters<typeof prisma.users.create>[0]["data"],
        select: {
          id: true,
          username: true,
          full_name: true,
          email: true,
          profile_photo_url: true,
          banner_url: true,
          bio: true,
          main_position: true,
          accent_color: true,
          avatar_frame: true,
          plan_type: true,
        },
      });

      // Bonus de bienvenida: 500 TTP por crear cuenta (idempotente por userId).
      await grantTtpInTx(tx, {
        userId: created.id,
        amount: 500,
        reason: "WELCOME_BONUS",
        refType: "auth",
        refId: created.id,
        idempotencyKey: `ttp:welcome_bonus:${created.id}`,
      });

      return created;
    });

    if (!isE2ETestEmail) {
      sendVerificationEmail(email, verificationCode).catch((err) =>
        log.errorWithErr("Error enviando email de verificación", err, { email }),
      );
    }

    return res.status(201).json({
      message: "User successfully registered",
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    log.errorWithErr("Auth Registration Error", error, { email: (req.body as any)?.email });
    return sendError(res, 500, { error: "Internal server error" });
  }
};

export const login = async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        password_hash: true,
        profile_photo_url: true,
        banner_url: true,
        bio: true,
        main_position: true,
        accent_color: true,
        avatar_frame: true,
        plan_type: true,
        isVerified: true,
      },
    });

    if (!user) {
      return sendError(res, 401, { error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return sendError(res, 401, { error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return sendError(res, 403, {
        error: "EMAIL_NOT_VERIFIED",
        message: "Debes verificar tu email antes de iniciar sesión.",
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "30d" },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    log.errorWithErr("Login error", error, { email: (req.body as any)?.email });
    return sendError(res, 500, { error: "Internal server error during login" });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return sendError(res, 400, { error: "Email y código de verificación son requeridos" });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user || !user.verificationCode) {
      return sendError(res, 400, { error: "Código inválido o usuario no encontrado" });
    }

    if (user.verificationCode !== code) {
      return sendError(res, 400, { error: "Código de verificación incorrecto" });
    }

    const updated = await prisma.users.update({
      where: { email },
      data: {
        isVerified: true,
        verificationCode: null,
      },
    });

    const token = jwt.sign(
      { userId: updated.id },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "30d" },
    );

    return res.json({
      message: "Email verificado correctamente",
      token,
      user: sanitizeUser(updated),
    });
  } catch (error) {
    log.errorWithErr("Error verifyEmail", error, { email: (req.body as any)?.email });
    return sendError(res, 500, { error: "Error verificando email" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 400, { error: "Email es requerido" });
    }

    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.json({
        message:
          "Si el email existe en nuestra base de datos, recibirás un correo con instrucciones.",
      });
    }

    const isE2ETestEmail = email === "e2e@test.com";
    const code = isE2ETestEmail
      ? "000000"
      : crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.users.update({
      where: { email },
      data: {
        resetPasswordToken: code,
        resetPasswordExpires: expires,
      },
    });

    if (!isE2ETestEmail) {
      sendPasswordResetEmail(email, code).catch((err) =>
        log.errorWithErr("Error enviando email de reset", err, { email }),
      );
    }

    return res.json({
      message:
        "Si el email existe en nuestra base de datos, recibirás un correo con instrucciones.",
    });
  } catch (error) {
    log.errorWithErr("Error forgotPassword", error, { email: (req.body as any)?.email });
    return sendError(res, 500, { error: "Error al iniciar recuperación" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const { oldPassword, newPassword } = req.body;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, password_hash: true },
    });

    if (!user) {
      return sendError(res, 404, { error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return sendError(res, 401, {
        error: "WRONG_PASSWORD",
        message: "La contraseña actual no es correcta.",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    log.errorWithErr("Error changePassword", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al cambiar la contraseña" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { code, token, newPassword, confirmPassword } = req.body;
    const providedCode = code ?? token;

    if (!providedCode || !newPassword) {
      return sendError(res, 400, { error: "Código y nueva contraseña son requeridos" });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return sendError(res, 400, { error: "Las contraseñas no coinciden" });
    }

    const strongPasswordRegex =
      /^(?=.*[0-9])(?=.*[A-Za-z]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return sendError(res, 400, {
        error: "La contraseña debe tener al menos 8 caracteres y contener al menos un número",
      });
    }

    const user = await prisma.users.findFirst({
      where: {
        resetPasswordToken: providedCode,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return sendError(res, 400, { error: "Código inválido o expirado" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    log.errorWithErr("Error resetPassword", error, { email: (req.body as any)?.email });
    return sendError(res, 500, { error: "Error al restablecer la contraseña" });
  }
};
