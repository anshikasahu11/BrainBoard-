import Document from "../models/Document.js";
import Membership from "../models/Membership.js";
import Snippet from "../models/Snippet.js";
import AppError from "../utils/AppError.js";
import { describeProviderError } from "../ai/errors.js";
import { checkBudgets, createGuard, dayKey, estimateTokens, remainingToday } from "../ai/limits.js";
import { provider } from "../ai/provider.js";
import { SUMMARIZE_SYSTEM, buildSummarizePrompt, clipText, parseSummary } from "../ai/prompts.js";
import { aiSettings, publicAiSettings } from "../ai/settings.js";
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
import { getUsage, recordUsage } from "../ai/usageService.js";

// At most one AI request per person at a time, and four across the whole server, so a stuck
// loop can't fire off hundreds of calls. (Kept in this server's memory.)
const guard = createGuard({ perUser: 1, total: 4 });

const MAX_SNIPPET_CHARS = 50000; // the most a snippet can hold
const HARD_OUTPUT_CAP = 8000; // no answer may ever be asked to be longer than this many tokens

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
//   parse(text):      turns the answer into the result, or throws a bad_output error.
//   maxOutputTokens:  optional, for answers that need more room than usual (a rewritten snippet).
async function runAi(req, { feature, system, prompt, json, parse, maxOutputTokens: wanted }) {
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
    const maxOutputTokens = Math.min(HARD_OUTPUT_CAP, wanted ?? limits.maxOutputTokens);
    const day = dayKey();
    const used = await getUsage({ workspaceId: req.workspace._id, userId: req.user._id, day });

    const decision = checkBudgets({
      limits,
      used,
      inputTokens: estimateTokens(system) + estimateTokens(prompt),
      maxOutputTokens,
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
      generated = await provider.generate({ system, prompt, maxOutputTokens, json });
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

// POST .../ai/summarize-document   { documentId }
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

// Loads a snippet WITH its code, from this workspace only.
async function loadSnippet(req) {
  const snippet = await Snippet.findOne({ _id: req.body.snippetId, workspace: req.workspace._id }).select(
    "title language +code"
  );
  if (!snippet) throw new AppError(404, "Snippet not found");
  return snippet;
}

// POST .../ai/explain-snippet   { snippetId }
export async function explainSnippet(req, res) {
  ensureAvailable();

  const snippet = await loadSnippet(req);
  const code = snippet.code ?? "";
  if (!code.trim()) throw new AppError(400, "This snippet has no code to explain.", { code: "nothing_to_explain" });

  // A very long snippet is clipped (the start is still worth explaining), and the reply says so.
  const { text: clipped, truncated } = clipText(code, aiSettings.limits.maxInputChars);

  const outcome = await runAi(req, {
    feature: "explain-snippet",
    system: EXPLAIN_SYSTEM,
    prompt: buildExplainPrompt({ title: snippet.title, language: snippet.language, code: clipped }),
    json: true,
    parse: parseExplanation,
  });

  res.json({ result: outcome.result, truncated, ...outcome.meta });
}

// POST .../ai/improve-snippet   { snippetId, goal? }
// The improved code is returned as TEXT. It is never run and never saved here: the person
// copies it or saves it themselves.
export async function improveSnippet(req, res) {
  ensureAvailable();

  const snippet = await loadSnippet(req);
  const code = snippet.code ?? "";
  if (!code.trim()) throw new AppError(400, "This snippet has no code to improve.", { code: "nothing_to_improve" });

  // Improving a clipped snippet would hand back a chopped copy, so a long one is refused instead.
  const limit = aiSettings.limits.maxInputChars;
  if (code.length > limit) {
    throw new AppError(
      400,
      `This snippet is too long to improve (the limit is ${limit.toLocaleString("en-US")} characters).`,
      { code: "too_long" }
    );
  }

  const outcome = await runAi(req, {
    feature: "improve-snippet",
    system: IMPROVE_SYSTEM,
    prompt: buildImprovePrompt({
      title: snippet.title,
      language: snippet.language,
      code,
      goal: req.body.goal,
    }),
    json: true,
    // An improved copy is about as long as the original, so allow for that.
    maxOutputTokens: Math.max(aiSettings.limits.maxOutputTokens, estimateTokens(code) + 800),
    parse: (raw) => parseImprovement(raw, { maxCodeChars: MAX_SNIPPET_CHARS }),
  });

  const improved = outcome.result.improvedCode;
  res.json({
    result: outcome.result,
    unchanged: improved.trim() === code.trim(),
    warnings: riskNotes(code, improved),
    ...outcome.meta,
  });
}

// POST .../ai/tasks-from-text   { text } or { documentId }, and optionally { today }
// Returns PROPOSED tasks. Nothing is created: the person reviews them and adds the ones they want.
export async function tasksFromText(req, res) {
  ensureAvailable();

  let source = req.body.text ?? "";
  if (req.body.documentId) {
    const doc = await Document.findOne({ _id: req.body.documentId, workspace: req.workspace._id }).select(
      "title +plainText"
    );
    if (!doc) throw new AppError(404, "Document not found");
    source = doc.plainText ?? "";
  }

  if (!source.trim()) {
    throw new AppError(400, "There's nothing to turn into tasks yet.", { code: "nothing_to_propose" });
  }

  const { text, truncated } = clipText(source, aiSettings.limits.maxInputChars);

  // The people the AI may choose from, and the ONLY people a proposal can be assigned to.
  const memberships = await Membership.find({ workspace: req.workspace._id }).populate({
    path: "user",
    select: "name",
  });
  const members = memberships.filter((membership) => membership.user).map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
  }));

  const outcome = await runAi(req, {
    feature: "tasks-from-text",
    system: TASKS_SYSTEM,
    prompt: buildTasksPrompt({
      text,
      today: req.body.today ?? dayKey(),
      memberNames: members.map((member) => member.name),
    }),
    json: true,
    parse: (raw) => parseTaskProposals(raw, { members }),
  });

  res.json({ result: outcome.result, truncated, ...outcome.meta });
}