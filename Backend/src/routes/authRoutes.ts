import { Router } from "express";
import {
  login,
  register,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";
import {
  getMe,
  getPublicUserProfile,
  getGlobalProfile,
  updateProfileData,
  uploadProfilePicture,
} from "../controllers/userProfileController.js";
import { iapUpgradeToPro } from "../controllers/iapController.js";
import { upload } from "../config/cloudinary.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimiters.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { changePasswordSchema } from "../schemas/authSchemas.js";

const router = Router();

// --- Auth puro ---
router.post("/register", register);
router.post("/login", authLimiter, login);
router.post("/verify", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post(
  "/change-password",
  authenticateToken,
  validateRequest(changePasswordSchema),
  changePassword,
);

// --- Perfil de usuario (mantienen path bajo /auth) ---
router.get("/me", authenticateToken, getMe);
router.get("/:id/public-profile", authenticateToken, getPublicUserProfile);
router.post(
  "/upload-avatar",
  authenticateToken,
  upload.single("photo"),
  uploadProfilePicture,
);
router.put("/update-profile", authenticateToken, updateProfileData);

// --- Perfil global ---
router.get("/profile/global", authenticateToken, getGlobalProfile);
router.get("/profile/global/:userId", authenticateToken, getGlobalProfile);

// --- IAP ---
router.post("/iap-upgrade", authenticateToken, iapUpgradeToPro);

export default router;
