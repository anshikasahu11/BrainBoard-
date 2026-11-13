import { ProviderError } from "../errors.js";
import { estimateTokens } from "../limits.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A pretend AI for testing: free, instant, and the same answer every time. It can also
// misbehave on purpose, when the text contains a marker:
//   [[mock:slow]]     takes about 0.6 seconds
//   [[mock:fail]]     the service is "unavailable"
//   [[mock:busy]]     the service says "too many requests"
//   [[mock:garbage]]  answers with something that isn't JSON
export function createMockProvider() {
  return {
    name: "mock",
    model: "mock",

    async generate({ system, prompt, maxOutputTokens }) {
      if (prompt.includes("[[mock:slow]]")) await sleep(600);
      if (prompt.includes("[[mock:fail]]")) throw new ProviderError("unavailable", "mock failure");
      if (prompt.includes("[[mock:busy]]")) throw new ProviderError("rate_limited", "mock busy");

      let text;
      if (prompt.includes("[[mock:garbage]]")) {
        text = "this is not json";
      } else {
        const body = prompt.match(/<document>\n([\s\S]*?)\n<\/document>/)?.[1] ?? prompt;
        const sentences = body
          .replace(/\s+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .map((sentence) => sentence.trim())
          .filter(Boolean);

        text = JSON.stringify({
          summary: `Test mode summary: ${(sentences[0] ?? "").slice(0, 160)}`,
          keyPoints: sentences.slice(0, 3).map((sentence) => sentence.slice(0, 120)),
        });
      }

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