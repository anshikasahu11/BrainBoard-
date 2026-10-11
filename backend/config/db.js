import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

// Some networks (ISPs, VPNs) refuse the SRV DNS lookup that mongodb+srv:// needs.
// In development only, use public DNS servers for Node's lookups.
if (env.nodeEnv === "development") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

export async function connectDB() {
  const conn = await mongoose.connect(env.mongodbUri);
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
}