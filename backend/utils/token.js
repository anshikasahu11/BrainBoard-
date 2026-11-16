import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

// "sub" (subject) is the standard JWT field for "who this token is about".
// "jti" (token id) is a random number that belongs to this ONE token. Without it, two tokens
// made for the same person in the same second would be identical, byte for byte, and signing one
// out would end the other as well.
export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
    jwtid: crypto.randomUUID(),
  });
}

// Throws if the token is tampered with, malformed or expired. It also insists on the shape of
// a token WE made: a plain 24-character id as the subject, and an expiry. Without that, a
// token with an odd subject could crash a lookup, or even be treated as a database query.
export function verifyToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });

  if (typeof payload.sub !== "string" || !OBJECT_ID.test(payload.sub)) {
    throw new jwt.JsonWebTokenError("invalid subject");
  }
  if (typeof payload.exp !== "number") {
    throw new jwt.JsonWebTokenError("token has no expiry");
  }
  // Tokens made before token numbers existed have none, and stay valid, so nobody is signed out
  // by the update. If there is one, it must be plain text.
  if (payload.jti !== undefined && (typeof payload.jti !== "string" || payload.jti.length > 64)) {
    throw new jwt.JsonWebTokenError("invalid token id");
  }
  return payload;
}

// A fingerprint of a token, used to remember that it has been ended without storing the token itself.
export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");