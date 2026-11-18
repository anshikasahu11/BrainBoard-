import mongoose from "mongoose";

let registered = false;

// Makes the server shut down politely when the host asks it to stop (a redeploy, or going to
// sleep): stop accepting visitors, hang up the live connections, close the database, then exit.
// If that takes too long, it exits anyway. Call it once, with the Socket.IO server (closing it also
// closes the HTTP server it is attached to).
export function registerShutdown({ io, timeoutMs = 10_000 }) {
  if (registered) return;
  registered = true;

  let stopping = false;

  async function stop(signal) {
    if (stopping) return;
    stopping = true;

    console.log(`${signal} received: shutting down...`);

    // If something hangs, don't hang forever.
    setTimeout(() => {
      console.error("Shutdown took too long, so the server is exiting anyway.");
      process.exit(1);
    }, timeoutMs).unref();

    try {
      await new Promise((resolve) => {
        try {
          io.close(() => resolve());
        } catch {
          resolve();
        }
      });
      await mongoose.disconnect();
      console.log("Shutdown complete.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown failed:", error.message);
      process.exit(1);
    }
  }

  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}