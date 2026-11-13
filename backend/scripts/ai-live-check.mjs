// Tries the REAL Gemini, with your key from backend/.env. It sends five small requests (about
// 6,000 tokens in total) to check that your key works, your model exists, and every prompt we use
// gets an answer our checks accept.
//
// It works whatever AI_PROVIDER is set to, and it never prints your key.
//
// Run it from the backend folder:
//   node scripts/ai-live-check.mjs

import { ProviderError } from "../ai/errors.js";
import { estimateTokens } from "../ai/limits.js";
import { SUMMARIZE_SYSTEM, buildSummarizePrompt, parseSummary } from "../ai/prompts.js";
import { createGeminiProvider } from "../ai/providers/gemini.js";
import { DEFAULT_GEMINI_MODEL, loadAiSettings } from "../ai/settings.js";
import {
  EXPLAIN_SYSTEM,
  IMPROVE_SYSTEM,
  buildExplainPrompt,
  buildImprovePrompt,
  parseExplanation,
  parseImprovement,
  riskNotes,
} from "../ai/snippetPrompts.js";
import { TASKS_SYSTEM, buildTasksPrompt, parseTaskProposals } from "../ai/taskProposals.js";

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
  bad_output:
    "Google answered, but not in a shape we can read. If the answer was cut off, raise AI_MAX_OUTPUT_TOKENS in backend/.env.",
};

function explain(label, error) {
  console.log(`\nFAILED at "${label}"`);
  if (error instanceof ProviderError) {
    console.log(`(${error.kind}) ${error.detail}`);
    console.log(HINTS[error.kind] ?? "");
  } else {
    console.log(error?.message ?? error);
  }
  process.exit(1);
}

const gemini = createGeminiProvider({ apiKey, model, timeoutMs: settings.limits.timeoutMs });
const tokens = (answer) => `   Tokens: ${answer.usage.inputTokens} in, ${answer.usage.outputTokens} out`;
const room = settings.limits.maxOutputTokens;

async function attempt(label, work) {
  try {
    await work();
  } catch (error) {
    explain(label, error);
  }
}

console.log(`Trying Gemini with the model "${model}"...\n`);

await attempt("hello", async () => {
  const hello = await gemini.generate({
    system: "You answer in one short, friendly sentence.",
    prompt: "Say hello to the people who use BrainBoard.",
    maxOutputTokens: 60,
  });
  console.log(`1. It answered: ${hello.text.trim()}`);
  console.log(`${tokens(hello)}\n`);
});

await attempt("summary", async () => {
  const sample =
    "BrainBoard is a workspace for teams. It has documents, tasks and code snippets. Everything updates live for everyone. The launch is planned for next month.";
  const answer = await gemini.generate({
    system: SUMMARIZE_SYSTEM,
    prompt: buildSummarizePrompt({ title: "About BrainBoard", text: sample }),
    maxOutputTokens: room,
    json: true,
  });
  const result = parseSummary(answer.text);

  console.log("2. A summary:");
  console.log(`   ${result.summary}`);
  result.keyPoints.forEach((point) => console.log(`   - ${point}`));
  console.log(`${tokens(answer)}\n`);
});

const sampleCode = [
  "function total(items) {",
  "  let sum = 0;",
  "  for (var i = 0; i <= items.length; i++) {",
  "    sum += items[i].price;",
  "  }",
  "  return sum;",
  "}",
].join("\n");

await attempt("explain", async () => {
  const answer = await gemini.generate({
    system: EXPLAIN_SYSTEM,
    prompt: buildExplainPrompt({ title: "Add up prices", language: "javascript", code: sampleCode }),
    maxOutputTokens: room,
    json: true,
  });
  const result = parseExplanation(answer.text);

  console.log("3. An explanation of a small function:");
  console.log(`   ${result.overview}`);
  result.steps.forEach((step) => console.log(`   - ${step}`));
  result.watchOutFor.forEach((note) => console.log(`   ! ${note}`));
  console.log(`${tokens(answer)}\n`);
});

await attempt("improve", async () => {
  const answer = await gemini.generate({
    system: IMPROVE_SYSTEM,
    prompt: buildImprovePrompt({ title: "Add up prices", language: "javascript", code: sampleCode, goal: "bugs" }),
    maxOutputTokens: Math.min(8000, Math.max(room, estimateTokens(sampleCode) + 800)),
    json: true,
  });
  const result = parseImprovement(answer.text);

  console.log("4. An improvement (the function has an off-by-one bug on purpose):");
  console.log(`   ${result.summary}`);
  result.suggestions.forEach((item) => console.log(`   - ${item.title}: ${item.reason}`));
  console.log(
    result.improvedCode
      .split("\n")
      .map((codeLine) => `   | ${codeLine}`)
      .join("\n")
  );
  riskNotes(sampleCode, result.improvedCode).forEach((note) => console.log(`   ! ${note}`));
  console.log(`${tokens(answer)}\n`);
});

await attempt("tasks", async () => {
  const members = [
    { id: "p1", name: "Priya" },
    { id: "r1", name: "Rahul" },
  ];
  const notes =
    "Weekly sync. Priya will update the pricing page by Friday. Rahul needs to fix the login bug, it's urgent. Someone should book the venue for the launch party.";

  const answer = await gemini.generate({
    system: TASKS_SYSTEM,
    prompt: buildTasksPrompt({ text: notes, today: "2026-11-13", memberNames: members.map((member) => member.name) }),
    maxOutputTokens: room,
    json: true,
  });
  const result = parseTaskProposals(answer.text, { members });

  console.log('5. Tasks proposed from sample notes (today is "2026-11-13", a Friday):');
  result.tasks.forEach((task) =>
    console.log(
      `   - ${task.title} [${task.priority}] due ${task.dueDate ?? "no date"}, for ${task.assignee?.name ?? "nobody"}`
    )
  );
  console.log(`   (${result.skipped} skipped as unusable)`);
  console.log(`${tokens(answer)}`);
});

console.log("\nThe key and the model work, and every prompt got an answer we can read.");