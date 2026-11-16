import bcrypt from "bcryptjs";
import RevokedToken from "../models/RevokedToken.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { BCRYPT_ROUNDS } from "../constants/security.js";
import { disconnectSession } from "../socket/realtime.js";
import { signToken } from "../utils/token.js";

// A password check takes a few hundred milliseconds. If we only did it for emails that have an
// account, how long login takes would reveal which emails have accounts. So for an unknown email
// we check against this throwaway hash instead, which costs exactly the same. It's started when
// the server boots (and the promise is awaited on use), so even the first attempt matches.
const DUMMY_HASH = bcrypt.hash("not-a-real-password", BCRYPT_ROUNDS);

// POST /api/auth/register
export async function register(req, res) {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists");
  }

  // The password is hashed automatically by the model's pre-save hook.
  const user = await User.create({ name, email, password });

  res.status(201).json({ user, token: signToken(user.id) });
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;

  // The password field is hidden by default, so ask for it explicitly here.
  const user = await User.findOne({ email }).select("+password");

  // Exactly one password check happens either way, so the time doesn't give the email away.
  let valid = false;
  if (user) {
    valid = await user.comparePassword(password);
  } else {
    await bcrypt.compare(password, await DUMMY_HASH);
  }

  // Same message whether the email or the password was wrong.
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  res.json({ user, token: signToken(user.id) });
}

// GET /api/auth/me  (protected)
export async function me(req, res) {
  res.json({ user: req.user });
}

// POST /api/auth/logout  (protected)
// Ends THIS session's token on the server, so a copy of it stops working at once, and hangs up
// the live connections that were opened with it. Other sessions (another browser, another
// device) are not affected.
export async function logout(req, res) {
  try {
    await RevokedToken.create({
      tokenHash: req.token.hash,
      user: req.user._id,
      expiresAt: req.token.expiresAt,
    });
  } catch (error) {
    // Already ended: fine. Anything else is a real problem.
    if (error?.code !== 11000) throw error;
  }

  await disconnectSession(req.user.id, req.token.hash);

  res.status(204).end();
}