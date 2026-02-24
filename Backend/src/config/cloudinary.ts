import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Faltan las variables de entorno de Cloudinary");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "tercer-tiempo-avatars", // Nombre de la carpeta en Cloudinary
      format: "jpg", // Forzar formato
      public_id: `avatar-${Date.now()}`, // Nombre único
      transformation: [{ width: 500, height: 500, crop: "fill" }], // Redimensionar automáticamente
    };
  },
});

const leagueStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async () => ({
    folder: "tercer-tiempo-leagues",
    format: "jpg",
    public_id: `league-${Date.now()}`,
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  }),
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (mime && ALLOWED_MIMETYPES.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagen no válido. Use JPEG, PNG, GIF o WebP."));
    }
  },
});

export const uploadLeaguePhoto = multer({
  storage: leagueStorage,
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (mime && ALLOWED_MIMETYPES.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagen no válido. Use JPEG, PNG, GIF o WebP."));
    }
  },
});
