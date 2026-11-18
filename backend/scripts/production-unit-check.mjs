// A self-test for the production rules: allowed website addresses, how many proxies to trust,
// which settings stop the server starting, and how the live proxy measurement is judged.
// It needs no servers and no database.
//
// Run it from the backend folder:
//   node scripts/production-unit-check.mjs

import { enforceProduction, judgeClientIp, parseOrigins, productionProblems, trustProxyHops } from "../config/production.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the production rules\n");

// ---------- 1. Website addresses ----------
const one = parseOrigins("https://app.example.com");
check("One address is accepted", same(one, { origins: ["https://app.example.com"], problems: [] }));
check("A trailing slash is tidied away", same(parseOrigins("https://app.example.com/").origins, ["https://app.example.com"]));
check("Capital letters and a default port are tidied", same(parseOrigins("HTTPS://App.Example.com:443").origins, ["https://app.example.com"]));
check("A real port is kept", same(parseOrigins("http://localhost:3000").origins, ["http://localhost:3000"]));
check("Several addresses, separated by commas, with spaces", same(parseOrigins(" https://a.example.com , https://b.example.com ").origins, ["https://a.example.com", "https://b.example.com"]));
check("The same address twice counts once", same(parseOrigins("https://a.example.com,https://a.example.com/").origins, ["https://a.example.com"]));
check("Nothing given means your own computer's website (for development)", same(parseOrigins("").origins, ["http://localhost:3000"]) && same(parseOrigins(undefined).origins, ["http://localhost:3000"]) && same(parseOrigins("  ,  ").origins, ["http://localhost:3000"]));

for (const [label, value] of [
  ["a wildcard", "https://*.example.com"],
  ["a bare star", "*"],
  ["no protocol", "app.example.com"],
  ["a path", "https://app.example.com/login"],
  ["a query", "https://app.example.com?x=1"],
  ["a username", "https://user:pass@app.example.com"],
  ["javascript:", "javascript:alert(1)"],
  ["ftp", "ftp://example.com"],
  ["nonsense", "not a url"],
]) {
  const out = parseOrigins(value);
  check(`An address with ${label} is refused, and explained`, out.origins.length === 0 && out.problems.length === 1 && out.problems[0].length > 10, JSON.stringify(out));
}
const mixed = parseOrigins("https://good.example.com,https://*.bad.com");
check("One bad address doesn't hide the good one, and the bad one is reported", same(mixed.origins, ["https://good.example.com"]) && mixed.problems.length === 1);

// ---------- 2. How many proxies ----------
check("Not set means no proxy trusted, and says it wasn't set", same(trustProxyHops({}), { hops: false, set: false, problem: null }));
check("A whole number is accepted", trustProxyHops({ TRUST_PROXY: "1" }).hops === 1 && trustProxyHops({ TRUST_PROXY: " 3 " }).hops === 3 && trustProxyHops({ TRUST_PROXY: "10" }).hops === 10);
check("0 and false mean none, on purpose", same(trustProxyHops({ TRUST_PROXY: "0" }), { hops: false, set: true, problem: null }) && trustProxyHops({ TRUST_PROXY: "FALSE" }).set === true);
for (const value of ["true", "yes", "-1", "11", "1.5", "one", "1,2", "loopback", "0.0.0.0/0"]) {
  check(`"${value}" is refused`, trustProxyHops({ TRUST_PROXY: value }).problem !== null && trustProxyHops({ TRUST_PROXY: value }).hops === false);
}

// ---------- 3. Settings that stop the server ----------
const SECRET = "9f3a1c7e5b2d4a60c8e1f7b3d5a90246e8c1b7d3f5a2c4e60918b7d6c5a4f3e2";
const URI_PASSWORD = "Sup3rS3cretPw";
const good = {
  NODE_ENV: "production",
  JWT_SECRET: SECRET,
  CLIENT_URL: "https://brainboard.example.com",
  MONGODB_URI: `mongodb+srv://user:${URI_PASSWORD}@cluster.mongodb.net/brainboard?retryWrites=true`,
  TRUST_PROXY: "1",
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "some-key-value",
};

check("Good settings have no problems at all", same(productionProblems(good), { errors: [], warnings: [] }), JSON.stringify(productionProblems(good)));

const errorsFor = (change) => productionProblems({ ...good, ...change }).errors;
check("A short secret stops it", errorsFor({ JWT_SECRET: "x".repeat(47) }).some((error) => /JWT_SECRET/.test(error)) && errorsFor({ JWT_SECRET: "x".repeat(48) }).length === 0);
check("A missing secret stops it", errorsFor({ JWT_SECRET: undefined }).some((error) => /JWT_SECRET/.test(error)));
check("A placeholder secret stops it", errorsFor({ JWT_SECRET: `replace_with_a_long_random_string_${"a".repeat(30)}` }).some((error) => /placeholder/.test(error)));
check("A missing website address stops it", errorsFor({ CLIENT_URL: "" }).some((error) => /CLIENT_URL isn't set/.test(error)) && errorsFor({ CLIENT_URL: undefined }).length > 0);
check("A website address that isn't https stops it", errorsFor({ CLIENT_URL: "http://brainboard.example.com" }).some((error) => /https/.test(error)));
check("Your own computer as the website stops it", errorsFor({ CLIENT_URL: "http://localhost:3000" }).length >= 1 && errorsFor({ CLIENT_URL: "https://localhost" }).some((error) => /your own computer/.test(error)) && errorsFor({ CLIENT_URL: "https://127.0.0.1" }).some((error) => /your own computer/.test(error)));
check("A wildcard website address stops it", errorsFor({ CLIENT_URL: "https://*.example.com" }).some((error) => /wildcard/.test(error)));
check("Several good website addresses are fine", errorsFor({ CLIENT_URL: "https://a.example.com, https://b.example.com" }).length === 0);
check("One bad address among good ones still stops it", errorsFor({ CLIENT_URL: "https://a.example.com,http://b.example.com" }).length === 1);
check("A missing database address stops it", errorsFor({ MONGODB_URI: "" }).some((error) => /MONGODB_URI/.test(error)));
check("The test database stops it", errorsFor({ MONGODB_URI: "mongodb+srv://u:p@c.mongodb.net/brainboard_test?x=1" }).some((error) => /_test/.test(error)));
check("A missing TRUST_PROXY stops it, and says why", errorsFor({ TRUST_PROXY: undefined }).some((error) => /TRUST_PROXY isn't set/.test(error) && /rate limits/.test(error)));
check("A bad TRUST_PROXY stops it", errorsFor({ TRUST_PROXY: "true" }).some((error) => /TRUST_PROXY/.test(error)));
check("TRUST_PROXY of 0 is allowed (a deliberate choice)", errorsFor({ TRUST_PROXY: "0" }).length === 0);

const warningsFor = (change) => productionProblems({ ...good, ...change }).warnings;
check("AI in test mode is a warning, not a stop", warningsFor({ AI_PROVIDER: "mock" }).length === 1 && errorsFor({ AI_PROVIDER: "mock" }).length === 0);
check("AI switched off is no warning", warningsFor({ AI_PROVIDER: "mock", AI_ENABLED: "false" }).length === 0);
check("Gemini with no key is a warning", warningsFor({ GEMINI_API_KEY: "" }).some((warning) => /GEMINI_API_KEY/.test(warning)));
check("The test rate-limit setting is a warning that it's ignored", warningsFor({ RATE_LIMIT_MULTIPLIER: "1000" }).some((warning) => /ignored/.test(warning)));
check("The diagnostics key is a warning to remove it", warningsFor({ DIAGNOSTICS_KEY: "abc" }).some((warning) => /DIAGNOSTICS_KEY/.test(warning)));

const everything = JSON.stringify(
  productionProblems({ ...good, JWT_SECRET: "short", MONGODB_URI: `mongodb+srv://user:${URI_PASSWORD}@c.mongodb.net/x_test`, GEMINI_API_KEY: "", DIAGNOSTICS_KEY: "diag-key-123456" })
);
check("No message ever contains a secret, a password or a key", !everything.includes(URI_PASSWORD) && !everything.includes(SECRET) && !everything.includes("diag-key-123456"));

// ---------- 4. Stopping at start-up ----------
function startUp(source) {
  const record = { logs: [], warns: [], errors: [], exits: [] };
  enforceProduction(source, {
    log: { log: (m) => record.logs.push(m), warn: (m) => record.warns.push(m), error: (m) => record.errors.push(m) },
    exit: (code) => record.exits.push(code),
  });
  return record;
}

const outside = startUp({ NODE_ENV: "development", JWT_SECRET: "x" });
check("Outside production, nothing is checked and nothing stops", outside.exits.length === 0 && outside.logs.length === 0 && outside.errors.length === 0);
check("Unset NODE_ENV is not production either", startUp({}).exits.length === 0);

const fine = startUp(good);
check("Good production settings start, and say they were checked", fine.exits.length === 0 && fine.logs.includes("Production settings checked."));

const broken = startUp({ ...good, TRUST_PROXY: undefined, CLIENT_URL: "http://localhost:3000" });
check("Bad production settings stop the server with code 1, once", same(broken.exits, [1]));
check("...and list what to fix, one line each", broken.errors[0].includes("won't start") && broken.errors.length >= 3);
check("Warnings are printed but never stop it on their own", (() => { const record = startUp({ ...good, AI_PROVIDER: "mock" }); return record.exits.length === 0 && record.warns.length === 1; })());

// ---------- 5. Measuring TRUST_PROXY on the live server ----------
const judge = (change) => judgeClientIp({ myIp: "198.51.100.7", seenIp: "198.51.100.7", forgedValue: "203.0.113.77", forgedSeenIp: "198.51.100.7", ...change });

check("Right: the server sees your address, and a faked header is ignored", judge({}).ok === true && judge({}).verdict === "correct");
check("Too high: a faked header becomes the address", judge({ forgedSeenIp: "203.0.113.77" }).verdict === "too_high" && judge({ forgedSeenIp: "203.0.113.77" }).ok === false);
check("Too high is reported even if the normal request looked right", judge({ seenIp: "198.51.100.7", forgedSeenIp: "203.0.113.77" }).verdict === "too_high");
check("Too low: the server sees the proxy instead of you", judge({ seenIp: "10.0.0.5", forgedSeenIp: "10.0.0.5" }).verdict === "too_low" && /10\.0\.0\.5/.test(judge({ seenIp: "10.0.0.5", forgedSeenIp: "10.0.0.5" }).advice));
check("IPv4 inside IPv6 (::ffff:) counts as the same address", judge({ seenIp: "::ffff:198.51.100.7", forgedSeenIp: "::ffff:198.51.100.7" }).ok === true && judge({ forgedSeenIp: "::ffff:203.0.113.77" }).verdict === "too_high");
check("Spaces around addresses don't matter", judge({ myIp: " 198.51.100.7 ", seenIp: "198.51.100.7\n" }).ok === true);
check("No answer from the server is never called 'right'", judge({ seenIp: undefined, forgedSeenIp: undefined }).ok === false && judge({ seenIp: "", forgedSeenIp: "" }).verdict === "too_low");
check("Not knowing your own address is never called 'right'", judge({ myIp: undefined, seenIp: "", forgedSeenIp: "" }).ok === false);
check("Every verdict comes with advice to act on", ["correct", "too_high", "too_low"].every((verdict) => [judge({}), judge({ forgedSeenIp: "203.0.113.77" }), judge({ seenIp: "10.0.0.5", forgedSeenIp: "10.0.0.5" })].some((entry) => entry.verdict === verdict && entry.advice.length > 30)));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);