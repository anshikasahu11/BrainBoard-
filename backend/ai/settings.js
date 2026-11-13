import "dotenv/config";

// Everything about how the AI assistant is configured. It's read from backend/.env when the
// server starts. If you change .env, restart the backend.

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const PROVIDERS = ["mock", "gemini"];
const OFF_WORDS = new Set(["false", "0", "off", "no"]);

// A whole number inside a range, or the fallback if it's missing, not a number, or out of range.
function whole(value, fallback, min, max) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return fallback;

  const number = Number(text);
  return number >= min && number <= max ? number : fallback;
}

// Builds the settings from environment variables (or from any plain object, for tests).
// problem: why the AI can't run (a missing key, a typo), or null.
// The key is kept here for the provider only. It never goes to a browser and is never logged.
export function loadAiSettings(source = process.env) {
  const provider = String(source.AI_PROVIDER ?? "mock").trim().toLowerCase();
  const apiKey = String(source.GEMINI_API_KEY ?? "").trim();
  const model = String(source.GEMINI_MODEL ?? "").trim() || DEFAULT_GEMINI_MODEL;
  const enabled = !OFF_WORDS.has(String(source.AI_ENABLED ?? "true").trim().toLowerCase());

  let problem = null;
  if (!PROVIDERS.includes(provider)) {
    problem = `AI_PROVIDER must be "mock" or "gemini" (it is "${provider}")`;
  } else if (provider === "gemini") {
    if (!apiKey) problem = "GEMINI_API_KEY is missing";
    else if (/\s/.test(apiKey)) problem = "GEMINI_API_KEY contains spaces";
    else if (!/^[a-z0-9][a-z0-9._-]{1,60}$/i.test(model)) problem = "GEMINI_MODEL doesn't look like a model name";
  }

  return {
    enabled,
    provider,
    apiKey,
    model: provider === "gemini" ? model : "mock",
    problem,
    configured: enabled && problem === null,
    limits: {
      userDailyRequests: whole(source.AI_USER_DAILY_REQUESTS, 30, 1, 1000),
      workspaceDailyTokens: whole(source.AI_WORKSPACE_DAILY_TOKENS, 150000, 1000, 50000000),
      globalDailyTokens: whole(source.AI_GLOBAL_DAILY_TOKENS, 500000, 1000, 500000000),
      maxInputChars: whole(source.AI_MAX_INPUT_CHARS, 30000, 1000, 200000),
      maxOutputTokens: whole(source.AI_MAX_OUTPUT_TOKENS, 1000, 50, 8000),
      timeoutMs: whole(source.AI_TIMEOUT_MS, 30000, 1000, 120000),
    },
  };
}

export const aiSettings = loadAiSettings();

// The part that is safe to show a signed-in browser: no key, no internal reasons.
export function publicAiSettings(settings = aiSettings) {
  return {
    provider: settings.provider,
    model: settings.model,
    testMode: settings.provider === "mock",
    limits: {
      userDailyRequests: settings.limits.userDailyRequests,
      maxInputChars: settings.limits.maxInputChars,
    },
  };
}