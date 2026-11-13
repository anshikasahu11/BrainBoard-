// What can go wrong when talking to an AI provider, and what a member is told about it.
// The detail is for the server log only. It never reaches a browser.

export class ProviderError extends Error {
  // kind: rate_limited | timeout | config | blocked | unavailable | bad_output
  constructor(kind, detail = "") {
    super(detail || kind);
    this.name = "ProviderError";
    this.kind = kind;
    this.detail = detail;
  }
}

const MESSAGES = {
  rate_limited: {
    status: 429,
    code: "provider_busy",
    message: "The AI service is busy right now. Try again in a minute.",
  },
  timeout: {
    status: 504,
    code: "provider_timeout",
    message: "The AI took too long to answer. Try again.",
  },
  config: {
    status: 503,
    code: "ai_not_configured",
    message: "The AI isn't set up correctly on this server.",
  },
  blocked: {
    status: 422,
    code: "ai_blocked",
    message: "The AI couldn't work with that text.",
  },
  unavailable: {
    status: 502,
    code: "provider_unavailable",
    message: "The AI service is unavailable right now. Try again shortly.",
  },
  bad_output: {
    status: 502,
    code: "bad_output",
    message: "The AI's answer couldn't be read. Try again.",
  },
};

// { status, code, message } for any error. Anything unexpected is treated as "unavailable".
export function describeProviderError(error) {
  const kind = error instanceof ProviderError ? error.kind : "unavailable";
  return MESSAGES[kind] ?? MESSAGES.unavailable;
}