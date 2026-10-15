import rateLimit from "express-rate-limit";

// At most 30 login or register attempts per IP address every 15 minutes.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Adding members looks people up by email, so slow down anyone trying to
// guess which emails have accounts.
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many invitations. Please try again later." },
});