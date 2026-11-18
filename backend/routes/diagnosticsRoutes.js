import crypto from "node:crypto";
import { Router } from "express";

// Only mounted while DIAGNOSTICS_KEY is set (see app.js). It tells the owner which address the server
// thinks a request came from, so TRUST_PROXY can be set correctly (see scripts/client-ip-check.mjs).
// Without the right key it answers exactly like a page that doesn't exist.
const router = Router();

const digest = (text) => crypto.createHash("sha256").update(String(text)).digest();

router.get("/client-ip", (req, res) => {
  const expected = digest(process.env.DIAGNOSTICS_KEY ?? "");
  const given = digest(req.get("x-diagnostics-key") ?? "");

  if (!crypto.timingSafeEqual(expected, given)) {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  }

  res.json({
    ip: req.ip,
    forwardedFor: req.get("x-forwarded-for") ?? null,
    trustProxy: req.app.get("trust proxy") ?? false,
  });
});

export default router;