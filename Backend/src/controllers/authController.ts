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
      return res
        .status(400)
        .json({ error: "Password y confirmPassword son obligatorios" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Las contraseñas no coinciden" });
    }

    const strongPasswordRegex =
      /^(?=.*[0-9])(?=.*[A-Za-z]).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        error:
          "La contraseña debe tener al menos 8 caracteres y contener al menos un número",
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
      return res
        .status(400)
        .json({ error: "User already exists with this email or username" });
    }

    if (mainPosition !== undefined && mainPosition !== null && mainPosition !== "" && !isValidPosition(mainPosition)) {
      return res.status(400).json({
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
      isVerified: false,
      verificationCode,
      acceptsMarketing: !!acceptsMarketing,
    };
    if (mainPosition && mainPosition.trim()) {
      createData.main_position = mainPosition.trim();
    }

    const newUser = await prisma.users.create({
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

    if (!isE2ETestEmail) {
      sendVerificationEmail(email, verificationCode).catch((err) =>
        console.error("Error enviando email de verificación:", err),
      );
    }

    return res.status(201).json({
      message: "User successfully registered",
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error("Auth Registration Error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "EMAIL_NOT_VERIFIED", message: "Debes verificar tu email antes de iniciar sesión." });
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
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during login" });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ error: "Email y código de verificación son requeridos" });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user || !user.verificationCode) {
      return res
        .status(400)
        .json({ error: "Código inválido o usuario no encontrado" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Código de verificación incorrecto" });
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
    console.error("Error verifyEmail:", error);
    return res.status(500).json({ error: "Error verificando email" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email es requerido" });
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
        console.error("Error enviando email de reset:", err),
      );
    }

    return res.json({
      message:
        "Si el email existe en nuestra base de datos, recibirás un correo con instrucciones.",
    });
  } catch (error) {
    console.error("Error forgotPassword:", error);
    return res.status(500).json({ error: "Error al iniciar recuperación" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { oldPassword, newPassword } = req.body;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, password_hash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
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
    console.error("Error changePassword:", error);
    return res.status(500).json({ error: "Error al cambiar la contraseña" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { code, token, newPassword, confirmPassword } = req.body;
    const providedCode = code ?? token;

    if (!providedCode || !newPassword) {
      return res.status(400).json({
        error: "Código y nueva contraseña son requeridos",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Las contraseñas no coinciden" });
    }

    const strongPasswordRegex =
      /^(?=.*[0-9])(?=.*[A-Za-z]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        error:
          "La contraseña debe tener al menos 8 caracteres y contener al menos un número",
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
      return res.status(400).json({ error: "Código inválido o expirado" });
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
    console.error("Error resetPassword:", error);
    return res.status(500).json({ error: "Error al restablecer la contraseña" });
  }
};
