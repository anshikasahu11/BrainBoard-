import RevokedToken from "../models/RevokedToken.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { hashToken, verifyToken } from "../utils/token.js";

// Protects a route. Reads "Authorization: Bearer <token>", verifies it, makes sure the person
// hasn't signed that token out, loads the user from the database and attaches it as req.user.
// req.token holds the token's fingerprint and end date, so signing out can end exactly this session.
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

  const tokenHash = hashToken(token);
  if (await RevokedToken.exists({ tokenHash })) {
    throw new AppError(401, "This session has ended. Please sign in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError(401, "This account no longer exists");
  }

  req.user = user;
  req.token = { hash: tokenHash, expiresAt: new Date(payload.exp * 1000) };
  next();
}