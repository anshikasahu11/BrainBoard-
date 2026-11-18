// Measures how many proxies sit in front of the live server, so TRUST_PROXY can be set correctly.
// Run it by hand against the deployed server while it has a DIAGNOSTICS_KEY. It makes two requests
// to a hidden page: a normal one, and one that pretends to come from a made-up address. It then
// compares what the server saw with your real public address.
//
// In PowerShell, from the backend folder:
//   $env:DIAGNOSTICS_KEY = "the-key-you-set-on-the-server"
//   node scripts/client-ip-check.mjs https://your-api.example.com
//
// If looking up your own address fails, add it yourself:  --my-ip=198.51.100.7

import { judgeClientIp } from "../config/production.js";

const target = process.argv.slice(2).find((arg) => /^https?:\/\//.test(arg));
const ipArg = process.argv.slice(2).find((arg) => arg.startsWith("--my-ip="));
const key = process.env.DIAGNOSTICS_KEY ?? "";
const FORGED = "203.0.113.77"; // an address from the range reserved for examples

if (!target || key.length < 16) {
  console.error(
    [
      "Usage (PowerShell):",
      '  $env:DIAGNOSTICS_KEY = "the-key-you-set-on-the-server"   (at least 16 characters)',
      "  node scripts/client-ip-check.mjs https://your-api.example.com",
    ].join("\n")
  );
  process.exit(1);
}

const base = target.replace(/\/+$/, "");

async function ask(extraHeaders = {}) {
  // A sleeping free server can take a minute to wake up.
  const response = await fetch(`${base}/api/diagnostics/client-ip`, {
    headers: { "x-diagnostics-key": key, ...extraHeaders },
    signal: AbortSignal.timeout(100_000),
  });
  if (response.status === 404) {
    throw new Error(
      "The server answered 'not found'. Either the key is wrong, or DIAGNOSTICS_KEY isn't set on the server yet (it must be at least 16 characters, and the server must have restarted after you set it)."
    );
  }
  if (!response.ok) throw new Error(`The server answered with status ${response.status}.`);
  return response.json();
}

async function myAddress() {
  if (ipArg) return ipArg.slice("--my-ip=".length).trim();
  const reply = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(15_000) });
  return (await reply.json()).ip;
}

try {
  console.log(`Asking ${base} (a sleeping free server can take a minute to wake up)...\n`);

  const mine = await myAddress();
  const normal = await ask();
  const forged = await ask({ "x-forwarded-for": FORGED });

  console.log(`Your real address:                       ${mine}`);
  console.log(`What the server saw for a normal request: ${normal.ip}`);
  console.log(`What it saw when a header claimed ${FORGED}: ${forged.ip}`);
  console.log(`TRUST_PROXY on the server right now:     ${JSON.stringify(normal.trustProxy)}`);
  console.log(`The forwarding chain it received:        ${normal.forwardedFor ?? "(none)"}\n`);

  const verdict = judgeClientIp({ myIp: mine, seenIp: normal.ip, forgedValue: FORGED, forgedSeenIp: forged.ip });
  console.log(`${verdict.ok ? "PASS" : "FAIL"}  ${verdict.advice}`);
  process.exit(verdict.ok ? 0 : 1);
} catch (error) {
  console.error(`The measurement couldn't finish: ${error.message}`);
  process.exit(1);
}