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

export const upload = multer({ storage: storage });
