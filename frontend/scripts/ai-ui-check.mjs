// A self-test for the AI screens' helpers. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/ai-ui-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import {
  GOALS,
  availability,
  describeProblem,
  explanationAsText,
  formatWait,
  privacyNote,
  providerLabel,
  quotaText,
  summaryAsText,
} from "../lib/ai.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the AI screens' helpers\n");

// 1. Who processes the text
check("Test mode is named as test mode", providerLabel({ testMode: true, provider: "mock" }) === "Test mode");
check("Gemini is named", providerLabel({ testMode: false, provider: "gemini" }) === "Google Gemini");
check("An unknown or missing provider gets a generic name", providerLabel({ provider: "other" }) === "an AI service" && providerLabel(null) === "an AI service");

check("Test mode says nothing is sent anywhere", /nothing is sent/.test(privacyNote({ testMode: true })));
check(
  "Gemini's note names Google Gemini, warns about free plans, and says not to send private text",
  (() => {
    const note = privacyNote({ testMode: false, provider: "gemini" });
    return /Google Gemini/.test(note) && /Free plans/.test(note) && /private/.test(note);
  })()
);
check("An unknown provider still gets an honest note", /AI service/.test(privacyNote({ provider: "other" })) && /private/.test(privacyNote(null)));

// 2. Is AI available
check("Available means usable, with nothing to say", same(availability({ available: true }), { usable: true, message: "" }));
check("Turned off says so", (() => { const out = availability({ available: false, reason: "off" }); return !out.usable && /turned off/.test(out.message); })());
check("Not set up says so, and who has to fix it", (() => { const out = availability({ available: false, reason: "not_configured" }); return !out.usable && /set up/.test(out.message) && /server/.test(out.message); })());
check("No answer yet means not usable, and no message", same(availability(null), { usable: false, message: "" }) && same(availability(undefined), { usable: false, message: "" }));

// 3. Quota
check("Quota with a total", quotaText(28, 30) === "28 of 30 AI requests left today");
check("One request left is singular", quotaText(1, 30) === "1 of 30 AI request left today");
check("None left says so", quotaText(0, 30) === "No AI requests left today" && quotaText(-3, 30) === "No AI requests left today");
check("Without a total it still reads well", quotaText(5) === "5 AI requests left today");
check("Nothing known gives nothing", quotaText(undefined, 30) === "" && quotaText(NaN, 30) === "" && quotaText(null, 30) === "");

// 4. Waiting times
check("Under a minute", formatWait(1) === "less than a minute" && formatWait(59) === "less than a minute");
check("Minutes", formatWait(60) === "about 1 minute" && formatWait(90) === "about 2 minutes" && formatWait(3540) === "about 59 minutes");
check("Just under an hour rounds up to an hour", formatWait(3570) === "about 1 hour");
check("Hours", formatWait(7200) === "about 2 hours" && formatWait(18000) === "about 5 hours" && formatWait(86400) === "about 24 hours");
check("Nothing sensible gives nothing", ["", formatWait(0), formatWait(-5), formatWait(NaN), formatWait(undefined), formatWait("abc"), formatWait(null)].every((value) => value === ""));

// 5. What to say when something fails
const problem = (code, extra = {}, status = 429) => describeProblem({ message: "Server words", status, errors: { code, ...extra } });

for (const code of ["user_daily_limit", "workspace_daily_budget", "global_daily_budget"]) {
  const out = problem(code, { retryAfterSeconds: 18000 });
  check(`${code}: the server's words, when it resets, and no retry`, out.message === "Server words" && out.hint === "This resets in about 5 hours." && out.canRetry === false);
}
check("A limit with no wait time still says when it resets", problem("user_daily_limit").hint === "This resets at 00:00 UTC.");
check("A busy service suggests waiting, and allows a retry", (() => { const out = problem("provider_busy"); return out.canRetry && /minute/.test(out.hint); })());
for (const code of ["busy", "provider_timeout", "provider_unavailable", "bad_output"]) {
  check(`${code}: a retry can help`, problem(code).canRetry === true);
}
check("A snippet that's too long points to Explain, and has no retry", (() => { const out = problem("too_long", {}, 400); return !out.canRetry && /Explain/.test(out.hint); })());
for (const code of ["ai_disabled", "ai_not_configured", "ai_blocked", "nothing_to_summarize", "nothing_to_explain", "nothing_to_improve", "nothing_to_propose"]) {
  check(`${code}: no retry, since it wouldn't change anything`, problem(code, {}, 400).canRetry === false);
}
check("An unknown problem retries only when it could be temporary", describeProblem({ message: "x", status: 0 }).canRetry && describeProblem({ message: "x", status: 500 }).canRetry && describeProblem({ message: "x", status: 503 }).canRetry && !describeProblem({ message: "x", status: 404 }).canRetry && !describeProblem({ message: "x", status: 400 }).canRetry);
check("Without an error there is still a message", (() => { const out = describeProblem(undefined); return out.message === "Something went wrong. Try again." && out.canRetry === true; })());
check("An empty message gets the fallback", describeProblem({ message: "", status: 500 }).message === "Something went wrong. Try again.");

// 6. Copying
check("A summary copies as a paragraph and a list", summaryAsText({ summary: "S", keyPoints: ["a", "b"] }) === "S\n\n- a\n- b");
check("A summary with no points, or no summary, copies cleanly", summaryAsText({ summary: "S", keyPoints: [] }) === "S" && summaryAsText({ summary: "", keyPoints: ["a"] }) === "- a" && summaryAsText({}) === "");
check("An explanation copies with numbered steps and a warnings list", explanationAsText({ overview: "O", steps: ["a", "b"], watchOutFor: ["w"] }) === "O\n\nSteps:\n1. a\n2. b\n\nWatch out for:\n- w");
check("Empty sections are left out", explanationAsText({ overview: "O", steps: [], watchOutFor: [] }) === "O" && explanationAsText({ steps: ["a"] }) === "Steps:\n1. a" && explanationAsText({}) === "");

// 7. The goals match what the server accepts
check(
  "The goals are the four the server knows, each with a label",
  same(GOALS.map((goal) => goal.value), ["general", "readability", "performance", "bugs"]) && GOALS.every((goal) => goal.label.length > 3)
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);