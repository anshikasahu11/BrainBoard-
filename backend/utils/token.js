import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// "sub" (subject) is the standard JWT field for "who this token is about".
export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
  });
}

// Throws if the token is tampered with, malformed or expired.
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
}