// Tries the REAL Gemini once, with your key from backend/.env. It sends two small requests
// (about 1,000 tokens in total) to check that your key works, your model exists, and our
// summary prompt gets an answer we can read.
//
// It works whatever AI_PROVIDER is set to, and it never prints your key.
//
// Run it from the backend folder:
//   node scripts/ai-live-check.mjs

import { ProviderError } from "../ai/errors.js";
import { SUMMARIZE_SYSTEM, buildSummarizePrompt, parseSummary } from "../ai/prompts.js";
import { createGeminiProvider } from "../ai/providers/gemini.js";
import { DEFAULT_GEMINI_MODEL, loadAiSettings } from "../ai/settings.js";

const settings = loadAiSettings();
const apiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
const model = String(process.env.GEMINI_MODEL ?? "").trim() || DEFAULT_GEMINI_MODEL;

if (!apiKey) {
  console.log("There's no GEMINI_API_KEY in backend/.env yet. Add one, then run this again.");
  process.exit(1);
}

const HINTS = {
  config:
    "Google refused the request. Check that GEMINI_API_KEY is copied exactly, with no quotes or spaces, and that GEMINI_MODEL exists (see the model list in Google AI Studio).",
  rate_limited: "Google says you've hit the free tier's limit. Wait a minute and try again.",
  timeout: "No answer in time. Check your internet connection and try again.",
  blocked: "Google blocked this request.",
  unavailable: "Couldn't get an answer. Check your internet connection and try again.",
  bad_output: "Google answered, but not in a shape we can read.",
};

function explain(error) {
  if (error instanceof ProviderError) {
    console.log(`FAILED (${error.kind}): ${error.detail}`);
    console.log(HINTS[error.kind] ?? "");
  } else {
    console.log(`FAILED: ${error?.message ?? error}`);
  }
  process.exit(1);
}

const gemini = createGeminiProvider({ apiKey, model, timeoutMs: settings.limits.timeoutMs });
console.log(`Trying Gemini with the model "${model}"...\n`);

try {
  const hello = await gemini.generate({
    system: "You answer in one short, friendly sentence.",
    prompt: "Say hello to the people who use BrainBoard.",
    maxOutputTokens: 60,
  });
  console.log(`1. It answered: ${hello.text.trim()}`);
  console.log(`   Tokens: ${hello.usage.inputTokens} in, ${hello.usage.outputTokens} out\n`);
} catch (error) {
  explain(error);
}

try {
  const sample =
    "BrainBoard is a workspace for teams. It has documents, tasks and code snippets. Everything updates live for everyone. The launch is planned for next month.";
  const answer = await gemini.generate({
    system: SUMMARIZE_SYSTEM,
    prompt: buildSummarizePrompt({ title: "About BrainBoard", text: sample }),
    maxOutputTokens: settings.limits.maxOutputTokens,
    json: true,
  });
  const summary = parseSummary(answer.text);

  console.log("2. A summary, in the shape our app expects:");
  console.log(`   ${summary.summary}`);
  summary.keyPoints.forEach((point) => console.log(`   - ${point}`));
  console.log(`   Tokens: ${answer.usage.inputTokens} in, ${answer.usage.outputTokens} out`);
  if (answer.truncated) console.log("   (The answer was cut off. Raise AI_MAX_OUTPUT_TOKENS in backend/.env.)");
} catch (error) {
  explain(error);
}

console.log("\nThe key and the model work.");