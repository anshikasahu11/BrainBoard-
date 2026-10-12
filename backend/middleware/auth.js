import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { verifyToken } from "../utils/token.js";

// Protects a route. Reads "Authorization: Bearer <token>", verifies it,
// loads the user from the database and attaches it as req.user.
export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Authentication required");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError(401, "This account no longer exists");
  }

  req.user = user;
  next();
}