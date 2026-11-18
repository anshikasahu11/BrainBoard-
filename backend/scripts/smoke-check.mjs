// A read-only check of a DEPLOYED backend, from outside, the way a visitor reaches it. It creates
// nothing in the database. Run it after every deploy.
//
//   node scripts/smoke-check.mjs https://your-api.onrender.com
//   node scripts/smoke-check.mjs https://your-api.onrender.com --origin=https://your-site.vercel.app
//
// --origin is your website's address. With it, the check also confirms that your website IS allowed.
//
// To also test signing in, opening a live connection, and signing out (nothing is created, but a login
// session is started and then ended), give it an existing account:
//   $env:SMOKE_EMAIL = "you@example.com"; $env:SMOKE_PASSWORD = "your password"
//
// A free server that has gone to sleep can take a minute to answer the first request.

const args = process.argv.slice(2);
const target = (args.find((arg) => /^https?:\/\//.test(arg)) ?? process.env.API_URL ?? "").replace(/\/+$/, "");
const ownOrigin = (args.find((arg) => arg.startsWith("--origin=")) ?? "").slice("--origin=".length).replace(/\/+$/, "");
const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";
const EVIL = "https://evil.example";
const stamp = Date.now();

if (!target) {
  console.error("Usage: node scripts/smoke-check.mjs https://your-api.example.com [--origin=https://your-site.example.com]");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const section = (title) => console.log(`\n--- ${title} ---`);

function check(ok, good, bad) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${good}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${bad}`);
  }
  return ok;
}

async function call(method, route, { headers = {}, body, timeout = 30_000 } = {}) {
  const response = await fetch(`${target}${route}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: response.status, headers: response.headers, text, json };
}

const header = (reply, name) => reply.headers.get(name) ?? "";

async function main() {
  console.log(`Smoke check of ${target}`);

  // ---------- Is it up? ----------
  section("Is it up?");
  const started = Date.now();
  const health = await call("GET", "/api/health", { timeout: 100_000 });
  const took = (Date.now() - started) / 1000;
  console.log(`(the first answer took ${took.toFixed(1)}s${took > 10 ? ": the server was asleep and has just woken up" : ""})`);

  check(health.status === 200, "the health page answers 200", `the health page answered ${health.status}`);
  check(health.json?.status === "ok" && health.json?.database === "connected", "it reports status ok and the database connected", `it reports: ${health.text.slice(0, 120)}`);

  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(target);
  check(target.startsWith("https://") || local, "the address uses https", "the address isn't https, so everything travels unprotected");

  // ---------- What every answer says ----------
  section("Headers");
  check(header(health, "x-content-type-options").toLowerCase() === "nosniff", "browsers are told not to guess content types", "the nosniff header is missing");
  check(!header(health, "x-powered-by"), "the server doesn't announce its framework", "it announces its framework (X-Powered-By)");
  check(/no-store/i.test(header(health, "cache-control")), "answers say 'don't keep a copy' (no-store)", "answers can be cached (no no-store)");
  check(header(health, "content-type").includes("application/json"), "answers are labelled as JSON", "answers aren't labelled as JSON");
  check(Boolean(header(health, "strict-transport-security")) || local, "HSTS is on, so browsers insist on https", "no HSTS header");

  // ---------- Errors ----------
  section("Errors");
  const missing = await call("GET", `/api/not-a-real-page-${stamp}`);
  check(missing.status === 404 && typeof missing.json?.message === "string", "an unknown page gives a clean JSON 404", `an unknown page gave ${missing.status}: ${missing.text.slice(0, 80)}`);
  check(!/node_modules|\.js:\d+|\bat\s+\S+\s+\(|MongoServerError|stack/i.test(missing.text), "errors reveal no file paths or stack traces", "an error answer reveals internals");

  const anonymous = await call("GET", "/api/auth/me");
  check(anonymous.status === 401, "asking who you are without signing in gives 401", `without signing in it gave ${anonymous.status}`);

  // ---------- Limits ----------
  section("Rate limits");
  const wrong = await call("POST", "/api/auth/login", { body: { email: `smoke-${stamp}@example.com`, password: "Wrong12345" } });
  const policy = /^(\d+);w=(\d+)/.exec(header(wrong, "ratelimit-policy"));
  check(wrong.status === 401, "a wrong sign-in is refused with 401", `a wrong sign-in gave ${wrong.status}`);
  check(Boolean(policy) && Number(policy[1]) <= 50, `sign-in is limited to ${policy?.[1]} attempts per ${Math.round(Number(policy?.[2] ?? 0) / 60)} minutes (the real limit, not the test one)`, `the sign-in limit is ${policy?.[1] ?? "missing"}, which is too loose or absent`);

  // ---------- CORS ----------
  section("Which websites may call the API");
  const preflight = (origin) =>
    call("OPTIONS", "/api/workspaces", {
      headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type,x-socket-id" },
    });

  const stranger = await preflight(EVIL);
  check(header(stranger, "access-control-allow-origin") !== EVIL && header(stranger, "access-control-allow-origin") !== "*", "a stranger's website is NOT allowed", `a stranger's website is allowed (${header(stranger, "access-control-allow-origin")})`);
  if (ownOrigin) {
    const own = await preflight(ownOrigin);
    check(header(own, "access-control-allow-origin") === ownOrigin, `your website (${ownOrigin}) IS allowed`, `your website (${ownOrigin}) is NOT allowed: the server allows "${header(own, "access-control-allow-origin") || "nothing"}". CLIENT_URL on the server must be exactly this address`);
    check(["PUT", "PATCH", "DELETE"].every((method) => header(own, "access-control-allow-methods").toUpperCase().includes(method)), "PUT, PATCH and DELETE are allowed for your website", "some methods your website needs are not allowed");
  } else {
    console.log("NOTE  add --origin=https://your-site to also check that YOUR website is allowed");
  }

  const hidden = await call("GET", "/api/diagnostics/client-ip");
  check(hidden.status === 404, "the diagnostics page isn't reachable without its key", `the diagnostics page answered ${hidden.status} without a key`);

  // ---------- Live connection ----------
  section("Live connection");
  const polling = await call("GET", "/socket.io/?EIO=4&transport=polling", { headers: { Origin: EVIL } });
  check(polling.status === 200 && /"sid"/.test(polling.text), "the live-connection endpoint answers", `the live-connection endpoint answered ${polling.status}`);
  check(header(polling, "access-control-allow-origin") !== EVIL && header(polling, "access-control-allow-origin") !== "*", "a stranger's website can't open a live connection", "a stranger's website is allowed to open a live connection");

  let ioClient = null;
  try {
    ioClient = (await import("socket.io-client")).io;
  } catch {
    console.log("SKIP  socket.io-client isn't installed here, so the live-connection tests were skipped (run `npm ci` in the backend folder)");
  }

  if (ioClient) {
    const open = (token) =>
      new Promise((resolve) => {
        const socket = ioClient(target, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false, timeout: 60_000 });
        socket.on("connect", () => resolve({ socket, connected: true }));
        socket.on("connect_error", (error) => {
          socket.close();
          resolve({ connected: false, message: error.message });
        });
        setTimeout(() => {
          socket.close();
          resolve({ connected: false, message: "timed out" });
        }, 70_000);
      });

    const nobody = await open(null);
    check(!nobody.connected && /Authentication required/.test(nobody.message), "a live connection without a login is refused", `a live connection without a login: ${nobody.connected ? "CONNECTED" : nobody.message}`);

    // ---------- Optional: the whole sign-in journey ----------
    if (email && password) {
      section("Signing in (an existing account)");
      const login = await call("POST", "/api/auth/login", { body: { email, password } });
      const token = login.json?.token;
      if (!check(login.status === 200 && Boolean(token), "signing in works", `signing in gave ${login.status}: ${login.json?.message ?? login.text.slice(0, 80)}`)) {
        return finish();
      }

      const me = await call("GET", "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      check(me.status === 200, "the login token works", `the login token gave ${me.status}`);

      const live = await open(token);
      check(live.connected, "a live connection opens with the token (WebSockets work through the host)", `the live connection failed: ${live.message}`);
      if (live.connected) {
        const reply = await new Promise((resolve) => {
          live.socket.timeout(15_000).emit("workspace:join", "0".repeat(24), (error, ack) => resolve(error ? { ok: "timed out" } : ack));
        });
        check(reply?.ok === false, "joining a workspace you don't belong to is refused over the live connection", `joining a stranger's workspace gave ${JSON.stringify(reply)}`);
        live.socket.close();
      }

      const out = await call("POST", "/api/auth/logout", { headers: { Authorization: `Bearer ${token}` } });
      check(out.status === 204, "signing out works", `signing out gave ${out.status}`);

      const after = await call("GET", "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      check(after.status === 401, "the signed-out token is refused straight away", `the signed-out token gave ${after.status}`);

      const again = await open(token);
      check(!again.connected && /ended/i.test(again.message), "the signed-out token can't open a live connection either", `the signed-out token: ${again.connected ? "CONNECTED" : again.message}`);
    } else {
      console.log("\nNOTE  to also test signing in and the live connection, set SMOKE_EMAIL and SMOKE_PASSWORD for an existing account");
    }
  }

  finish();
}

function finish() {
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe smoke check couldn't finish: ${error.cause?.code ?? error.message}`);
  console.error("Is the address right, and is the service running? (A free server may still be waking up: try again in a minute.)");
  process.exit(1);
});