// A self-test for the three new AI endpoints (explain a snippet, improve a snippet, tasks from
// notes), run against the live backend IN TEST MODE. It creates a throwaway test person (so
// your real accounts' daily limits aren't used up), builds a small workspace, and prints PASS or
// FAIL for each rule.
//
// The backend must be running with AI_PROVIDER=mock (the default). If it isn't, this stops at
// once so it can never spend real AI quota.
//
// Run it from the backend folder:
//   node scripts/ai-actions-check.mjs

const API = process.env.API_URL || "http://localhost:5000";
const PASSWORD = "Password123";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function api(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email) {
  const { status, data } = await api("POST", "/api/auth/login", { body: { email, password: PASSWORD } });
  if (status !== 200) throw new Error(`Couldn't log in as ${email} (status ${status})`);
  return { token: data.token, id: data.user.id };
}

const text = (words) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});

const metaKeys = ["model", "provider", "quota", "testMode", "usage"];
const keysOf = (data, extra) => [...metaKeys, ...extra].sort();

async function main() {
  console.log(`Checking the new AI actions at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");

  // A throwaway person with a fresh daily allowance, so this test can be repeated all day.
  const email = `ai-actions-${Date.now()}@example.com`;
  const registered = await api("POST", "/api/auth/register", {
    body: { name: "AI Actions", email, password: PASSWORD },
  });
  if (![200, 201].includes(registered.status)) {
    throw new Error(`Couldn't create the test person (status ${registered.status}: ${registered.data?.message})`);
  }
  const temp = await login(email);

  const workspaceIds = [];

  try {
    const make = async (name) => {
      const created = await api("POST", "/api/workspaces", { token: anshika.token, body: { name } });
      workspaceIds.push(created.data.workspace.id);
      return created.data.workspace.id;
    };

    const ws = await make("AI Actions");
    const other = await make("AI Actions Other");
    const base = `/api/workspaces/${ws}`;

    await api("POST", `${base}/members`, { token: anshika.token, body: { email: "rahul@example.com" } });
    await api("POST", `${base}/members`, { token: anshika.token, body: { email } });

    const post = (who, action, body, workspace = ws) =>
      api("POST", `/api/workspaces/${workspace}/ai/${action}`, { token: who.token, body });
    const status = async () => (await api("GET", `${base}/ai/status`, { token: temp.token })).data;
    const usedNow = async () => (await status()).today.requestsUsed;

    const makeSnippet = async (workspace, title, code, language = "javascript") => {
      const created = await api("POST", `/api/workspaces/${workspace}/snippets`, {
        token: anshika.token,
        body: { title, code, language },
      });
      if (created.status !== 201) throw new Error(`Couldn't create the test snippet "${title}" (status ${created.status})`);
      return created.data.snippet;
    };
    const makeDoc = async (title, words) => {
      const doc = (await api("POST", `${base}/documents`, { token: anshika.token, body: { title } })).data.document;
      await api("PATCH", `${base}/documents/${doc.id}`, {
        token: anshika.token,
        body: { baseRevision: 0, content: text(words) },
      });
      return doc;
    };

    // Safety first: never run this against the real AI.
    const first = await status();
    if (!first?.testMode) {
      throw new Error(
        "The backend isn't in test mode. Set AI_PROVIDER=mock in backend/.env and restart it. This check would spend real AI quota, so it stopped."
      );
    }
    const maxChars = first.limits.maxInputChars;

    // ---------- Explain a snippet ----------
    const adder = await makeSnippet(ws, "Add numbers", "function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));");
    const foreign = await makeSnippet(other, "Elsewhere", "const secret = 1;");

    check("Explain: a missing snippet is refused", (await post(temp, "explain-snippet", {})).status === 400);
    check("Explain: a malformed id is refused", (await post(temp, "explain-snippet", { snippetId: "123" })).status === 400);
    check("Explain: an unknown snippet is 'not found'", (await post(temp, "explain-snippet", { snippetId: "0".repeat(24) })).status === 404);
    check("Explain: a snippet from another workspace is 'not found'", (await post(temp, "explain-snippet", { snippetId: foreign.id })).status === 404);
    check("Those refusals used up nothing", (await usedNow()) === 0);

    const explained = await post(temp, "explain-snippet", { snippetId: adder.id });
    check(
      "Explain: a snippet is explained in the expected shape",
      explained.status === 200 &&
        same(Object.keys(explained.data.result), ["overview", "steps", "watchOutFor"]) &&
        explained.data.result.overview === "Test mode explanation: function add(a, b) {" &&
        explained.data.result.steps.length === 3 &&
        explained.data.truncated === false,
      JSON.stringify(explained.data)
    );
    check(
      "Explain: the reply has only these fields",
      same(Object.keys(explained.data).sort(), keysOf(explained.data, ["result", "truncated"])),
      Object.keys(explained.data).join(",")
    );
    check("Explain: it counted as one request", (await usedNow()) === 1);

    const longSnippet = await makeSnippet(ws, "Long code", `// ${"x".repeat(maxChars + 1000)}\nconst a = 1;`);
    const explainedLong = await post(temp, "explain-snippet", { snippetId: longSnippet.id });
    check("Explain: a very long snippet is clipped, and the reply says so", explainedLong.status === 200 && explainedLong.data.truncated === true);

    const failing = await makeSnippet(ws, "Fails", "const a = 1; // [[mock:fail]]");
    const failed = await post(temp, "explain-snippet", { snippetId: failing.id });
    check(
      "Explain: a provider failure becomes a calm 502 with nothing internal in it",
      failed.status === 502 && failed.data?.errors?.code === "provider_unavailable" && !/mock/i.test(failed.data?.message ?? "")
    );

    // ---------- Improve a snippet ----------
    const improvedReply = await post(temp, "improve-snippet", { snippetId: adder.id });
    check(
      "Improve: a snippet comes back with a summary, suggestions and the full improved code",
      improvedReply.status === 200 &&
        same(Object.keys(improvedReply.data.result), ["summary", "suggestions", "improvedCode"]) &&
        improvedReply.data.result.improvedCode.startsWith("// reviewed in test mode\n") &&
        improvedReply.data.result.improvedCode.includes("return a + b;") &&
        improvedReply.data.unchanged === false &&
        same(improvedReply.data.warnings, []),
      JSON.stringify(improvedReply.data).slice(0, 300)
    );
    check(
      "Improve: the reply has only these fields",
      same(Object.keys(improvedReply.data).sort(), keysOf(improvedReply.data, ["result", "unchanged", "warnings"]))
    );

    const afterImprove = await api("GET", `${base}/snippets/${adder.id}`, { token: anshika.token });
    check(
      "Improve: the saved snippet is exactly as it was (the server only suggests)",
      afterImprove.data.snippet.code === "function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));" && afterImprove.data.snippet.revision === 0
    );

    check("Improve: an unknown goal is refused", (await post(temp, "improve-snippet", { snippetId: adder.id, goal: "make it pretty" })).status === 400);
    check("Improve: a known goal is accepted", (await post(temp, "improve-snippet", { snippetId: adder.id, goal: "bugs" })).status === 200);

    const usedBeforeLong = await usedNow();
    const tooLong = await post(temp, "improve-snippet", { snippetId: longSnippet.id });
    check(
      "Improve: a snippet over the limit is refused, not chopped, and costs nothing",
      tooLong.status === 400 && tooLong.data?.errors?.code === "too_long" && (await usedNow()) === usedBeforeLong
    );

    const risky = await makeSnippet(ws, "Risky", "const a = 1; // [[mock:risky]]");
    const riskyReply = await post(temp, "improve-snippet", { snippetId: risky.id });
    check(
      "Improve: new risky code (an eval) is warned about",
      riskyReply.status === 200 && riskyReply.data.warnings.length === 1 && /eval/.test(riskyReply.data.warnings[0]),
      JSON.stringify(riskyReply.data?.warnings)
    );

    const same1 = await makeSnippet(ws, "Same", "const a = 1; // [[mock:same]]");
    const sameReply = await post(temp, "improve-snippet", { snippetId: same1.id });
    check("Improve: code that comes back unchanged is reported as unchanged", sameReply.status === 200 && sameReply.data.unchanged === true);

    const messy = await makeSnippet(ws, "Messy", "const a = 1; // [[mock:messy]]");
    const messyReply = await post(temp, "improve-snippet", { snippetId: messy.id });
    check(
      "Improve: a junk-filled answer comes back cleaned (6 suggestions, trimmed, clean line endings)",
      messyReply.status === 200 &&
        messyReply.data.result.suggestions.length === 6 &&
        messyReply.data.result.suggestions.every((item) => item.reason.length === 400) &&
        messyReply.data.result.improvedCode === "line1\nline2"
    );

    const garbage = await makeSnippet(ws, "Garbage", "const a = 1; // [[mock:garbage]]");
    const garbageReply = await post(temp, "improve-snippet", { snippetId: garbage.id });
    check("Improve: an unreadable answer becomes a 502", garbageReply.status === 502 && garbageReply.data?.errors?.code === "bad_output");

    // ---------- Tasks from notes ----------
    const tasksBefore = (await api("GET", `${base}/tasks`, { token: anshika.token })).data.tasks.length;
    const notes = "Rahul will write the report. Someone should book the room. Update the roadmap by 2026-12-04.";

    check("Tasks: sending nothing is refused", (await post(temp, "tasks-from-text", {})).status === 400);
    check("Tasks: empty notes are refused", (await post(temp, "tasks-from-text", { text: "   " })).status === 400);
    const doc = await makeDoc("Meeting notes", notes);
    check("Tasks: notes AND a document together are refused", (await post(temp, "tasks-from-text", { text: notes, documentId: doc.id })).status === 400);
    check("Tasks: a malformed document id is refused", (await post(temp, "tasks-from-text", { documentId: "123" })).status === 400);
    check("Tasks: an unknown document is 'not found'", (await post(temp, "tasks-from-text", { documentId: "0".repeat(24) })).status === 404);
    check("Tasks: an impossible date is refused", (await post(temp, "tasks-from-text", { text: notes, today: "2026-02-30" })).status === 400);
    const hugeNotes = await post(temp, "tasks-from-text", { text: "word ".repeat(20001) });
    check("Tasks: absurdly long notes are refused", [400, 413].includes(hugeNotes.status), String(hugeNotes.status));

    const emptyDoc = (await api("POST", `${base}/documents`, { token: anshika.token, body: { title: "Empty" } })).data.document;
    const emptyReply = await post(temp, "tasks-from-text", { documentId: emptyDoc.id });
    check("Tasks: an empty document is refused without asking the AI", emptyReply.status === 400 && emptyReply.data?.errors?.code === "nothing_to_propose");

    const usedBeforeTasks = await usedNow();
    const proposed = await post(temp, "tasks-from-text", { text: notes, today: "2026-11-13" });
    check("Tasks: notes become proposals", proposed.status === 200 && proposed.data.result.tasks.length === 3 && proposed.data.result.skipped === 0, JSON.stringify(proposed.data).slice(0, 300));
    check(
      "Tasks: each proposal has exactly these fields",
      proposed.data.result.tasks.every((task) => same(Object.keys(task), ["title", "description", "priority", "dueDate", "assignee"]))
    );
    check(
      "Tasks: the person named in the notes is a real member, with their real id",
      proposed.data.result.tasks[0].assignee?.name === "Rahul" && proposed.data.result.tasks[0].assignee?.id === rahul.id
    );
    check("Tasks: a sentence naming nobody has no assignee", proposed.data.result.tasks[1].assignee === null);
    check("Tasks: a date in the notes comes through", proposed.data.result.tasks[2].dueDate === "2026-12-04" && proposed.data.result.tasks[0].dueDate === null);
    check(
      "Tasks: the reply has only these fields",
      same(Object.keys(proposed.data).sort(), keysOf(proposed.data, ["result", "truncated"])) && same(Object.keys(proposed.data.result), ["tasks", "skipped"])
    );
    check("Tasks: it counted as one request", (await usedNow()) === usedBeforeTasks + 1);

    const fromDoc = await post(temp, "tasks-from-text", { documentId: doc.id });
    check("Tasks: a document can be the source instead", fromDoc.status === 200 && fromDoc.data.result.tasks.length === 3);

    const tasksAfter = (await api("GET", `${base}/tasks`, { token: anshika.token })).data.tasks.length;
    check("Tasks: NOTHING was created. The proposals are only proposals", tasksAfter === tasksBefore, `${tasksBefore} before, ${tasksAfter} after`);

    const longNotes = await post(temp, "tasks-from-text", { text: "A short sentence about the plan. ".repeat(1000) });
    check("Tasks: long notes are clipped, and the reply says so", longNotes.status === 200 && longNotes.data.truncated === true);

    const messyTasks = await post(temp, "tasks-from-text", { text: "[[mock:messy]] Rahul will fix it." });
    const tasks = messyTasks.data?.result?.tasks ?? [];
    check(
      "Tasks: a junk-filled answer is cut to 15 tasks, with 24 skipped",
      messyTasks.status === 200 && tasks.length === 15 && messyTasks.data.result.skipped === 24,
      `${tasks.length} tasks, ${messyTasks.data?.result?.skipped} skipped`
    );
    check(
      "Tasks: ...the first one is cleaned up (title, priority, date, real assignee, short description)",
      tasks[0]?.title === "Valid task" && tasks[0]?.priority === "high" && tasks[0]?.dueDate === "2026-12-01" && tasks[0]?.assignee?.id === rahul.id && tasks[0]?.description.length === 500
    );
    check(
      "Tasks: ...an invented person, a bad priority and an impossible date all become safe defaults",
      tasks[1]?.assignee === null && tasks[1]?.priority === "medium" && tasks[1]?.dueDate === null
    );
    check(
      "Tasks: ...no title is empty or over 120 characters, none repeat, and nothing has control characters",
      tasks.every((task) => task.title.length > 0 && task.title.length <= 120) &&
        new Set(tasks.map((task) => task.title.toLowerCase())).size === tasks.length &&
        !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(JSON.stringify(messyTasks.data).replace(/\\u00[01][0-9a-f]/gi, "X"))
    );
    check("Tasks: ...and no proposal can be assigned to anyone except a real member", tasks.every((task) => task.assignee === null || task.assignee.id === rahul.id));

    const garbageNotes = await post(temp, "tasks-from-text", { text: "[[mock:garbage]] notes." });
    check("Tasks: an unreadable answer becomes a 502", garbageNotes.status === 502 && garbageNotes.data?.errors?.code === "bad_output");

    // Someone who is no longer a member can't be proposed as an assignee.
    await api("DELETE", `${base}/members/${rahul.id}`, { token: anshika.token });
    const afterRemoval = await post(temp, "tasks-from-text", { text: "[[mock:messy]] Rahul will fix it." });
    check(
      "Tasks: after Rahul is removed, he can no longer be proposed as an assignee",
      afterRemoval.status === 200 && afterRemoval.data.result.tasks[0].assignee === null
    );
    check("Everything stayed within the daily allowance", (await status()).today.requestsLeft >= 0);
  } finally {
    for (const id of workspaceIds) {
      await api("DELETE", `/api/workspaces/${id}`, { token: anshika.token });
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  process.exit(1);
});