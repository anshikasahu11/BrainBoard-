import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;