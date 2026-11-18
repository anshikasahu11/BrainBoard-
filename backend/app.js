import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { allowedOrigins } from "./config/origins.js";
import { enforceProduction, trustProxyHops } from "./config/production.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import diagnosticsRoutes from "./routes/diagnosticsRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

// In production, refuse to start with settings that would be unsafe, with a plain list of what to
// fix. (This does nothing anywhere else.)
enforceProduction();

const app = express();

// Behind a host's proxies, every request looks like it came from the proxy, unless Express is told
// how many proxies to believe. That number decides what req.ip is, and so which visitor the rate
// limits count. Measure it with scripts/client-ip-check.mjs. Never "true": that believes anyone.
const proxy = trustProxyHops();
if (proxy.problem) {
  console.error(proxy.problem);
  process.exit(1);
}
if (proxy.hops !== false) app.set("trust proxy", proxy.hops);

app.use(helmet());
// Only your own website(s) may call the API from a browser. PUT is for notification settings.
app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" }));

// In production the log has the method, the path WITHOUT its query (searches and cursors stay out
// of the logs), the status and the time. Nobody's address or browser is logged.
morgan.token("path", (req) => String(req.originalUrl ?? req.url ?? "").split("?")[0]);
app.use(morgan(env.nodeEnv === "production" ? ":method :path :status :res[content-length] - :response-time ms" : "dev"));

// Everything under /api is private to the signed-in person, so browsers and proxies must never
// keep a copy. (On a shared computer, a cached answer could be shown to the next person.)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
// Notifications belong to a person, not a workspace, so they live at the top level.
app.use("/api/notifications", notificationRoutes);

// A hidden page for measuring TRUST_PROXY on the live server. It only exists while DIAGNOSTICS_KEY
// is set (at least 16 characters), and even then answers "not found" without the right key.
if ((process.env.DIAGNOSTICS_KEY ?? "").length >= 16) {
  app.use("/api/diagnostics", diagnosticsRoutes);
}

app.use(notFound);
app.use(errorHandler);

export default app;