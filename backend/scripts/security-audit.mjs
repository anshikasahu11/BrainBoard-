// A security audit of your running app, done the way a stranger would do it: from outside, over
// HTTP. It makes 3 throwaway accounts and 2 small workspaces, tries to break in, checks that nothing
// leaked, and deletes the workspaces at the end. It never changes your app's code.
//
// FAIL lines are findings (with a severity and why they matter). NOTE lines are trade-offs to decide on.
// It never prints a secret.
//
// Restart the backend before running it (it uses about 17 of the 30 sign-in attempts per 15 minutes),
// and run it from the backend folder:
//   node scripts/security-audit.mjs

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import { env } from "../config/env.js";

const API = (process.env.API_URL || "http://localhost:5000").replace(/\/$/, "");
const WEB = (process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
const EVIL = "https://evil.example";
const PASSWORD = "Audit12345";
const stamp = Date.now();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// This script attacks. It only ever does that to your own computer.
const isLocal = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
if (!(isLocal(API) && isLocal(WEB)) && !process.argv.includes("--allow-remote")) {
  console.error(`This audit attacks the app it is pointed at, so it only runs against your own computer.\n${API} and ${WEB} aren't local. If you really mean it, add --allow-remote.`);
  process.exit(1);
}

let passed = 0;
let failed = 0;
let noted = 0;
const errorTexts = []; // every error response, scanned for leaks at the end

const section = (title) => console.log(`\n=== ${title} ===`);
const pass = (area, text) => {
  passed += 1;
  console.log(`PASS  ${area}: ${text}`);
};
const fail = (severity, area, text, why = "") => {
  failed += 1;
  console.log(`FAIL  [${severity}] ${area}: ${text}${why ? `. Why it matters: ${why}` : ""}`);
};
const note = (area, text) => {
  noted += 1;
  console.log(`NOTE  ${area}: ${text}`);
};
// good: what to say when it's fine. bad: what to say when it isn't.
function check(ok, severity, area, good, bad, why) {
  if (ok) pass(area, good);
  else fail(severity, area, bad, why);
  return ok;
}

async function http(method, url, { token, body, raw, headers = {} } = {}) {
  const started = performance.now();
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (response.status >= 400) errorTexts.push({ method, url, status: response.status, text });

  return { status: response.status, headers: response.headers, data, text, ms: performance.now() - started };
}
const api = (method, path_, options) => http(method, `${API}${path_}`, options);

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function person(label) {
  const email = `audit-${label}-${stamp}@example.com`;
  const registered = await api("POST", "/api/auth/register", { body: { name: `Audit ${label}`, email, password: PASSWORD } });
  if (registered.status !== 201) {
    throw new Error(`Couldn't create the audit person "${label}" (status ${registered.status}: ${registered.data?.message}). If it says "Too many attempts", restart the backend to reset the limit and try again.`);
  }
  return { email, id: registered.data.user.id, token: registered.data.token };
}

// ----- Building login tokens by hand, to see which ones the server accepts -----
const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const HASHES = { HS256: "sha256", HS512: "sha512" };

function signRaw(payload, { alg = "HS256", secret = env.jwtSecret } = {}) {
  const input = `${b64({ alg, typ: "JWT" })}.${b64(payload)}`;
  if (alg === "none") return `${input}.`;
  return `${input}.${crypto.createHmac(HASHES[alg], secret).update(input).digest("base64url")}`;
}

// ----- Requests used by the isolation sweeps -----
const r = (token, method, path_, label = path_, body) => ({ token, method, path: path_, label, body });

async function sweep(area, severity, expected, requests, good, bad, why) {
  const wrong = [];
  for (const request of requests) {
    const res = await api(request.method, request.path, { token: request.token, body: request.body });
    if (!expected.includes(res.status)) wrong.push(`${request.method} ${request.label} gave ${res.status}`);
  }
  check(
    wrong.length === 0,
    severity,
    area,
    `${good} (${requests.length} requests)`,
    `${wrong.length} of ${requests.length} requests ${bad}: ${wrong.slice(0, 6).join("; ")}`,
    why
  );
}

// ----- Git history: did a secret ever leak? -----
function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 20 * 1024 * 1024 });
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const passwordOf = (uri) => {
  try {
    return decodeURIComponent(new URL(String(uri).replace(/^mongodb(\+srv)?:/, "https:")).password);
  } catch {
    return "";
  }
};

async function main() {
  console.log(`Security audit of ${API} (frontend: ${WEB})`);

  // ---------- Is it there? ----------
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) {
    console.error("\nThe backend isn't answering. Start it with `npm run dev` in the backend folder, then run this again.");
    process.exit(1);
  }

  const workspaces = []; // to clean up: { id, token }

  try {
    // ================= Headers =================
    section("Headers on the API");
    const header = (res, name) => res.headers.get(name) ?? "";

    check(!header(health, "x-powered-by"), "LOW", "Headers", "the server doesn't announce which framework it runs", "it announces its framework (X-Powered-By)", "attackers use that to pick exploits");
    check(header(health, "x-content-type-options").toLowerCase() === "nosniff", "MEDIUM", "Headers", "browsers are told not to guess content types (nosniff)", "the nosniff header is missing", "a browser could treat a response as something it isn't");
    check(header(health, "content-type").includes("application/json"), "MEDIUM", "Headers", "API answers are labelled as JSON", "API answers aren't labelled as JSON", "an answer labelled as HTML could run as a page");
    check(Boolean(header(health, "x-frame-options")) || /frame-ancestors/i.test(header(health, "content-security-policy")), "LOW", "Headers", "the API can't be shown inside another site's frame", "nothing stops the API being framed", "clickjacking");
    check(Boolean(header(health, "referrer-policy")), "LOW", "Headers", "a referrer policy is set", "no referrer policy", "full addresses can leak to other sites");
    check(Boolean(header(health, "strict-transport-security")), "LOW", "Headers", "HSTS is switched on (it matters once the site is on HTTPS)", "no HSTS header", "once deployed, browsers should refuse plain HTTP");

    // ================= CORS =================
    section("CORS: which websites may call the API");
    const preflight = (origin) =>
      api("OPTIONS", "/api/workspaces", {
        headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type,x-socket-id" },
      });

    const good = await preflight(env.clientUrl);
    const allowed = header(good, "access-control-allow-methods").toUpperCase();
    check(header(good, "access-control-allow-origin") === env.clientUrl, "HIGH", "CORS", `your own frontend (${env.clientUrl}) is allowed`, "your own frontend is not allowed", "the app wouldn't work");
    check(["PUT", "PATCH", "DELETE"].every((method) => allowed.includes(method)), "MEDIUM", "CORS", "PUT, PATCH and DELETE are allowed for your frontend", `some methods the app needs are missing (${allowed || "none"})`, "parts of the app would fail in a browser");

    const evil = await preflight(EVIL);
    check(!header(evil, "access-control-allow-origin"), "CRITICAL", "CORS", "another website is NOT allowed to call the API", `a stranger's website (${EVIL}) is allowed (${header(evil, "access-control-allow-origin")})`, "any website could make a signed-in visitor's browser use their account");
    check(header(await preflight("null"), "access-control-allow-origin") === "", "HIGH", "CORS", "the origin 'null' (local files, sandboxes) is not allowed", "the origin 'null' is allowed", "sandboxed pages and local files could call the API");
    const evilGet = await api("GET", "/api/health", { headers: { Origin: EVIL } });
    check(header(evilGet, "access-control-allow-origin") === "" && header(evilGet, "access-control-allow-credentials") !== "true", "HIGH", "CORS", "a normal request from another site gets no permission and no credentials flag", "a request from another site is given permission", "cross-site reads");
    check(header(good, "access-control-allow-origin") !== "*", "CRITICAL", "CORS", "the API never answers with a wildcard origin", "the API allows every origin (*)", "any website could call it");

    // ================= Setting up =================
    section("Setting up (3 throwaway people, 2 workspaces)");
    const A = await person("owner");
    const M = await person("member");
    const X = await person("outsider");

    const WA = (await api("POST", "/api/workspaces", { token: A.token, body: { name: "Audit Space" } })).data.workspace.id;
    const WX = (await api("POST", "/api/workspaces", { token: X.token, body: { name: "Audit Other" } })).data.workspace.id;
    workspaces.push({ id: WA, token: A.token }, { id: WX, token: X.token });

    const wa = `/api/workspaces/${WA}`;
    const wx = `/api/workspaces/${WX}`;

    await api("POST", `${wa}/members`, { token: A.token, body: { email: M.email, role: "member" } });
    const doc = (await api("POST", `${wa}/documents`, { token: A.token, body: { title: "Audit doc" } })).data?.document;
    const task = (await api("POST", `${wa}/tasks`, { token: A.token, body: { title: "Audit task" } })).data?.task;
    const snippet = (await api("POST", `${wa}/snippets`, { token: A.token, body: { title: "Audit snippet", code: "const a = 1;", language: "javascript" } })).data?.snippet;
    if (!doc || !task || !snippet) throw new Error("Couldn't build the audit workspace (a document, task or snippet wasn't created).");
    console.log("Ready: 3 people, 2 workspaces, 1 document, 1 task, 1 snippet");

    // ================= Tokens =================
    section("Login tokens");
    const me = await api("GET", "/api/auth/me", { token: A.token });
    check(me.status === 200, "HIGH", "Tokens", "a real token works", "a real token doesn't work", "nobody could sign in");

    const refusals = [
      ["no token at all", {}],
      ["a made-up token", { Authorization: "Bearer not.a.token" }],
      ["an empty bearer token", { Authorization: "Bearer " }],
      ["the wrong kind of credential (Basic)", { Authorization: "Basic YWRtaW46YWRtaW4=" }],
    ];
    const notRefused = [];
    for (const [label, headers] of refusals) {
      const res = await api("GET", "/api/auth/me", { headers });
      if (res.status !== 401) notRefused.push(`${label} gave ${res.status}`);
    }
    check(notRefused.length === 0, "CRITICAL", "Tokens", "missing, made-up and wrong-kind credentials are all refused (401)", `these were not refused: ${notRefused.join("; ")}`, "people could get in without signing in");

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const forged = [
      ["an expired token", signRaw({ sub: A.id, exp: Math.floor(Date.now() / 1000) - 60 })],
      ["a token signed with the wrong secret", signRaw({ sub: A.id, exp }, { secret: "not-the-real-secret-at-all-0123456789" })],
      ["a token using a different algorithm (HS512)", signRaw({ sub: A.id, exp }, { alg: "HS512" })],
      ["a token with no signature (alg none)", signRaw({ sub: A.id, exp }, { alg: "none" })],
      ["a token for a person who doesn't exist", signRaw({ sub: crypto.randomBytes(12).toString("hex"), exp })],
      ["a correctly signed token with a malformed id", signRaw({ sub: "123", exp })],
    ];
    const accepted = [];
    const crashed = [];
    for (const [label, token] of forged) {
      const res = await api("GET", "/api/auth/me", { token });
      if (res.status === 200) accepted.push(label);
      else if (res.status >= 500) crashed.push(label);
    }
    check(accepted.length === 0, "CRITICAL", "Tokens", "expired, forged, unsigned and wrong-algorithm tokens are all refused", `these were ACCEPTED: ${accepted.join("; ")}`, "anyone could sign in as anyone");
    check(crashed.length === 0, "LOW", "Tokens", "odd tokens are refused cleanly (never a server error)", `these made the server error (500): ${crashed.join("; ")}`, "a crash instead of a refusal, and a sign that input isn't checked");

    // A correctly signed token whose "sub" is a query object instead of an id. It needs the secret to forge,
    // but a server that trusts it would sign in as the first user in the database.
    const objectSub = await api("GET", "/api/auth/me", { token: signRaw({ sub: { $ne: null }, exp }) });
    check(objectSub.status === 401, "LOW", "Tokens", "a token whose subject isn't a plain id is refused", `a token whose subject is a query object was answered with ${objectSub.status}`, "if the secret ever leaked, this would sign in as an arbitrary person. Checking the subject is cheap defence in depth");

    const login = await api("POST", "/api/auth/login", { body: { email: A.email, password: PASSWORD } });
    const claims = JSON.parse(Buffer.from(String(login.data?.token).split(".")[1] ?? "e30", "base64url").toString("utf8"));
    check(Object.keys(claims).every((key) => ["sub", "iat", "exp"].includes(key)), "LOW", "Tokens", "a token carries only an id and its dates (no email or role)", `a token carries extra claims: ${Object.keys(claims).join(", ")}`, "anyone holding a token can read what's in it");

    const lifetimeHours = (claims.exp - claims.iat) / 3600;
    check(lifetimeHours <= 24, "MEDIUM", "Tokens", `login tokens last ${lifetimeHours} hours`, `login tokens last ${Math.round(lifetimeHours / 24)} days`, "a stolen or copied token works that whole time");

    const logout = await api("POST", "/api/auth/logout", { token: A.token });
    check(logout.status !== 404, "MEDIUM", "Tokens", "the server can cancel a token (signing out ends it)", "there is no way to cancel a token: signing out only makes this browser forget it", "a copied token keeps working until it expires, even after the owner signs out");

    // ================= Accounts and passwords =================
    section("Accounts and passwords");
    check(![me, login].some((res) => /\$2[aby]\$|"password"/i.test(res.text)), "CRITICAL", "Passwords", "no password or password hash appears in sign-in or profile answers", "a password or hash appears in an answer", "hashes can be cracked offline");

    let weakRefused = true;
    for (const weak of ["12345678", "password", "Ab1"]) {
      const res = await api("POST", "/api/auth/register", { body: { name: "Weak Test", email: `weak-${stamp}-${weak.length}@example.com`, password: weak } });
      if (res.status !== 400) weakRefused = false;
    }
    check(weakRefused, "MEDIUM", "Passwords", "weak passwords (no letter, no number, too short) are refused", "a weak password was accepted", "easy to guess");

    const mass = await api("POST", "/api/auth/register", {
      body: { name: "Mass User", email: `mass-${stamp}@example.com`, password: PASSWORD, role: "admin", isAdmin: true, id: "0".repeat(24), _id: "0".repeat(24) },
    });
    check(mass.status === 201 && mass.data.user.id !== "0".repeat(24) && !("role" in mass.data.user) && !("isAdmin" in mass.data.user), "HIGH", "Accounts", "sign-up ignores fields like role, isAdmin and id", "sign-up accepted fields it shouldn't", "someone could make themselves an admin or take another id");

    const known = [];
    const unknown = [];
    let firstKnown = null;
    let firstUnknown = null;
    for (let i = 0; i < 3; i += 1) {
      const a = await api("POST", "/api/auth/login", { body: { email: A.email, password: "Wrong12345" } });
      const b = await api("POST", "/api/auth/login", { body: { email: `nobody-${stamp}-${i}@example.com`, password: "Wrong12345" } });
      known.push(a.ms);
      unknown.push(b.ms);
      firstKnown ??= a;
      firstUnknown ??= b;
    }
    check(firstKnown.status === 401 && firstUnknown.status === 401 && firstKnown.data?.message === firstUnknown.data?.message, "MEDIUM", "Accounts", "a wrong password and an unknown email get exactly the same answer", "a wrong password and an unknown email get different answers", "an attacker can learn which emails have accounts");

    const gap = median(known) - median(unknown);
    check(gap < 50, "MEDIUM", "Accounts", `login takes the same time whether or not the email exists (difference ${Math.round(gap)} ms)`, `login is ${Math.round(gap)} ms slower for emails that have an account (${Math.round(median(known))} ms against ${Math.round(median(unknown))} ms)`, "the same answer isn't enough if the time gives it away: an attacker can still tell which emails have accounts");

    const injection = [
      await api("POST", "/api/auth/login", { body: { email: { $gt: "" }, password: "x" } }),
      await api("POST", "/api/auth/login", { body: { email: A.email, password: { $ne: "" } } }),
    ];
    check(injection.every((res) => res.status === 400), "CRITICAL", "Accounts", "database operators in the sign-in form are refused (400)", `a database operator in the sign-in form got ${injection.map((res) => res.status).join(", ")}`, "NoSQL injection can skip the password check");

    const duplicate = await api("POST", "/api/auth/register", { body: { name: "Dup", email: A.email, password: PASSWORD } });
    if (duplicate.status === 409) {
      note("Accounts", "signing up with an email that already has an account says so (409). That lets someone check whether a person has an account. It's rate limited, and hiding it fully needs email verification. A known trade-off to decide on.");
    } else {
      pass("Accounts", "signing up with an existing email doesn't reveal that it exists");
    }

    const policy = /^(\d+);w=(\d+)/.exec(header(login, "ratelimit-policy"));
    if (policy) {
      check(Number(policy[1]) <= 50, "MEDIUM", "Limits", `sign-in and sign-up are limited to ${policy[1]} attempts per ${Math.round(Number(policy[2]) / 60)} minutes per address`, `sign-in is allowed ${policy[1]} attempts per ${Math.round(Number(policy[2]) / 60)} minutes`, "attackers can try too many passwords");
    } else {
      fail("MEDIUM", "Limits", "sign-in doesn't report a rate limit", "without a limit, passwords can be guessed endlessly");
    }

    // ================= Isolation =================
    section("Isolation: strangers and plain members");

    const base = (id, token) => [
      r(token, "GET", id, "/workspace"),
      r(token, "PATCH", id, "PATCH /workspace", { name: "Hacked" }),
      r(token, "DELETE", id, "DELETE /workspace"),
    ];
    const itemRoutes = (root, token) => [
      r(token, "GET", `${root}/documents/${doc.id}`, "/documents/:id"),
      r(token, "PATCH", `${root}/documents/${doc.id}`, "/documents/:id", { baseRevision: 0, title: "pwned" }),
      r(token, "DELETE", `${root}/documents/${doc.id}`, "/documents/:id"),
      r(token, "GET", `${root}/tasks/${task.id}`, "/tasks/:id"),
      r(token, "PATCH", `${root}/tasks/${task.id}`, "/tasks/:id", { title: "pwned" }),
      r(token, "PATCH", `${root}/tasks/${task.id}/move`, "/tasks/:id/move", { status: "done" }),
      r(token, "DELETE", `${root}/tasks/${task.id}`, "/tasks/:id"),
      r(token, "GET", `${root}/snippets/${snippet.id}`, "/snippets/:id"),
      r(token, "PATCH", `${root}/snippets/${snippet.id}`, "/snippets/:id", { baseRevision: 0, title: "pwned" }),
      r(token, "DELETE", `${root}/snippets/${snippet.id}`, "/snippets/:id"),
      r(token, "POST", `${root}/ai/summarize-document`, "/ai/summarize-document", { documentId: doc.id }),
    ];

    const outsider = [
      ...base(wa, X.token),
      r(X.token, "GET", `${wa}/members`, "/members"),
      r(X.token, "POST", `${wa}/members`, "POST /members", { email: M.email, role: "member" }),
      r(X.token, "PATCH", `${wa}/members/${A.id}`, "PATCH /members/:id", { role: "member" }),
      r(X.token, "DELETE", `${wa}/members/${A.id}`, "DELETE /members/:id"),
      r(X.token, "GET", `${wa}/documents`, "/documents"),
      r(X.token, "POST", `${wa}/documents`, "POST /documents", { title: "x" }),
      r(X.token, "GET", `${wa}/tasks`, "/tasks"),
      r(X.token, "GET", `${wa}/tasks/stats?today=2030-01-01`, "/tasks/stats"),
      r(X.token, "POST", `${wa}/tasks`, "POST /tasks", { title: "x" }),
      r(X.token, "GET", `${wa}/snippets`, "/snippets"),
      r(X.token, "POST", `${wa}/snippets`, "POST /snippets", { title: "x", code: "x", language: "javascript" }),
      r(X.token, "GET", `${wa}/activity`, "/activity"),
      r(X.token, "GET", `${wa}/search?q=audit`, "/search"),
      r(X.token, "GET", `${wa}/ai/status`, "/ai/status"),
      ...itemRoutes(wa, X.token),
    ];
    await sweep("Isolation", "CRITICAL", [404], outsider, "a stranger gets 'not found' for everything in someone else's workspace", "from a stranger were NOT answered with 'not found'", "one workspace's data could be read or changed by another");

    const confusion = itemRoutes(wx, X.token);
    await sweep("Isolation", "CRITICAL", [404], confusion, "another workspace's document, task and snippet ids don't work inside your own workspace", "using another workspace's ids inside your own were NOT 'not found'", "ids from one workspace reached data in another");

    const asMember = [
      r(M.token, "DELETE", wa, "DELETE /workspace"),
      r(M.token, "PATCH", wa, "PATCH /workspace (rename)", { name: "Hacked" }),
      r(M.token, "POST", `${wa}/members`, "POST /members (add someone)", { email: X.email, role: "member" }),
      r(M.token, "PATCH", `${wa}/members/${A.id}`, "PATCH owner's role", { role: "member" }),
      r(M.token, "PATCH", `${wa}/members/${M.id}`, "PATCH own role to admin", { role: "admin" }),
      r(M.token, "DELETE", `${wa}/members/${A.id}`, "DELETE the owner"),
      r(M.token, "DELETE", `${wa}/documents/${doc.id}`, "DELETE someone else's document"),
      r(M.token, "DELETE", `${wa}/tasks/${task.id}`, "DELETE someone else's task"),
      r(M.token, "DELETE", `${wa}/snippets/${snippet.id}`, "DELETE someone else's snippet"),
    ];
    await sweep("Roles", "HIGH", [403], asMember, "a plain member can't do owner or admin things, or delete other people's work", "a plain member was NOT refused (403)", "a member could rename or delete the workspace, change roles, or delete others' work");

    const afterwards = {
      doc: await api("GET", `${wa}/documents/${doc.id}`, { token: A.token }),
      task: await api("GET", `${wa}/tasks/${task.id}`, { token: A.token }),
      snippet: await api("GET", `${wa}/snippets/${snippet.id}`, { token: A.token }),
      workspace: await api("GET", wa, { token: A.token }),
      members: await api("GET", `${wa}/members`, { token: A.token }),
    };
    check(
      afterwards.doc.data?.document?.title === "Audit doc" &&
        afterwards.task.data?.task?.title === "Audit task" &&
        afterwards.snippet.data?.snippet?.title === "Audit snippet" &&
        afterwards.workspace.data?.workspace?.name === "Audit Space" &&
        afterwards.members.data?.members?.length === 2,
      "CRITICAL",
      "Isolation",
      "after all those attacks, nothing was changed or deleted",
      "something was changed or deleted by the attacks",
      "an attack succeeded"
    );

    const positive = await api("GET", `${wa}/tasks`, { token: M.token });
    check(positive.status === 200, "HIGH", "Roles", "(control) a real member can still read the workspace", "a real member can't read the workspace", "the checks above would prove nothing");

    const strange = [
      r(A.token, "GET", "/api/workspaces/not-an-id", "/workspaces/not-an-id"),
      r(A.token, "GET", `${wa}/tasks/123`, "/tasks/123"),
      r(A.token, "GET", `${wa}/documents/zzz`, "/documents/zzz"),
      r(A.token, "GET", `${wa}/snippets/not-an-id`, "/snippets/not-an-id"),
      r(A.token, "GET", `${wa}/documents/${"0".repeat(24)}`, "/documents/(unknown id)"),
    ];
    await sweep("Input", "LOW", [404], strange, "malformed and unknown ids get a clean 'not found'", "with malformed or unknown ids were not a clean 'not found'", "a crash instead of a refusal");

    const massTask = await api("POST", `${wa}/tasks`, { token: A.token, body: { title: "Mass", workspace: WX, createdBy: X.id, position: 1, id: "0".repeat(24), _id: "0".repeat(24) } });
    check(massTask.status === 201 && massTask.data.task.workspaceId === WA && massTask.data.task.createdBy.id === A.id && massTask.data.task.id !== "0".repeat(24), "HIGH", "Input", "a new task ignores a workspace, creator or id supplied by the client", "a client could choose a task's workspace, creator or id", "data could be put into someone else's workspace");

    const massSpace = await api("POST", "/api/workspaces", { token: A.token, body: { name: "Audit Mass", owner: X.id } });
    if (massSpace.status === 201) workspaces.push({ id: massSpace.data.workspace.id, token: A.token });
    check(massSpace.status === 201 && massSpace.data.workspace.ownerId === A.id, "HIGH", "Input", "a new workspace ignores an owner supplied by the client", "a client could choose a workspace's owner", "someone could hand themselves or others ownership");

    // ================= Bad input =================
    section("Bad input and what the server says back");
    const brokenJson = await http("POST", `${API}/api/auth/login`, { raw: "{not json", headers: { "Content-Type": "application/json" } });
    check(brokenJson.status === 400, "LOW", "Input", "broken JSON gets a clean 400", `broken JSON got ${brokenJson.status}`, "a crash instead of a refusal");

    const huge = await http("POST", `${wa}/tasks`, { token: A.token, raw: JSON.stringify({ title: "x".repeat(2_000_000) }), headers: { "Content-Type": "application/json" } }).catch(() => ({ status: 0 }));
    check([400, 413].includes(huge.status) || huge.status === 0, "MEDIUM", "Input", "a 2 MB request is refused (413)", `a 2 MB request got ${huge.status}`, "huge bodies can slow or crash the server");

    const wrongType = await http("POST", `${API}/api/auth/login`, { raw: "email=a&password=b", headers: { "Content-Type": "text/plain" } });
    check(wrongType.status === 400, "LOW", "Input", "a request with the wrong content type gets a clean 400", `the wrong content type got ${wrongType.status}`, "a crash instead of a refusal");

    const longTitle = await api("POST", `${wa}/tasks`, { token: A.token, body: { title: "x".repeat(5000) } });
    check(longTitle.status === 400, "LOW", "Input", "a 5,000 character title is refused", `a 5,000 character title got ${longTitle.status}`, "unbounded input");

    const nullByte = await api("POST", `${wa}/tasks`, { token: A.token, body: { title: "a\u0000b" } });
    check(nullByte.status < 500, "LOW", "Input", "control characters in a title don't crash anything", "a control character crashed the server", "a crash on odd input");

    const operators = await api("GET", `${wa}/tasks?status[$ne]=done&assignee[$gt]=&q[$ne]=x`, { token: A.token });
    check(operators.status < 500 && (operators.data?.tasks ?? []).every((t) => t.workspaceId === WA), "HIGH", "Input", "database operators in a URL are ignored, and results stay in this workspace", `database operators in a URL got ${operators.status}`, "NoSQL injection");

    const bomb = await api("GET", `${wa}/search?q=${encodeURIComponent(`(a+)+$${"a".repeat(30)}!`)}`, { token: A.token });
    check(bomb.status === 200 && bomb.ms < 2000, "MEDIUM", "Input", `a regex-bomb search is answered normally in ${Math.round(bomb.ms)} ms`, `a regex-bomb search got ${bomb.status} in ${Math.round(bomb.ms)} ms`, "one request could keep the server busy for minutes");

    const searchPolicy = /^(\d+);w=(\d+)/.exec(header(bomb, "ratelimit-policy"));
    check(Boolean(searchPolicy) && Number(searchPolicy[1]) <= 300, "LOW", "Limits", `search is rate limited (${searchPolicy?.[1]} per ${Math.round(Number(searchPolicy?.[2] ?? 0) / 60)} minute)`, "search has no rate limit", "one client could flood the database");

    const cache = await api("GET", "/api/auth/me", { token: A.token });
    check(/no-store/i.test(header(cache, "cache-control")), "LOW", "Headers", "private answers say 'don't store this' (no-store)", "private answers can be cached (no Cache-Control: no-store)", "on a shared computer or behind a proxy, one person's data could be kept and shown to another");

    // ================= Live connection =================
    section("Live connection (Socket.IO)");
    const trySocket = (auth) =>
      new Promise((resolve) => {
        const socket = io(API, { auth, transports: ["websocket"], reconnection: false, timeout: 4000 });
        const finish = (result) => {
          socket.close();
          resolve(result);
        };
        socket.on("connect", () => finish("connected"));
        socket.on("connect_error", () => finish("refused"));
        setTimeout(() => finish("timed out"), 5000);
      });

    const socketResults = {
      "no token": await trySocket({}),
      "a made-up token": await trySocket({ token: "not.a.token" }),
      "an expired token": await trySocket({ token: forged[0][1] }),
      "a forged token": await trySocket({ token: forged[1][1] }),
    };
    const socketBad = Object.entries(socketResults).filter(([, result]) => result !== "refused");
    check(socketBad.length === 0, "CRITICAL", "Live", "connections with no token, or a bad one, are refused", `these were not refused: ${socketBad.map(([label, result]) => `${label} (${result})`).join("; ")}`, "strangers could listen to a workspace's live events");
    check((await trySocket({ token: A.token })) === "connected", "HIGH", "Live", "(control) a real token connects", "a real token can't connect", "the checks above would prove nothing");

    const polling = await http("GET", `${API}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: EVIL } });
    const pollingOrigin = header(polling, "access-control-allow-origin");
    check(pollingOrigin !== EVIL && pollingOrigin !== "*", "HIGH", "Live", "another website isn't allowed to open a live connection", `another website (${EVIL}) is allowed to connect (${pollingOrigin})`, "any website could connect a visitor's browser");

    // ================= Frontend =================
    section("Frontend (Next.js) headers");
    const site = await http("GET", `${WEB}/`).catch(() => null);
    if (!site) {
      note("Frontend", `the frontend isn't running at ${WEB}, so its headers weren't checked. Start it and run the audit again.`);
    } else {
      check(header(site, "x-content-type-options").toLowerCase() === "nosniff", "MEDIUM", "Frontend", "the site sends nosniff", "the site doesn't send X-Content-Type-Options: nosniff", "browsers may guess types");
      check(Boolean(header(site, "x-frame-options")) || /frame-ancestors/i.test(header(site, "content-security-policy")), "MEDIUM", "Frontend", "the site can't be framed by other sites", "any website can put BrainBoard in a hidden frame", "clickjacking: a visitor could be tricked into clicking buttons they can't see");
      check(Boolean(header(site, "content-security-policy")), "MEDIUM", "Frontend", "a Content-Security-Policy is set", "there is no Content-Security-Policy", "it's the strongest second line of defence if any script ever gets injected");
      check(Boolean(header(site, "referrer-policy")), "LOW", "Frontend", "a referrer policy is set", "no referrer policy", "full addresses leak to other sites when people follow links");
      check(Boolean(header(site, "permissions-policy")), "LOW", "Frontend", "browser features (camera, microphone...) are restricted", "no Permissions-Policy", "nothing limits which browser features the page may use");
      check(!header(site, "x-powered-by"), "LOW", "Frontend", "the site doesn't announce its framework", "the site announces its framework (X-Powered-By)", "it tells attackers what to look for");
    }

    // ================= Secrets =================
    section("Secrets and Git");
    const secret = env.jwtSecret;
    check(secret.length >= 48 && new Set(secret).size >= 12, "HIGH", "Secrets", "the JWT secret is long and random-looking", "the JWT secret is short or repetitive", "a guessable secret lets anyone forge a login token for any user");
    check(!/replace_with|changeme|secret|password|example|test/i.test(secret), "HIGH", "Secrets", "the JWT secret isn't a placeholder", "the JWT secret looks like a placeholder", "anyone can guess it");

    try {
      git(["rev-parse", "--git-dir"]);

      const tracked = git(["ls-files", "--", "backend/.env", "frontend/.env.local", "backend/.env.local", ".env"]).trim();
      check(tracked === "", "CRITICAL", "Git", "no .env file is tracked by Git today", `these secret files are tracked by Git right now: ${tracked.split("\n").join(", ")}`, "they would be published with the next push");

      const ignore = fs.existsSync(path.join(repoRoot, ".gitignore")) ? fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8") : "";
      check(/^\.env/m.test(ignore), "HIGH", "Git", ".gitignore keeps .env files out", ".gitignore doesn't list .env files", "a secret file could be committed by accident");

      const paths = ["backend/.env", ".env", "backend/.env.local", "frontend/.env.local"];
      const commits = git(["log", "--all", "--format=%H", "--", ...paths]).split("\n").filter(Boolean);
      const blobs = new Map();
      for (const sha of commits) {
        for (const file of paths) {
          try {
            const content = git(["show", `${sha}:${file}`]);
            blobs.set(crypto.createHash("sha256").update(content).digest("hex"), parseEnv(content));
          } catch {
            // the file wasn't in that commit
          }
        }
      }

      if (blobs.size === 0) {
        pass("Git", "no .env file has ever been committed");
      } else {
        note("Git", `${blobs.size} version(s) of a secret .env file exist in your Git history. That's old data; what matters is whether those values are still in use (next lines).`);
        const history = [...blobs.values()];
        const currentUri = String(env.mongodbUri);
        const currentPassword = passwordOf(currentUri);

        check(!history.some((old) => old.JWT_SECRET && old.JWT_SECRET === secret), "CRITICAL", "Git", "your CURRENT JWT secret isn't in your Git history", "your CURRENT JWT secret is in your Git history", "anyone who can read the repository can forge a login token for any user, and everyone must be signed out when you replace it");
        check(!history.some((old) => old.MONGODB_URI && (old.MONGODB_URI === currentUri || (currentPassword && passwordOf(old.MONGODB_URI) === currentPassword))), "CRITICAL", "Git", "your CURRENT database password isn't in your Git history", "your CURRENT database password is in your Git history", "anyone who can read the repository could open your database");
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (geminiKey) {
          check(!history.some((old) => old.GEMINI_API_KEY && old.GEMINI_API_KEY === geminiKey), "CRITICAL", "Git", "your CURRENT AI key isn't in your Git history", "your CURRENT AI key is in your Git history", "anyone could use your key");
        }
      }
    } catch {
      note("Git", "couldn't read the Git repository from here, so the Git checks were skipped.");
    }

    // ================= Leaks =================
    section("Leaks in error messages");
    const leaks = errorTexts.filter((entry) => /node_modules|\.js:\d+|\bat\s+\S+\s+\(|MongoServerError|MongooseError|CastError|E11000|"stack"|[A-Z]:\\\\|\/home\/|\/usr\//i.test(entry.text));
    check(leaks.length === 0, "HIGH", "Leaks", `none of the ${errorTexts.length} error answers collected during this audit revealed a stack trace, file path or database error`, `${leaks.length} error answers revealed internals: ${leaks.slice(0, 3).map((entry) => `${entry.method} ${entry.url.replace(API, "")} ${entry.status}`).join("; ")}`, "details help an attacker");
  } finally {
    for (const space of workspaces) {
      await api("DELETE", `/api/workspaces/${space.id}`, { token: space.token }).catch(() => {});
    }
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} findings (FAIL), ${noted} notes ===`);
  console.log("This is an automated outside-in test. It finds a lot, but it is not a substitute for a careful read of the code.");
  console.log("The audit used about 17 sign-in attempts. Restart the backend before running other scripts.");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe audit couldn't finish: ${error.message}`);
  process.exit(1);
});