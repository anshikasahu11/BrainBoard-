import { env } from "./env.js";
import { parseOrigins } from "./production.js";

// The website addresses allowed to call the API and open live connections, from CLIENT_URL
// (several can be separated by commas). Anything that isn't an exact address stops the server
// from starting, with a plain message, in development and in production alike.
const parsed = parseOrigins(env.clientUrl);

if (parsed.problems.length > 0) {
  console.error("CLIENT_URL isn't right:");
  for (const problem of parsed.problems) console.error(`  - ${problem}`);
  process.exit(1);
}

export const allowedOrigins = parsed.origins;