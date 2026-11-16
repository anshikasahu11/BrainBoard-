// The security headers the website sends with every page. Plain JavaScript with no imports, so
// next.config.mjs can use it and it can be tested alone.

const HOST = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

// The origins the page is allowed to talk to for data: the API, and its live connection.
// The address is PARSED, and its host checked character by character, so a hostile or mistyped
// value can never add rules of its own to the policy.
export function apiOrigins(apiUrl) {
  try {
    const url = new URL(apiUrl);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !HOST.test(url.host)) return [];

    return [url.origin, `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`];
  } catch {
    return [];
  }
}

// The Content-Security-Policy: which places the page may load things from, and talk to.
export function buildCsp({ isProd, apiUrl }) {
  const directives = {
    "default-src": ["'self'"],
    // Next.js starts every page with small inline scripts, so scripts allow 'unsafe-inline'.
    // 'unsafe-eval' is only for the development tools, never on the live site.
    "script-src": ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    // Where the page may send data. This is what stops an injected script sending it elsewhere.
    "connect-src": ["'self'", ...apiOrigins(apiUrl), ...(isProd ? [] : ["ws://localhost:*", "ws://127.0.0.1:*"])],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"], // nobody may put this site in a frame
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

// The list Next.js wants from headers(). reportOnly makes the policy report problems in the
// browser's Console instead of blocking them (set CSP_REPORT_ONLY=true to switch it on).
export function securityHeaders({ isProd, apiUrl, reportOnly = false }) {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: buildCsp({ isProd, apiUrl }) },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    },
  ];
}