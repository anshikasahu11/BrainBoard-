import { ProviderError } from "../errors.js";
import { estimateTokens } from "../limits.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The text between <tag> and </tag> in a prompt.
const section = (prompt, tag) => prompt.match(new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`))?.[1] ?? "";

const sentencesOf = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

// Deliberately awful proposals, to test our own checking.
const MESSY_TASKS = [
  { title: "  Valid task  ", description: "d".repeat(2000), priority: "HIGH", dueDate: "2026-12-01", assigneeName: "rahul" },
  { title: "Bad priority", priority: "critical!!!", dueDate: "2026-02-30", assigneeName: "Nobody Here" },
  { title: "valid TASK" },
  { title: "" },
  { title: 42 },
  "not an object",
  null,
  { title: "x".repeat(500) },
  { title: "Has\u0000control", description: "<script>alert(1)</script>" },
  ...Array.from({ length: 30 }, (_, index) => ({ title: `Filler ${index}` })),
];

function answerFor(prompt) {
  // The action is named in the first block of the prompt, which only our code writes.
  const head = prompt.split("\n\n", 1)[0];
  const action = head.match(/^Action: (\w+)$/m)?.[1];

  if (action === "explain") {
    const lines = section(prompt, "snippet_code")
      .split("\n")
      .map((codeLine) => codeLine.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((codeLine) => codeLine.slice(0, 100));

    return {
      overview: `Test mode explanation: ${lines[0] ?? "(empty)"}`,
      steps: lines,
      watchOutFor: ["Test mode: no real analysis was done."],
    };
  }

  if (action === "improve") {
    const code = section(prompt, "snippet_code");

    if (prompt.includes("[[mock:messy]]")) {
      return {
        summary: "ok",
        suggestions: [
          ...Array.from({ length: 10 }, (_, index) => ({ title: `Suggestion ${index}`, reason: "r".repeat(900) })),
          5,
          null,
          { title: "" },
          { reason: "no title" },
        ],
        improvedCode: "line1\r\nline2\u0000\u0007",
      };
    }

    let improvedCode = `// reviewed in test mode\n${code}`;
    if (prompt.includes("[[mock:same]]")) improvedCode = code;
    if (prompt.includes("[[mock:risky]]")) improvedCode = `${code}\neval(userInput);`;

    return {
      summary: "Test mode: no real review was done.",
      suggestions: [{ title: "Add a comment", reason: "Test mode suggestion." }],
      improvedCode,
    };
  }

  if (action === "tasks") {
    if (prompt.includes("[[mock:messy]]")) return { tasks: MESSY_TASKS };

    const people = (prompt.match(/^People: (.*)$/m)?.[1] ?? "").split(", ").filter((name) => name && name !== "none");

    return {
      tasks: sentencesOf(section(prompt, "notes_text"))
        .slice(0, 3)
        .map((sentence) => ({
          title: sentence.replace(/\[\[mock:[a-z]+\]\]\s*/gi, "").slice(0, 80) || "Task",
          description: "",
          priority: /urgent/i.test(sentence) ? "urgent" : "medium",
          dueDate: sentence.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
          assigneeName: people.find((name) => sentence.includes(name)) ?? null,
        })),
    };
  }

  // A document summary.
  const sentences = sentencesOf(section(prompt, "document") || prompt);
  return {
    summary: `Test mode summary: ${(sentences[0] ?? "").slice(0, 160)}`,
    keyPoints: sentences.slice(0, 3).map((sentence) => sentence.slice(0, 120)),
  };
}

// A pretend AI for testing: free, instant, and the same answer every time. It can also
// misbehave on purpose, when the text contains a marker:
//   [[mock:slow]]     takes about 0.6 seconds
//   [[mock:fail]]     the service is "unavailable"
//   [[mock:busy]]     the service says "too many requests"
//   [[mock:garbage]]  answers with something that isn't JSON
//   [[mock:messy]]    answers with junk-filled but well-formed JSON (tasks, improvements)
//   [[mock:risky]]    the "improved" code adds an eval call
//   [[mock:same]]     the "improved" code is the original, unchanged
export function createMockProvider() {
  return {
    name: "mock",
    model: "mock",

    async generate({ system, prompt, maxOutputTokens }) {
      if (prompt.includes("[[mock:slow]]")) await sleep(600);
      if (prompt.includes("[[mock:fail]]")) throw new ProviderError("unavailable", "mock failure");
      if (prompt.includes("[[mock:busy]]")) throw new ProviderError("rate_limited", "mock busy");

      const text = prompt.includes("[[mock:garbage]]") ? "this is not json" : JSON.stringify(answerFor(prompt));

      return {
        text,
        usage: {
          inputTokens: estimateTokens(system) + estimateTokens(prompt),
          outputTokens: Math.min(estimateTokens(text), maxOutputTokens),
        },
        truncated: false,
      };
    },
  };
}