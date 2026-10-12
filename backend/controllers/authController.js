import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { signToken } from "../utils/token.js";

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
  const valid = user && (await user.comparePassword(password));

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