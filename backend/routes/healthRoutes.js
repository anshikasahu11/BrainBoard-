import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

const DB_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

// GET /api/health  (public: used to check the server and database are alive)
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "brainboard-api",
    time: new Date().toISOString(),
    database: DB_STATES[mongoose.connection.readyState] ?? "unknown",
  });
});

export default router;