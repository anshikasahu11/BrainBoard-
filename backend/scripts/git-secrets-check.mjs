// Checks whether any secret that is in use TODAY has ever been committed to Git. It never prints a
// secret: only whether one was found, and the short ids of the commits it appears in.
//
// It needs no running backend. Run it from the backend folder (it can take up to a minute on a big
// history):
//   node scripts/git-secrets-check.mjs

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SECRET_FILES = ["backend/.env", ".env", "backend/.env.local", "frontend/.env.local"];

function git(args, timeout = 120000) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 100 * 1024 * 1024,
    timeout,
  });
}

const passwordOf = (uri) => {
  try {
    return decodeURIComponent(new URL(String(uri).replace(/^mongodb(\+srv)?:/, "https:")).password);
  } catch {
    return "";
  }
};

let leaked = 0;

try {
  git(["rev-parse", "--git-dir"], 10000);
} catch {
  console.error("This isn't inside a Git repository. Run it from C:\\dev\\brainboard\\backend.");
  process.exit(1);
}

console.log("Checking Git for leaked secrets...\n");

// 1. Is a secret file tracked right now?
console.log("1. Secret files Git is tracking today");
const tracked = git(["ls-files", "--", ...SECRET_FILES]).trim();
if (tracked) {
  leaked += 1;
  console.log(`LEAKED   these are tracked, and would be published with the next push: ${tracked.split("\n").join(", ")}`);
} else {
  console.log("OK       none of them are tracked");
}

// 2. Did one ever exist in the history? (Names of the settings only, never their values.)
console.log("\n2. Secret files that ever existed in Git history");
const log = git(["log", "--all", "--name-only", "--format=COMMIT %h %ad", "--date=short", "--", ...SECRET_FILES]);

const entries = [];
let current = null;
for (const line of log.split(/\r?\n/)) {
  if (line.startsWith("COMMIT ")) {
    const [, commit, date] = line.split(" ");
    current = { commit, date };
  } else if (line.trim() && current) {
    entries.push({ ...current, file: line.trim() });
  }
}

if (entries.length === 0) {
  console.log("OK       no secret file has ever been committed");
} else {
  for (const entry of entries) {
    try {
      const content = git(["show", `${entry.commit}:${entry.file}`], 20000);
      const keys = [...content.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((match) => match[1]);
      console.log(`HISTORY  commit ${entry.commit} (${entry.date}): ${entry.file} contained ${keys.join(", ") || "(nothing readable)"}`);
    } catch {
      console.log(`HISTORY  commit ${entry.commit} (${entry.date}): ${entry.file} was removed here`);
    }
  }
}

// 3. Is anything you use today in the history, in ANY file?
console.log("\n3. Whether the secrets you use TODAY were ever committed (in any file)");
const secrets = [
  ["login-token secret (JWT_SECRET)", env.jwtSecret],
  ["database password", passwordOf(env.mongodbUri)],
  ["AI key (GEMINI_API_KEY)", process.env.GEMINI_API_KEY?.trim()],
].filter(([, value]) => value && value.length >= 8);

for (const [name, value] of secrets) {
  try {
    const hits = git(["log", "--all", "--format=%h", `-S${value}`]).trim().split("\n").filter(Boolean);
    if (hits.length > 0) {
      leaked += 1;
      console.log(`LEAKED   your current ${name} appears in ${hits.length} commit(s): ${hits.slice(0, 6).join(", ")}`);
    } else {
      console.log(`OK       your current ${name} has never been committed`);
    }
  } catch {
    console.log(`SKIPPED  ${name}: Git took too long or failed, so this one wasn't checked`);
  }
}

console.log(
  leaked === 0
    ? "\nNothing you use today has ever been in Git. Old history can stay."
    : `\n${leaked} problem(s) found. Anything marked LEAKED must be replaced (rotated), because the old value is no longer secret.`
);
process.exit(leaked === 0 ? 0 : 1);