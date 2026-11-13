import { aiSettings } from "./settings.js";
import { createGeminiProvider } from "./providers/gemini.js";
import { createMockProvider } from "./providers/mock.js";

// Picks the provider from the settings. null means "the AI isn't available" (turned off,
// or a missing key). This is the only file that knows which providers exist.
export function createProvider(settings) {
  if (!settings.configured) return null;

  if (settings.provider === "gemini") {
    return createGeminiProvider({
      apiKey: settings.apiKey,
      model: settings.model,
      timeoutMs: settings.limits.timeoutMs,
    });
  }
  if (settings.provider === "mock") return createMockProvider();
  return null;
}

export const provider = createProvider(aiSettings);