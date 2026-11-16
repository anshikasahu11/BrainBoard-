import rateLimit from "express-rate-limit";

// Only the automated test run (tools/check-all.mjs) ever sets RATE_LIMIT_MULTIPLIER, so a whole
// run of checks doesn't use up the sign-in limits. It is IGNORED when NODE_ENV is "production",
// so it can never weaken the live site, and it can never go above 1000.
const multiplier = (() => {
  if (process.env.NODE_ENV === "production") return 1;

  const value = Number(process.env.RATE_LIMIT_MULTIPLIER);
  return Number.isFinite(value) && value >= 1 ? Math.min(value, 1000) : 1;
})();

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit: limit * multiplier,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
  });
}

// At most 30 login or register attempts per IP address every 15 minutes.
export const authLimiter = limiter(15 * 60 * 1000, 30, "Too many attempts. Please try again in a few minutes.");

// Adding members looks people up by email, so slow down anyone trying to
// guess which emails have accounts.
export const inviteLimiter = limiter(60 * 60 * 1000, 30, "Too many invitations. Please try again later.");

// A named version stores a whole copy of the document, so don't allow them in floods.
export const versionLimiter = limiter(60 * 60 * 1000, 60, "Too many versions saved. Please try again later.");

// Search runs as you type, so it gets a generous allowance. This only stops a runaway loop.
export const searchLimiter = limiter(60 * 1000, 120, "Too many searches. Please wait a moment.");

// AI requests are slow and limited by daily budgets (see ai/limits.js). This is only a flood
// guard for one network address, on top of those.
export const aiLimiter = limiter(60 * 1000, 100, "Too many AI requests. Please wait a moment.");