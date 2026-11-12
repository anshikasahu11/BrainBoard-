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

// A named version stores a whole copy of the document, so don't allow them in floods.
export const versionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many versions saved. Please try again later." },
});

// Search runs as you type, so it gets a generous allowance. This only stops a runaway loop.
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many searches. Please wait a moment." },
});