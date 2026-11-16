// A self-test for the website's security headers and Content-Security-Policy. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/headers-check.mjs

import { apiOrigins, buildCsp, securityHeaders } from "../lib/securityHeaders.mjs";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LOCAL = "http://localhost:5000";

// "connect-src 'self' http://x" -> ["'self'", "http://x"]
const directive = (csp, name) => (csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "").split(" ").slice(1);

console.log("Checking the website's security headers\n");

// ---------- 1. The headers ----------
const prod = securityHeaders({ isProd: true, apiUrl: LOCAL });
const dev = securityHeaders({ isProd: false, apiUrl: LOCAL });
const headersOf = (config) => Object.fromEntries(config[0].headers.map((header) => [header.key, header.value]));
const live = headersOf(prod);

check("The headers apply to every page", prod.length === 1 && prod[0].source === "/(.*)");
check("Browsers are told not to guess content types", live["X-Content-Type-Options"] === "nosniff");
check("No other site can frame this one", live["X-Frame-Options"] === "DENY");
check("Full addresses aren't sent to other sites", live["Referrer-Policy"] === "strict-origin-when-cross-origin");
check("Camera, microphone, location, payments and USB are switched off", ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].every((rule) => live["Permissions-Policy"].includes(rule)));
check("Other windows can't reach into this one", live["Cross-Origin-Opener-Policy"] === "same-origin");
check("Each header is there once, with a value, and no line breaks", (() => {
  const keys = prod[0].headers.map((header) => header.key);
  return new Set(keys).size === keys.length && prod[0].headers.every((header) => header.value.length > 0 && !/[\r\n]/.test(header.key + header.value));
})());

// ---------- 2. The Content-Security-Policy ----------
const csp = live["Content-Security-Policy"];
check("A Content-Security-Policy is sent", typeof csp === "string" && csp.length > 100);
check("Everything is limited to this site unless said otherwise", same(directive(csp, "default-src"), ["'self'"]));
check("Nobody can frame the site, and the site frames nothing", same(directive(csp, "frame-ancestors"), ["'none'"]) && same(directive(csp, "frame-src"), ["'none'"]));
check("No plugins or embedded objects", same(directive(csp, "object-src"), ["'none'"]));
check("A page can't change where its links start from", same(directive(csp, "base-uri"), ["'self'"]));
check("Forms can only submit to this site", same(directive(csp, "form-action"), ["'self'"]));
check("The page may talk to the API, and its live connection, and nowhere else", same(directive(csp, "connect-src"), ["'self'", "http://localhost:5000", "ws://localhost:5000"]), directive(csp, "connect-src").join(" "));
check("Images may be this site's own, inline, or from the page itself", same(directive(csp, "img-src"), ["'self'", "data:", "blob:"]));
check("On the live site, scripts can't use eval", !csp.includes("'unsafe-eval'"));
check("In development, the dev tools can", buildCsp({ isProd: false, apiUrl: LOCAL }).includes("'unsafe-eval'") && directive(buildCsp({ isProd: false, apiUrl: LOCAL }), "script-src").includes("'unsafe-eval'"));
check("In development, the dev tools' own connection is allowed", directive(buildCsp({ isProd: false, apiUrl: LOCAL }), "connect-src").includes("ws://localhost:*") && !csp.includes("ws://localhost:*"));
check("Scripts can't come from anywhere else", same(directive(csp, "script-src"), ["'self'", "'unsafe-inline'"]));

check(
  "Nothing in the policy is a wildcard that would let anything in",
  csp.split(/[ ;]+/).every((token) => token !== "*" && token !== "http:" && token !== "https:" && token !== "ws:" && token !== "wss:") && !csp.includes("*.")
);
check("Scripts never allow data: or blob: (a common way around a policy)", !directive(csp, "script-src").some((source) => source === "data:" || source === "blob:"));
check("The policy is one tidy line with no line breaks", !/[\r\n]/.test(csp));
check("Development gets the same headers, with the dev rules", dev[0].headers.length === prod[0].headers.length && headersOf(dev)["X-Frame-Options"] === "DENY");

// ---------- 3. Report-only mode ----------
const reportOnly = headersOf(securityHeaders({ isProd: true, apiUrl: LOCAL, reportOnly: true }));
check("Report-only mode sends the report-only header and NOT the enforcing one", Boolean(reportOnly["Content-Security-Policy-Report-Only"]) && !("Content-Security-Policy" in reportOnly));
check("...with exactly the same policy", reportOnly["Content-Security-Policy-Report-Only"] === csp);
check("...and keeps every other protection", reportOnly["X-Frame-Options"] === "DENY" && reportOnly["X-Content-Type-Options"] === "nosniff");

// ---------- 4. The API address ----------
check("A web address gives its own origin and its live connection", same(apiOrigins("https://api.example.com"), ["https://api.example.com", "wss://api.example.com"]));
check("A trailing slash doesn't matter", same(apiOrigins("https://api.example.com/"), ["https://api.example.com", "wss://api.example.com"]));
check("A path is left out", same(apiOrigins("https://api.example.com/v1/"), ["https://api.example.com", "wss://api.example.com"]));
check("A port is kept", same(apiOrigins("http://localhost:5000"), ["http://localhost:5000", "ws://localhost:5000"]) && same(apiOrigins("https://x.example.com:8443"), ["https://x.example.com:8443", "wss://x.example.com:8443"]));
check("Plain http gives ws, and https gives wss", apiOrigins("http://a.example.com")[1].startsWith("ws://") && apiOrigins("https://a.example.com")[1].startsWith("wss://"));

const hostile = [
  "http://x.com; script-src *",
  "http://x.com;script-src.evil.com",
  "http://x.com\nscript-src *",
  "javascript:alert(1)",
  "data:text/html,hi",
  "file:///etc/passwd",
  "ftp://example.com",
  "not a url",
  "",
  "http://",
  "http://user:pass@evil.com",
  "http://evil.com/%0d%0a",
  undefined,
  null,
  42,
];
check("Hostile, odd or missing addresses give nothing, and never throw", hostile.every((value) => {
  try {
    return apiOrigins(value).length === 0 || /^[a-z]+:\/\/[a-z0-9.-]+(:\d+)?$/i.test(apiOrigins(value)[0]);
  } catch {
    return false;
  }
}), hostile.map((value) => JSON.stringify(apiOrigins(value))).join(" "));

const injected = buildCsp({ isProd: true, apiUrl: "http://x.com;script-src.evil.com" });
check("A hostile address can't add rules to the policy", !injected.includes("evil.com") && same(directive(injected, "script-src"), ["'self'", "'unsafe-inline'"]) && same(directive(injected, "connect-src"), ["'self'"]));
check("With no usable address, the page can only talk to itself", same(directive(buildCsp({ isProd: true, apiUrl: "" }), "connect-src"), ["'self'"]));
check("A real address for a deployed site gives a tight policy", (() => {
  const real = buildCsp({ isProd: true, apiUrl: "https://api.brainboard.app/" });
  return same(directive(real, "connect-src"), ["'self'", "https://api.brainboard.app", "wss://api.brainboard.app"]);
})());

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);