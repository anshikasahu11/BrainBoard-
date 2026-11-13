import Document from "../models/Document.js";
import AppError from "../utils/AppError.js";
import { describeProviderError } from "../ai/errors.js";
import { checkBudgets, createGuard, dayKey, estimateTokens, remainingToday } from "../ai/limits.js";
import { provider } from "../ai/provider.js";
import { SUMMARIZE_SYSTEM, buildSummarizePrompt, clipText, parseSummary } from "../ai/prompts.js";
import { aiSettings, publicAiSettings } from "../ai/settings.js";
import { getUsage, recordUsage } from "../ai/usageService.js";

// At most one AI request per person at a time, and four across the whole server, so a stuck
// loop can't fire off hundreds of calls. (Kept in this server's memory.)
const guard = createGuard({ perUser: 1, total: 4 });

function ensureAvailable() {
  if (!aiSettings.enabled) {
    throw new AppError(503, "AI features are turned off on this server.", { code: "ai_disabled" });
  }
  if (!aiSettings.configured || !provider) {
    throw new AppError(503, "AI isn't set up on this server yet.", { code: "ai_not_configured" });
  }
}

// The whole pipeline for one AI request: is it available, is a slot free, are the budgets
// fine, ask the provider, write it to the ledger, check the answer.
//   parse(text): turns the answer into the result, or throws a bad_output error.
async function runAi(req, { feature, system, prompt, json, parse }) {
  ensureAvailable();

  const slot = guard.acquire(String(req.user._id));
  if (slot.error) {
    throw new AppError(
      429,
      slot.error === "user_busy"
        ? "You already have an AI request running. Wait for it to finish."
        : "The AI is busy with other requests. Try again in a moment.",
      { code: "busy" }
    );
  }

  try {
    const { limits } = aiSettings;
    const day = dayKey();
    const used = await getUsage({ workspaceId: req.workspace._id, userId: req.user._id, day });

    const decision = checkBudgets({
      limits,
      used,
      inputTokens: estimateTokens(system) + estimateTokens(prompt),
      maxOutputTokens: limits.maxOutputTokens,
    });
    if (!decision.ok) {
      throw new AppError(429, decision.message, {
        code: decision.code,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }

    const entry = {
      workspace: req.workspace._id,
      user: req.user._id,
      day,
      feature,
      provider: provider.name,
      model: provider.model,
    };
    const started = Date.now();

    let generated;
    try {
      generated = await provider.generate({ system, prompt, maxOutputTokens: limits.maxOutputTokens, json });
    } catch (error) {
      // The real reason goes to the server log only. The member gets a calm, generic message.
      console.error(`AI request failed (${feature}, ${error?.kind ?? "error"}): ${error?.detail ?? error?.message}`);
      await recordUsage({ ...entry, status: "error", ms: Date.now() - started });

      const problem = describeProviderError(error);
      throw new AppError(problem.status, problem.message, { code: problem.code });
    }

    await recordUsage({
      ...entry,
      status: "ok",
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
      ms: Date.now() - started,
    });

    let result;
    try {
      result = parse(generated.text);
    } catch (error) {
      console.error(
        `AI answer couldn't be read (${feature}): ${error?.detail ?? error?.message}${
          generated.truncated ? " (the answer was cut off: try a higher AI_MAX_OUTPUT_TOKENS)" : ""
        }`
      );
      const problem = describeProviderError(error);
      throw new AppError(problem.status, problem.message, { code: problem.code });
    }

    return {
      result,
      meta: {
        provider: provider.name,
        model: provider.model,
        testMode: aiSettings.provider === "mock",
        usage: generated.usage,
        quota: { requestsLeft: Math.max(0, limits.userDailyRequests - (used.userRequests + 1)) },
      },
    };
  } finally {
    slot.release();
  }
}

// GET /api/workspaces/:workspaceId/ai/status
// Is AI available, and what is left for this person today? Never includes the key.
export async function aiStatus(req, res) {
  const used = await getUsage({
    workspaceId: req.workspace._id,
    userId: req.user._id,
    day: dayKey(),
  });
  const left = remainingToday({ limits: aiSettings.limits, used });

  res.json({
    available: aiSettings.configured && Boolean(provider),
    reason: !aiSettings.enabled ? "off" : aiSettings.problem ? "not_configured" : null,
    ...publicAiSettings(aiSettings),
    today: { requestsUsed: used.userRequests, requestsLeft: left.requests },
  });
}

// POST /api/workspaces/:workspaceId/ai/summarize-document   { documentId }
// Any member can ask, about a document they can already read in this workspace.
export async function summarizeDocument(req, res) {
  ensureAvailable();

  // Scoped to this workspace, so another workspace's document gets the same 404 as a missing one.
  const doc = await Document.findOne({ _id: req.body.documentId, workspace: req.workspace._id }).select(
    "title +plainText"
  );
  if (!doc) throw new AppError(404, "Document not found");

  const text = (doc.plainText ?? "").trim();
  if (!text) {
    throw new AppError(400, "This document has no text to summarize yet.", { code: "nothing_to_summarize" });
  }

  const { text: clipped, truncated } = clipText(text, aiSettings.limits.maxInputChars);

  const outcome = await runAi(req, {
    feature: "summarize-document",
    system: SUMMARIZE_SYSTEM,
    prompt: buildSummarizePrompt({ title: doc.title, text: clipped }),
    json: true,
    parse: parseSummary,
  });

  res.json({ result: outcome.result, truncated, ...outcome.meta });
}