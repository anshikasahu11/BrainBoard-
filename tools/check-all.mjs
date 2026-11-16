// One command that runs every check in the project, from any folder.
//
//   node tools/check-all.mjs              everything: lint, the no-server checks, and the live checks
//   node tools/check-all.mjs --quick      only the checks that need no servers and no database (about 20 seconds)
//   node tools/check-all.mjs --no-live    everything except the live checks
//   node tools/check-all.mjs --build      also builds the website (stop your frontend dev server first)
//   node tools/check-all.mjs --only=text  only checks whose name contains "text"
//
// The live checks need a backend and a database. This runner starts its OWN backend on port 5000,
// with test settings (pretend AI, no reminders, relaxed rate limits), pointed at a separate database
// whose name ends in _test, which it fills with the three test accounts and wipes afterwards.
// Your normal data is never touched. Stop your own backend first, because both use port 5000.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = path.join(ROOT, "backend");
const FRONTEND = path.join(ROOT, "frontend");
const PORT = 5000;
const API = `http://localhost:${PORT}`;
const PASSWORD = "Password123";

// Checks that need no servers and no database.
const BACKEND_UNIT = ["token-unit-check", "ai-unit-check", "ai-actions-unit-check", "notifications-unit-check", "reminders-unit-check", "search-text-check"];
const FRONTEND_UNIT = [
  "diff-check",
  "activity-text-check",
  "activity-linking-check",
  "search-highlight-check",
  "search-links-check",
  "ai-ui-check",
  "ai-tasks-ui-check",
  "notifications-ui-check",
  "notifications-page-check",
  "sign-out-check",
  "headers-check",
  "contrast-audit",
];
// Needs your real .env and the Git history, so it only runs on your own computer.
const BACKEND_LOCAL = ["git-secrets-check"];
// Needs a backend and a database: the runner starts its own.
const BACKEND_LIVE = ["activity-check", "socket-check", "versions-check", "search-check", "notifications-check", "reminders-check", "signout-check", "ai-check", "ai-actions-check"];
// Never run automatically, and why.
const MANUAL = {
  "ai-live-check": "uses your real Gemini key",
  "security-audit": "needs both servers, and the real rate limits",
  "activity-demo": "builds demo data",
  "test-db": "a helper for this runner",
};

const PEOPLE = [
  ["Anshika", "anshika@example.com"],
  ["Rahul", "rahul@example.com"],
  ["Priya", "priya@example.com"],
];

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const only = (args.find((arg) => arg.startsWith("--only=")) ?? "").slice("--only=".length).toLowerCase();

if (has("help")) {
  console.log(
    [
      "Usage: node tools/check-all.mjs [--quick] [--no-live] [--no-lint] [--build] [--only=word]",
      "",
      "  (no flags)  lint, the checks that need no servers, and the live checks",
      "  --quick     only the checks that need no servers and no database",
      "  --no-live   skip the live checks",
      "  --no-lint   skip the linter",
      "  --build     also build the website (stop your frontend dev server first)",
      "  --only=word only checks whose name contains the word",
    ].join("\n")
  );
  process.exit(0);
}

const quick = has("quick");
const inCI = process.env.CI === "true";
const wanted = (name) => !only || name.includes(only);

const plan = {
  backendUnit: BACKEND_UNIT.filter(wanted),
  frontendUnit: FRONTEND_UNIT.filter(wanted),
  local: quick || inCI ? [] : BACKEND_LOCAL.filter(wanted),
  live: quick || has("no-live") ? [] : BACKEND_LIVE.filter(wanted),
  lint: !quick && !has("no-lint") && !only,
  build: has("build") && !quick && !only,
};

// ---------- Small helpers ----------
const say = (line = "") => console.log(line);
const pad = (text, width) => String(text).padEnd(width);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lines = (text) => text.split(/\r?\n/);
const countLines = (output, word) => lines(output).filter((line) => line.startsWith(word)).length;
const tail = (text, count = 12) => lines(text).filter((line) => line.trim()).slice(-count);
const hideAddresses = (line) => line.replace(/mongodb(\+srv)?:\/\/\S+/g, "(address hidden)");
const problemLines = (output) =>
  lines(output).filter((line) => /^(FAIL|LEAKED|The check couldn't finish|The audit couldn't finish|Error)/.test(line));

const results = [];
const logParts = [];
const totals = { passes: 0, fails: 0 };

// Runs one command and collects everything it prints. Never throws.
function run(command, commandArgs, { cwd, env = process.env, timeoutMs = 240_000, shell = false } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = "";
    let timedOut = false;

    const child = spawn(command, commandArgs, { cwd, env, shell, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}\n${error.message}`, ms: Date.now() - started, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output, ms: Date.now() - started, timedOut });
    });
  });
}

function record(group, name, outcome) {
  results.push({ group, name, ...outcome });

  const label = outcome.skipped ? "SKIP" : outcome.ok ? "OK" : "FAIL";
  const detail =
    outcome.skipped ?? (outcome.checks !== undefined ? `${outcome.checks} ${outcome.checks === 1 ? "check" : "checks"}` : "");
  say(`  ${pad(label, 5)} ${pad(name, 28)} ${pad(detail, 24)} ${outcome.ms !== undefined ? seconds(outcome.ms) : ""}`);

  if (!outcome.ok && !outcome.skipped) {
    for (const line of (outcome.problems ?? []).slice(0, 8)) say(`          ${line.slice(0, 170)}`);
  }
}

async function checkScript(group, dir, name, env) {
  const file = path.join(dir, "scripts", `${name}.mjs`);
  if (!fs.existsSync(file)) return record(group, name, { ok: true, skipped: "not found, skipped" });

  const result = await run(process.execPath, [file], { cwd: dir, env });
  logParts.push(`\n##### ${group}: ${name} (exit ${result.code}${result.timedOut ? ", TIMED OUT" : ""})\n${result.output}`);

  const passes = countLines(result.output, "PASS");
  const fails = countLines(result.output, "FAIL");
  totals.passes += passes;
  totals.fails += fails;

  const ok = result.code === 0 && !result.timedOut;
  const found = problemLines(result.output);

  record(group, name, {
    ok,
    checks: passes + fails,
    ms: result.ms,
    problems: ok
      ? []
      : [...(result.timedOut ? ["Timed out after 4 minutes"] : []), ...(found.length > 0 ? found : tail(result.output, 4))].map(hideAddresses),
  });
}

async function checkCommand(group, name, command, cwd, extraEnv = {}) {
  const result = await run(command, [], { cwd, shell: true, env: { ...process.env, ...extraEnv } });
  logParts.push(`\n##### ${group}: ${name} (exit ${result.code})\n${result.output}`);

  const ok = result.code === 0 && !result.timedOut;
  record(group, name, { ok, ms: result.ms, problems: ok ? [] : tail(result.output, 12).map(hideAddresses) });
}

async function api(method, route, body) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

// ---------- The live checks ----------
async function runLive(names) {
  say("\nLive checks (on a separate test database)");

  // 1. Is port 5000 free?
  const busy = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) {
    return record("live", "preflight", {
      ok: false,
      problems: [
        `Something already answers on ${API}, probably your own backend.`,
        "The live checks start their own backend on that port, so stop yours first (Ctrl + C in its terminal),",
        "then run this again. To skip the live checks for now, add --no-live.",
      ],
    });
  }

  // 2. Which test database?
  const derived = await run(process.execPath, ["scripts/test-db.mjs", "uri"], { cwd: BACKEND, timeoutMs: 30_000 });
  const testUri = lines(derived.output).map((line) => line.trim()).filter(Boolean).pop() ?? "";
  if (derived.code !== 0 || !/^mongodb(\+srv)?:\/\//.test(testUri)) {
    return record("live", "preflight", {
      ok: false,
      problems: ["Couldn't work out the test database address.", ...tail(derived.output, 4).map(hideAddresses)],
    });
  }

  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(PORT),
    API_URL: API,
    MONGODB_URI: testUri, // the test database
    AI_PROVIDER: "mock", // pretend AI: never spends real quota
    AI_ENABLED: "true",
    GEMINI_API_KEY: "",
    REMINDERS_ENABLED: "false", // the reminder checks run the job themselves
    RATE_LIMIT_MULTIPLIER: "1000", // so a whole run doesn't hit the sign-in limits (ignored in production)
  };

  const wipe = () => run(process.execPath, ["scripts/test-db.mjs", "reset"], { cwd: BACKEND, env: testEnv, timeoutMs: 120_000 });

  let server = null;
  let serverLog = "";
  let exited = null;

  try {
    // 3. A clean start.
    const first = await wipe();
    if (first.code !== 0) {
      return record("live", "preflight", { ok: false, problems: ["Couldn't prepare the test database.", ...tail(first.output, 4).map(hideAddresses)] });
    }

    // 4. Start the test backend and wait until it's healthy.
    server = spawn(process.execPath, ["server.js"], { cwd: BACKEND, env: testEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    process.on("SIGINT", () => {
      server?.kill();
      process.exit(130);
    });
    server.stdout.on("data", (chunk) => (serverLog += chunk));
    server.stderr.on("data", (chunk) => (serverLog += chunk));
    server.on("close", (code) => (exited = code ?? 1));

    const started = Date.now();
    let healthy = false;
    while (Date.now() - started < 45_000 && exited === null) {
      try {
        const reply = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(2000) });
        if (reply.ok && (await reply.json()).database === "connected") {
          healthy = true;
          break;
        }
      } catch {
        // not up yet
      }
      await sleep(500);
    }

    if (!healthy) {
      return record("live", "test backend", {
        ok: false,
        problems: ["The test backend didn't start.", ...tail(serverLog, 8).map(hideAddresses)],
      });
    }
    record("live", "test backend", { ok: true, ms: Date.now() - started });

    // 5. The three test accounts every live check signs in as.
    for (const [name, email] of PEOPLE) {
      const reply = await api("POST", "/api/auth/register", { name, email, password: PASSWORD });
      if (![201, 409].includes(reply.status)) {
        return record("live", "test accounts", {
          ok: false,
          problems: [`Couldn't create ${email} (status ${reply.status}: ${reply.data?.message})`],
        });
      }
    }

    // 6. The checks themselves.
    for (const name of names) await checkScript("live", BACKEND, name, testEnv);
  } finally {
    server?.kill();
    await sleep(300);
    await wipe();
    logParts.push(`\n##### test backend log\n${serverLog}`);
  }
}

// ---------- Go ----------
async function main() {
  const started = Date.now();

  say("BrainBoard: running the checks");
  say(`(${quick ? "quick mode: no servers, no database" : only ? `only checks containing "${only}"` : "everything"})`);

  const known = new Set([...BACKEND_UNIT, ...BACKEND_LOCAL, ...BACKEND_LIVE, ...FRONTEND_UNIT, ...Object.keys(MANUAL)]);
  const unlisted = [];
  for (const [folder, dir] of [["backend", BACKEND], ["frontend", FRONTEND]]) {
    const scriptsDir = path.join(dir, "scripts");
    if (!fs.existsSync(scriptsDir)) continue;
    for (const file of fs.readdirSync(scriptsDir)) {
      if (file.endsWith(".mjs") && !known.has(file.slice(0, -4))) unlisted.push(`${folder}/scripts/${file}`);
    }
  }

  if (plan.backendUnit.length + plan.frontendUnit.length > 0) {
    say("\nChecks that need no servers");
    for (const name of plan.backendUnit) await checkScript("backend", BACKEND, name, process.env);
    for (const name of plan.frontendUnit) await checkScript("frontend", FRONTEND, name, process.env);
  }

  if (plan.local.length > 0) {
    say("\nChecks that need your real settings");
    for (const name of plan.local) await checkScript("local", BACKEND, name, process.env);
  }

  if (plan.lint) {
    say("\nLinter");
    await checkCommand("lint", "lint (frontend)", "npm run lint", FRONTEND);
  }

  if (plan.live.length > 0) await runLive(plan.live);

  if (plan.build) {
    say("\nProduction build");
    await checkCommand("build", "build (frontend)", "npm run build", FRONTEND, { NEXT_TELEMETRY_DISABLED: "1" });
  }

  // ---------- Summary ----------
  const failed = results.filter((entry) => !entry.ok);
  const skipped = results.filter((entry) => entry.skipped);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(os.tmpdir(), `brainboard-checks-${stamp}.log`);
  fs.writeFileSync(logFile, logParts.join("\n"));

  say("\n============================================================");
  if (unlisted.length > 0) {
    say(`NOTE  ${unlisted.length} script(s) aren't in any list, so they were not run: ${unlisted.join(", ")}`);
  }
  say(`Steps: ${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  say(`Individual checks counted: ${totals.passes} passed, ${totals.fails} failed`);
  say(`Time: ${Math.floor((Date.now() - started) / 60000)}m ${Math.round(((Date.now() - started) % 60000) / 1000)}s`);
  say(`Full log (every line each check printed): ${logFile}`);

  if (failed.length > 0) {
    say("\nWhat failed:");
    for (const entry of failed) {
      say(`  ${entry.group}/${entry.name}`);
      for (const line of (entry.problems ?? []).slice(0, 8)) say(`      ${line.slice(0, 170)}`);
    }
    say("\nSOME CHECKS FAILED");
  } else {
    say("\nALL CHECKS PASSED");
  }
  say("============================================================");

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`The runner itself failed: ${error.message}`);
  process.exit(1);
});