// The spending rules, as plain functions with no database, so they can be tested alone.

// "2026-11-13": the day a request counts against. One clock for everyone (UTC).
export const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);

// How long until the daily budgets reset, at midnight UTC.
export function secondsUntilNextDay(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

// A cautious guess at how many tokens some text is (about one per 3 characters).
export const estimateTokens = (text) => Math.ceil(String(text ?? "").length / 3);

// May this request go ahead?
//   limits: { userDailyRequests, workspaceDailyTokens, globalDailyTokens }
//   used:   { userRequests, workspaceTokens, globalTokens }  (so far today)
// It reserves the WORST case (all the input plus the longest possible answer), so a request
// that could push a budget over its limit never starts.
// Returns { ok: true } or { ok: false, code, message, retryAfterSeconds }.
export function checkBudgets({ limits, used, inputTokens, maxOutputTokens, now = new Date() }) {
  const needed = inputTokens + maxOutputTokens;
  const retryAfterSeconds = secondsUntilNextDay(now);

  if (used.userRequests >= limits.userDailyRequests) {
    return {
      ok: false,
      code: "user_daily_limit",
      message: `You've used all ${limits.userDailyRequests} of your AI requests for today. They reset at 00:00 UTC.`,
      retryAfterSeconds,
    };
  }

  if (used.workspaceTokens + needed > limits.workspaceDailyTokens) {
    return {
      ok: false,
      code: "workspace_daily_budget",
      message: "This workspace has used its AI allowance for today. It resets at 00:00 UTC.",
      retryAfterSeconds,
    };
  }

  if (used.globalTokens + needed > limits.globalDailyTokens) {
    return {
      ok: false,
      code: "global_daily_budget",
      message: "AI is paused for today to keep usage under control. Try again tomorrow.",
      retryAfterSeconds,
    };
  }

  return { ok: true };
}

// What's left today, never below zero.
export function remainingToday({ limits, used }) {
  return {
    requests: Math.max(0, limits.userDailyRequests - used.userRequests),
    workspaceTokens: Math.max(0, limits.workspaceDailyTokens - used.workspaceTokens),
    globalTokens: Math.max(0, limits.globalDailyTokens - used.globalTokens),
  };
}

// Limits how many AI requests run at once: `perUser` for one person, `total` for everyone.
// acquire(key) returns { release } (call it when the request ends) or { error }.
export function createGuard({ perUser = 1, total = 4 } = {}) {
  const active = new Map();
  let running = 0;

  return {
    acquire(key) {
      if ((active.get(key) ?? 0) >= perUser) return { error: "user_busy" };
      if (running >= total) return { error: "server_busy" };

      active.set(key, (active.get(key) ?? 0) + 1);
      running += 1;

      let released = false;
      return {
        release() {
          if (released) return; // releasing twice must never free someone else's slot
          released = true;
          running -= 1;

          const left = (active.get(key) ?? 1) - 1;
          if (left <= 0) active.delete(key);
          else active.set(key, left);
        },
      };
    },
    stats: () => ({ running, people: active.size }),
  };
}