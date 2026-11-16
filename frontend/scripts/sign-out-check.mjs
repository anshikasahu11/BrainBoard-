// A self-test for the browser side of signing out. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/sign-out-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

delete process.env.NEXT_PUBLIC_API_URL; // so the default address is the one that's tested
const { endSessionRequest } = await import("../lib/endSession.js");

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const realFetch = globalThis.fetch;

// Replaces fetch with a pretend one that records what it was asked, and answers with `respond`.
function pretend(respond) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  return calls;
}

console.log("Checking the browser's side of signing out\n");

let calls = pretend(() => ({ ok: true, status: 204 }));
const accepted = await endSessionRequest("tok123");
check("It sends one request, to the sign-out address", calls.length === 1 && calls[0].url === "http://localhost:5000/api/auth/logout", calls[0]?.url);
check("...as a POST", calls[0].init.method === "POST");
check("...carrying the token it was given", calls[0].init.headers.Authorization === "Bearer tok123");
check("...and nothing else: no body, no cookies", calls[0].init.body === undefined && calls[0].init.credentials === undefined);
check("It reports success when the server ended the session", accepted === true);

pretend(() => ({ ok: false, status: 401 }));
check("A refusal (the session was already ended) is reported, not thrown", (await endSessionRequest("tok")) === false);

pretend(() => ({ ok: false, status: 500 }));
check("A server error is reported, not thrown", (await endSessionRequest("tok")) === false);

pretend(() => {
  throw new TypeError("fetch failed");
});
check("No connection never throws, so signing out can't fail", (await endSessionRequest("tok")) === false);

pretend(() => Promise.reject(new Error("boom")));
check("A rejected request never throws either", (await endSessionRequest("tok")) === false);

calls = pretend(() => ({ ok: true }));
check("With no token, nothing is sent", (await endSessionRequest("")) === false && (await endSessionRequest(null)) === false && (await endSessionRequest(undefined)) === false && (await endSessionRequest(42)) === false && calls.length === 0);

globalThis.fetch = realFetch;

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);