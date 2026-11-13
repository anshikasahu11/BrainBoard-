import { ProviderError } from "../errors.js";
import { estimateTokens } from "../limits.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Reasons Google gives for refusing to answer.
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

const count = (value) => (Number.isFinite(value) ? value : 0);

function fromHttpError(status, data, scrub) {
  const message = scrub(data?.error?.message ?? `HTTP ${status}`);

  if (status === 429) return new ProviderError("rate_limited", message);
  if (status === 401 || status === 403) {
    return new ProviderError("config", `Google rejected the key or the request (${status}): ${message}`);
  }
  if (status === 404) return new ProviderError("config", `Model not found: ${message}`);
  if (status === 400) return new ProviderError("config", `Google refused the request: ${message}`);
  return new ProviderError("unavailable", `Google returned ${status}: ${message}`);
}

// Talks to Gemini over plain HTTP. The key travels in a header, never in the address, and is
// scrubbed out of anything that gets logged.
//   fetchImpl: swapped for a fake in tests.
export function createGeminiProvider({ apiKey, model, timeoutMs = 30000, fetchImpl = globalThis.fetch }) {
  const scrub = (text) => String(text ?? "").split(apiKey).join("[key]").slice(0, 300);

  return {
    name: "gemini",
    model,

    async generate({ system, prompt, maxOutputTokens, json = false }) {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.2,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      };

      let response;
      try {
        response = await fetchImpl(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          throw new ProviderError("timeout", `No answer within ${timeoutMs} ms`);
        }
        throw new ProviderError("unavailable", `Couldn't reach Google: ${scrub(error?.cause?.code ?? error?.message)}`);
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        // Not JSON. Handled below.
      }

      if (!response.ok) throw fromHttpError(response.status, data, scrub);

      if (data?.promptFeedback?.blockReason) {
        throw new ProviderError("blocked", `Prompt blocked: ${data.promptFeedback.blockReason}`);
      }

      const candidate = data?.candidates?.[0];
      if (!candidate) throw new ProviderError("unavailable", "The response had no answer in it");

      const finish = candidate.finishReason ?? "";
      const text = (candidate.content?.parts ?? [])
        .filter((part) => typeof part?.text === "string" && !part.thought) // skip "thinking" parts
        .map((part) => part.text)
        .join("");

      if (!text && BLOCKED.has(finish)) throw new ProviderError("blocked", `Answer blocked: ${finish}`);

      // What it cost. Reasoning ("thinking") tokens are billed as output, so they count as output.
      const meta = data.usageMetadata ?? {};
      const inputTokens = Number.isFinite(meta.promptTokenCount)
        ? meta.promptTokenCount
        : estimateTokens(system) + estimateTokens(prompt);

      const reported = count(meta.candidatesTokenCount) + count(meta.thoughtsTokenCount);
      const outputTokens =
        reported > 0
          ? reported
          : count(meta.totalTokenCount) > inputTokens
            ? meta.totalTokenCount - inputTokens
            : estimateTokens(text);

      return { text, usage: { inputTokens, outputTokens }, truncated: finish === "MAX_TOKENS" };
    },
  };
}