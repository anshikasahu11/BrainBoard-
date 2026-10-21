import http from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createSocketServer } from "./socket/index.js";

async function start() {
  try {
    await connectDB();

    const server = http.createServer(app);

    // Real-time lives on the same server and port as the REST API.
    createSocketServer(server);

    // Keep idle connections open longer than most proxies and clients expect.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    server.listen(env.port, () => {
      console.log(`API running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();