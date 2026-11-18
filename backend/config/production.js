// The rules for running BrainBoard on the internet, as plain functions with no database and no
// server, so they can be tested alone. Nothing here ever prints or returns a secret's value.

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const OFF_WORDS = ["false", "0", "off", "no"];

// The website addresses allowed to call the API (CLIENT_URL). Several can be separated by commas.
// Each one must be an exact address: no wildcards, no path. Returns { origins, problems }.
export function parseOrigins(value, { fallback = "http://localhost:3000" } = {}) {
  const raw = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const list = raw.length > 0 ? raw : [fallback];

  const origins = [];
  const problems = [];

  for (const item of list) {
    if (item.includes("*")) {
      problems.push(`"${item}" uses a wildcard. List each address exactly, like https://app.example.com`);
      continue;
    }

    let url;
    try {
      url = new URL(item);
    } catch {
      problems.push(`"${item}" isn't a web address`);
      continue;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      problems.push(`"${item}" must start with http:// or https://`);
    } else if (url.username || url.password) {
      problems.push(`"${item}" must not contain a username or password`);
    } else if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
      problems.push(`"${item}" should be just the address, with no path, like ${url.origin}`);
    } else if (!origins.includes(url.origin)) {
      origins.push(url.origin);
    }
  }

  return { origins, problems };
}

// How many proxies sit between visitors and this server (TRUST_PROXY). Express needs the number to
// see the visitor's real address. A whole number from 0 to 10, never "true": that would believe
// anyone who claims to be any address.
export function trustProxyHops(source = process.env) {
  const raw = String(source.TRUST_PROXY ?? "").trim().toLowerCase();

  if (raw === "") return { hops: false, set: false, problem: null };
  if (raw === "false" || raw === "0") return { hops: false, set: true, problem: null };
  if (/^\d+$/.test(raw) && Number(raw) <= 10) return { hops: Number(raw), set: true, problem: null };

  return {
    hops: false,
    set: true,
    problem: `TRUST_PROXY must be a whole number from 0 to 10 (how many proxies sit in front of the server). "true" is refused on purpose, because it believes anyone who claims to be any address.`,
  };
}

// What's wrong with these settings for running on the internet? { errors, warnings }.
// Errors stop the server from starting. Warnings are just printed.
export function productionProblems(source = process.env) {
  const errors = [];
  const warnings = [];

  const secret = String(source.JWT_SECRET ?? "");
  if (secret.length < 48) {
    errors.push("JWT_SECRET is shorter than 48 characters. Make a NEW one for production, not the one from your computer.");
  } else if (/replace_with|changeme|placeholder|your[_-]|example|password/i.test(secret)) {
    errors.push("JWT_SECRET looks like a placeholder. Make a real random one.");
  }

  if (!String(source.CLIENT_URL ?? "").trim()) {
    errors.push("CLIENT_URL isn't set. It must be your website's address, like https://brainboard.example.com");
  } else {
    const { origins, problems } = parseOrigins(source.CLIENT_URL);
    for (const problem of problems) errors.push(`CLIENT_URL: ${problem}`);

    for (const origin of origins) {
      const url = new URL(origin);
      if (url.protocol !== "https:") errors.push(`CLIENT_URL contains ${origin}, which isn't https. A live site must use https.`);
      if (LOCAL_HOSTS.includes(url.hostname)) errors.push(`CLIENT_URL contains ${origin}, which is your own computer, not a live site.`);
    }
  }

  const uri = String(source.MONGODB_URI ?? "");
  if (!uri) {
    errors.push("MONGODB_URI isn't set.");
  } else {
    try {
      const name = decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, ""));
      if (name.endsWith("_test")) errors.push("MONGODB_URI points at a database whose name ends in _test, which is only for the automated checks.");
    } catch {
      // An unreadable address is reported when the server connects.
    }
  }

  const proxy = trustProxyHops(source);
  if (proxy.problem) {
    errors.push(proxy.problem);
  } else if (!proxy.set) {
    errors.push(
      "TRUST_PROXY isn't set. Set it to the number of proxies in front of the server (the deployment guide shows how to measure it). Without it, every visitor looks like the same address, so the rate limits would be shared by everyone."
    );
  }

  if (String(source.RATE_LIMIT_MULTIPLIER ?? "").trim()) {
    warnings.push("RATE_LIMIT_MULTIPLIER is set. It is ignored in production, so remove it.");
  }

  const aiOn = !OFF_WORDS.includes(String(source.AI_ENABLED ?? "true").trim().toLowerCase());
  const provider = String(source.AI_PROVIDER ?? "mock").trim().toLowerCase();
  if (aiOn && provider === "mock") {
    warnings.push("AI is in test mode, so its answers are made up. Set AI_PROVIDER=gemini and GEMINI_API_KEY, or switch AI off with AI_ENABLED=false.");
  }
  if (aiOn && provider === "gemini" && !String(source.GEMINI_API_KEY ?? "").trim()) {
    warnings.push("AI_PROVIDER is gemini but GEMINI_API_KEY isn't set, so AI will say it isn't set up.");
  }

  if (String(source.DIAGNOSTICS_KEY ?? "").trim()) {
    warnings.push("The diagnostics page is switched on (DIAGNOSTICS_KEY). Remove that setting once you've measured TRUST_PROXY.");
  }

  return { errors, warnings };
}

// Checks the settings when the server starts, but only in production. Problems stop it, with a
// plain list of what to fix. (log and exit can be swapped, so this can be tested.)
export function enforceProduction(source = process.env, { log = console, exit = (code) => process.exit(code) } = {}) {
  if (source.NODE_ENV !== "production") return;

  const { errors, warnings } = productionProblems(source);
  for (const warning of warnings) log.warn(`WARNING: ${warning}`);

  if (errors.length > 0) {
    log.error("The server won't start in production until these are fixed:");
    for (const error of errors) log.error(`  - ${error}`);
    exit(1);
    return;
  }
  log.log("Production settings checked.");
}

// ---------- Measuring TRUST_PROXY on the live server ----------

const normalizeIp = (ip) => String(ip ?? "").trim().replace(/^::ffff:/i, "");

// Given what the server saw, say whether TRUST_PROXY is right.
//   myIp:         your real public address
//   seenIp:       what the server thought a normal request came from
//   forgedValue:  an address a second request pretended to be, using an X-Forwarded-For header
//   forgedSeenIp: what the server thought that second request came from
export function judgeClientIp({ myIp, seenIp, forgedValue, forgedSeenIp }) {
  const mine = normalizeIp(myIp);
  const seen = normalizeIp(seenIp);
  const forged = normalizeIp(forgedValue);
  const forgedSeen = normalizeIp(forgedSeenIp);

  if (forged && forgedSeen === forged) {
    return {
      ok: false,
      verdict: "too_high",
      advice:
        "TRUST_PROXY is too high: a visitor can pretend to be any address by sending a header, which would let them dodge the rate limits. Lower it by one, restart, and measure again.",
    };
  }
  if (mine && seen === mine) {
    return { ok: true, verdict: "correct", advice: "TRUST_PROXY is right: the server sees your real address, and a faked header is ignored." };
  }
  return {
    ok: false,
    verdict: "too_low",
    advice: `TRUST_PROXY is too low: the server sees ${seen || "no address"} instead of your address, so every visitor would look the same and share one rate limit. Raise it by one, restart, and measure again.`,
  };
}