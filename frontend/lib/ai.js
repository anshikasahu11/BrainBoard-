// Helpers for the AI screens: wording, messages, quota text and what gets copied.
// Plain JavaScript with no imports, so it can be tested on its own.

// The goals for improving code. These match the ones the server accepts.
export const GOALS = [
  { value: "general", label: "Anything worth improving" },
  { value: "readability", label: "Make it easier to read" },
  { value: "performance", label: "Make it faster" },
  { value: "bugs", label: "Find and fix bugs" },
];

// Who is processing the text, in words. `status` is the server's answer to "is AI available?".
export function providerLabel(status) {
  if (!status) return "an AI service";
  if (status.testMode) return "Test mode";
  if (status.provider === "gemini") return "Google Gemini";
  return "an AI service";
}

// What to tell people about where their text goes.
export function privacyNote(status) {
  if (status?.testMode) {
    return "Test mode: nothing is sent to any AI service, and the answers are made up.";
  }
  if (status?.provider === "gemini") {
    return "The text you ask about is sent to Google Gemini to be processed. Free plans may use it to improve the service, so don’t send anything private or confidential.";
  }
  return "The text you ask about is sent to an AI service to be processed. Don’t send anything private or confidential.";
}

// Can AI be used right now, and if not, why in plain words.
export function availability(status) {
  if (!status) return { usable: false, message: "" };
  if (status.available) return { usable: true, message: "" };
  if (status.reason === "off") {
    return { usable: false, message: "AI features are turned off on this server." };
  }
  return {
    usable: false,
    message: "AI isn’t set up on this server yet. Whoever runs this server needs to finish setting it up.",
  };
}

// "28 of 30 AI requests left today"
export function quotaText(left, total) {
  if (!Number.isFinite(left)) return "";
  if (left <= 0) return "No AI requests left today";

  const of = Number.isFinite(total) ? ` of ${total}` : "";
  return `${left}${of} AI ${left === 1 ? "request" : "requests"} left today`;
}

// "about 5 hours", "about 12 minutes", "less than a minute". Empty when there's nothing to say.
export function formatWait(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (total < 60) return "less than a minute";

  const minutes = Math.round(total / 60);
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

  const hours = Math.round(total / 3600);
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

// What to show when a request fails. `error` is what the API helper throws:
// { message, status, errors: { code, retryAfterSeconds } }.
// The server's own message is already safe for members, so it's used as it is. This adds a
// hint, and says whether trying again could help.
export function describeProblem(error) {
  const code = error?.errors?.code ?? "";
  const wait = formatWait(error?.errors?.retryAfterSeconds);
  const status = error?.status ?? 0;
  const message = String(error?.message || "Something went wrong. Try again.");

  switch (code) {
    case "user_daily_limit":
    case "workspace_daily_budget":
    case "global_daily_budget":
      return {
        message,
        hint: wait ? `This resets in ${wait}.` : "This resets at 00:00 UTC.",
        canRetry: false,
      };
    case "provider_busy":
      return { message, hint: "Free plans have limits. Wait a minute, then try again.", canRetry: true };
    case "busy":
    case "provider_timeout":
    case "provider_unavailable":
    case "bad_output":
      return { message, hint: "", canRetry: true };
    case "too_long":
      return { message, hint: "Try “Explain” instead, which uses the start of the code.", canRetry: false };
    case "ai_disabled":
    case "ai_not_configured":
    case "ai_blocked":
    case "nothing_to_summarize":
    case "nothing_to_explain":
    case "nothing_to_improve":
    case "nothing_to_propose":
      return { message, hint: "", canRetry: false };
    default:
      return { message, hint: "", canRetry: status === 0 || status >= 500 };
  }
}

// A summary as plain text, for copying.
export function summaryAsText({ summary = "", keyPoints = [] }) {
  const blocks = [];
  if (summary) blocks.push(summary);
  if (keyPoints.length > 0) blocks.push(keyPoints.map((point) => `- ${point}`).join("\n"));
  return blocks.join("\n\n");
}

// An explanation as plain text, for copying.
export function explanationAsText({ overview = "", steps = [], watchOutFor = [] }) {
  const blocks = [];
  if (overview) blocks.push(overview);
  if (steps.length > 0) {
    blocks.push(["Steps:", ...steps.map((step, index) => `${index + 1}. ${step}`)].join("\n"));
  }
  if (watchOutFor.length > 0) {
    blocks.push(["Watch out for:", ...watchOutFor.map((note) => `- ${note}`)].join("\n"));
  }
  return blocks.join("\n\n");
}