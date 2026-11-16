// A self-test for signing out: the token stops working, its live connections are hung up, the
// person's other sessions are untouched, and the database keeps only a fingerprint. It creates one
// throwaway person. It needs the backend running, and reads the database for the last few checks.
//
// Run it from the backend folder:
//   node scripts/signout-check.mjs

import mongoose from "mongoose";
import { io } from "socket.io-client";
import { connectDB } from "../config/db.js";
import RevokedToken from "../models/RevokedToken.js";
import { hashToken } from "../utils/token.js";

const API = process.env.API_URL || "http://localhost:5000";
const PASSWORD = "Password123";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (predicate()) return true;
    await sleep(40);
  }
  return false;
}

async function api(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

// Opens a live connection and remembers why it closed.
function connect(token) {
  return new Promise((resolve) => {
    const socket = io(API, { auth: { token }, transports: ["websocket"], reconnection: false });
    socket.closedBecause = null;
    socket.on("disconnect", (reason) => {
      socket.closedBecause = reason;
    });
    socket.on("connect", () => resolve({ ok: true, socket }));
    socket.on("connect_error", (error) => {
      socket.close();
      resolve({ ok: false, error: error.message });
    });
  });
}

const claimsOf = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));

async function main() {
  console.log(`Checking sign-out at ${API}\n`);

  const email = `signout-check-${Date.now()}@example.com`;
  const registered = await api("POST", "/api/auth/register", { body: { name: "Signout Check", email, password: PASSWORD } });
  if (registered.status !== 201) {
    throw new Error(`Couldn't create the test person (status ${registered.status}: ${registered.data?.message}). If it says "Too many attempts", restart the backend and try again.`);
  }
  const userId = registered.data.user.id;

  // Three sessions for the same person, like three browsers.
  const login = async () => (await api("POST", "/api/auth/login", { body: { email, password: PASSWORD } })).data.token;
  const T1 = registered.data.token;
  const T2 = await login();
  const T3 = await login();

  // Sign-ins at the very same moment must still be different sessions. (Before tokens had their own
  // random number, two made in the same second were identical, so signing one out ended the other.)
  const together = await Promise.all([login(), login(), login()]);
  check("Sign-ins at the very same moment get different tokens", new Set([T1, T2, T3, ...together]).size === 6, `${new Set([T1, T2, T3, ...together]).size} different of 6`);

  const sockets = [];
  try {
    const one = await connect(T1);
    const two = await connect(T2);
    if (!one.ok || !two.ok) throw new Error("Couldn't open live connections. Is the backend running?");
    sockets.push(one.socket, two.socket);

    check("Before signing out, all three sessions work", (await api("GET", "/api/auth/me", { token: T1 })).status === 200 && (await api("GET", "/api/auth/me", { token: T2 })).status === 200 && (await api("GET", "/api/auth/me", { token: T3 })).status === 200);
    check("...and two of them have a live connection open", one.socket.connected && two.socket.connected);

    // ---------- Signing out session 1 ----------
    check("Signing out without a token is refused", (await api("POST", "/api/auth/logout")).status === 401);
    check("Signing out with a made-up token is refused", (await api("POST", "/api/auth/logout", { token: "not.a.token" })).status === 401);

    const out = await api("POST", "/api/auth/logout", { token: T1 });
    check("Signing out works", out.status === 204);
    check("The token is refused straight away, and the message says why", await (async () => {
      const reply = await api("GET", "/api/auth/me", { token: T1 });
      return reply.status === 401 && /ended/i.test(reply.data?.message ?? "");
    })());
    check(
      "The live connection opened with that token is hung up by the server",
      (await waitFor(() => one.socket.closedBecause !== null)) && one.socket.closedBecause === "io server disconnect",
      String(one.socket.closedBecause)
    );

    const again = await connect(T1);
    if (again.ok) again.socket.close();
    check("The ended token can't open a NEW live connection either", again.ok === false && /ended/i.test(again.error ?? ""), JSON.stringify(again.error));

    check("Signing out the same token twice is refused cleanly, not an error", (await api("POST", "/api/auth/logout", { token: T1 })).status === 401);

    // ---------- The person's other sessions ----------
    await sleep(300);
    check("The other session's live connection is still open", two.socket.connected === true && two.socket.closedBecause === null);
    check("The other sessions' tokens still work", (await api("GET", "/api/auth/me", { token: T2 })).status === 200 && (await api("GET", "/api/auth/me", { token: T3 })).status === 200);

    const fresh = await login();
    check("Signing in again gives a new token that works", fresh !== T1 && (await api("GET", "/api/auth/me", { token: fresh })).status === 200);

    // ---------- Two sign-outs at the same moment ----------
    const [first, second] = await Promise.all([api("POST", "/api/auth/logout", { token: T3 }), api("POST", "/api/auth/logout", { token: T3 })]);
    check(
      "Two sign-outs at once: neither errors, and at least one succeeds",
      [first.status, second.status].every((status) => [204, 401].includes(status)) && [first.status, second.status].includes(204),
      `${first.status} and ${second.status}`
    );
    check("...and afterwards that token is refused", (await api("GET", "/api/auth/me", { token: T3 })).status === 401);

    // ---------- What the database keeps ----------
    await connectDB();
    const rows = await RevokedToken.find({ user: userId }).lean();

    check("Exactly two sessions are recorded as ended (one each, even after the double sign-out)", rows.length === 2, `${rows.length} rows`);

    const row = rows.find((entry) => entry.tokenHash === hashToken(T1));
    check("The ended session is recorded as a fingerprint of 64 letters and numbers", Boolean(row) && /^[a-f0-9]{64}$/.test(row.tokenHash));
    check("...never as the token itself", rows.every((entry) => !JSON.stringify(entry).includes(T1) && !JSON.stringify(entry).includes(T3)));
    check(
      "...and kept only until the token would have expired anyway",
      Boolean(row) && Math.abs(row.expiresAt.getTime() - claimsOf(T1).exp * 1000) < 2000 && row.expiresAt.getTime() > Date.now()
    );

    const indexes = await RevokedToken.collection.indexes();
    check("The database removes the record by itself when that moment comes", indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
  } finally {
    for (const socket of sockets) socket.close();
    await mongoose.disconnect();
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
