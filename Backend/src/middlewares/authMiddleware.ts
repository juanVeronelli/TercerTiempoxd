import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Define the shape of the data stored inside the JWT
interface UserPayload {
  userId: string;
  email: string;
  username: string;
}

// Extend the Express Request interface to include the user property
// This prevents TypeScript errors when accessing req.user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Retrieve the Authorization header
  const authHeader = req.headers["authorization"];

  // The header format is usually "Bearer <token>", so we split it to get the token part
  const token = authHeader && authHeader.split(" ")[1];

  // 2. If no token is found, deny access (401 Unauthorized)
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // 3. Verify the token using the secret key
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
    return res.status(500).json({ error: "Internal Server Error" });
  }

  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    // 4. Attach the user payload to the request object
    // This allows subsequent controllers (like getMe) to access user data
    req.user = user as UserPayload;

    // Proceed to the next middleware or controller
    next();
  });
};
