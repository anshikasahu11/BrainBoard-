// A self-test for the activity feed. It signs in as three different people, does
// something in every part of the app, and checks what the feed says. It prints PASS
// or FAIL for each rule.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/activity-check.mjs

import { io } from "socket.io-client";

const API = process.env.API_URL || "http://localhost:5000";
const PASSWORD = "Password123";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits until predicate() is true, giving up after `ms`.
async function waitFor(predicate, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (predicate()) return true;
    await sleep(40);
  }
  return false;
}

async function api(method, path, { token, body, socketId } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (socketId) headers["X-Socket-Id"] = socketId;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email) {
  const { status, data } = await api("POST", "/api/auth/login", {
    body: { email, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`Couldn't log in as ${email} (status ${status})`);
  return { token: data.token, id: data.user.id };
}

// A tiny document: one paragraph of text.
const text = (words) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});

// Opens a live connection. Everything it receives is collected in socket.events.
function connect(token) {
  return new Promise((resolve) => {
    const socket = io(API, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socket.events = [];
    socket.onAny((event, payload) => socket.events.push({ event, payload }));

    socket.on("connect", () => resolve({ ok: true, socket }));
    socket.on("connect_error", (error) => {
      socket.close();
      resolve({ ok: false, error: error.message });
    });
  });
}

const join = (socket, workspaceId) =>
  new Promise((resolve) => {
    socket.timeout(3000).emit("workspace:join", workspaceId, (error, response) => {
      resolve(error ? { ok: false, error: "no answer" } : response);
    });
  });

const received = (socket, event) => socket.events.filter((item) => item.event === event);
const heardActivity = (socket, action) =>
  received(socket, "activity:created").filter((item) => item.payload?.activity?.action === action);

async function main() {
  console.log(`Checking the activity feed at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");
  const priya = await login("priya@example.com");

  const sockets = [];
  let workspaceId = null;

  try {
    const created = await api("POST", "/api/workspaces", {
      token: anshika.token,
      body: { name: "Activity Check" },
    });
    workspaceId = created.data.workspace.id;
    const base = `/api/workspaces/${workspaceId}`;
    const feedUrl = `${base}/activity`;

    // The feed, newest first. `params` become filters.
    const list = async (params = {}, token = anshika.token) => {
      const query = new URLSearchParams({ limit: "100", ...params });
      return (await api("GET", `${feedUrl}?${query}`, { token })).data?.activities ?? [];
    };
    const count = (items, action) => items.filter((item) => item.action === action).length;

    // 0. Who may read it?
    const outsider = await api("GET", feedUrl, { token: priya.token });
    check(
      "A non-member gets the same 'not found' as everywhere else",
      outsider.status === 404 && outsider.data?.message === "Workspace not found",
      JSON.stringify(outsider.data)
    );
    check("Without a login the feed is refused", (await api("GET", feedUrl)).status === 401);

    // 1. The workspace itself
    let items = await list();
    check(
      "Creating a workspace is the first entry",
      items.length === 1 &&
        items[0].action === "workspace.created" &&
        items[0].category === "team" &&
        items[0].actor.name === "Anshika" &&
        items[0].target.type === "workspace" &&
        items[0].target.name === "Activity Check",
      JSON.stringify(items)
    );
    check(
      "An entry has exactly these fields, and no content",
      JSON.stringify(Object.keys(items[0]).sort()) ===
        JSON.stringify(["action", "actor", "category", "createdAt", "id", "meta", "target"]),
      Object.keys(items[0]).join(",")
    );

    await api("POST", `${base}/members`, {
      token: anshika.token,
      body: { email: "rahul@example.com" },
    });
    items = await list();
    check(
      "Adding a member is recorded, with their role",
      items[0].action === "member.added" &&
        items[0].target.type === "member" &&
        items[0].target.name === "Rahul" &&
        items[0].meta.role === "member",
      JSON.stringify(items[0])
    );

    // Two people listen, to prove everyone hears new entries live.
    const a = await connect(anshika.token);
    const r = await connect(rahul.token);
    if (!a.ok || !r.ok) throw new Error("Couldn't connect to the live server. Is the backend running?");
    sockets.push(a.socket, r.socket);
    await join(a.socket, workspaceId);
    await join(r.socket, workspaceId);

    // 2. Documents
    const docs = `${base}/documents`;
    const doc = (
      await api("POST", docs, {
        token: anshika.token,
        socketId: a.socket.id,
        body: { title: "Plan" },
      })
    ).data.document;

    items = await list();
    check(
      "Creating a document is recorded, with its title and id",
      items[0].action === "document.created" &&
        items[0].category === "documents" &&
        items[0].target.id === doc.id &&
        items[0].target.name === "Plan",
      JSON.stringify(items[0])
    );
    check(
      "A teammate hears the new entry live",
      await waitFor(() => heardActivity(r.socket, "document.created").length === 1)
    );
    await sleep(300);
    check(
      "The person who did it hears it too, even though the document event skips them",
      heardActivity(a.socket, "document.created").length === 1 && received(a.socket, "document:created").length === 0
    );

    const docUrl = `${docs}/${doc.id}`;
    const save = (token, baseRevision, words) =>
      api("PATCH", docUrl, { token, body: { baseRevision, content: text(words) } });

    await save(anshika.token, 0, "One");
    await save(anshika.token, 1, "Two");
    await save(anshika.token, 2, "Three");
    items = await list();
    check("Three autosaves in a row make ONE 'edited' entry", count(items, "document.updated") === 1, String(count(items, "document.updated")));

    await api("PATCH", docUrl, { token: anshika.token, body: { baseRevision: 3, title: "Roadmap" } });
    items = await list();
    check(
      "A rename is its own entry, with the old and new title",
      items[0].action === "document.renamed" &&
        items[0].meta.from === "Plan" &&
        items[0].meta.to === "Roadmap" &&
        items[0].target.name === "Roadmap",
      JSON.stringify(items[0])
    );
    check("A rename alone doesn't count as an edit", count(items, "document.updated") === 1);

    await save(rahul.token, 4, "Four");
    items = await list();
    check(
      "A different person's edit is recorded separately",
      count(items, "document.updated") === 2 && items[0].actor.name === "Rahul",
      JSON.stringify(items[0])
    );

    // 3. Versions
    const versions = `${docUrl}/versions`;
    const named = (
      await api("POST", versions, { token: anshika.token, body: { label: "Release candidate" } })
    ).data.version;
    items = await list();
    check(
      "Saving a named version is recorded, with its number and name",
      items[0].action === "version.saved" &&
        items[0].meta.number === named.number &&
        items[0].meta.label === "Release candidate" &&
        items[0].target.id === doc.id,
      JSON.stringify(items[0])
    );
    check("Automatic versions are not recorded", count(items, "version.saved") === 1);

    const revision = (await api("GET", docUrl, { token: anshika.token })).data.document.revision;
    await api("POST", `${versions}/${named.number}/restore`, {
      token: anshika.token,
      body: { baseRevision: revision },
    });
    items = await list();
    check(
      "Restoring a version is recorded, with its number",
      items[0].action === "version.restored" && items[0].meta.number === named.number,
      JSON.stringify(items[0])
    );

    await api("DELETE", `${versions}/${named.number}`, { token: anshika.token });
    items = await list();
    check(
      "Deleting a version is recorded",
      items[0].action === "version.deleted" && items[0].meta.number === named.number
    );

    // 4. Tasks
    const tasks = `${base}/tasks`;
    const task = (await api("POST", tasks, { token: anshika.token, body: { title: "Login API" } })).data.task;
    items = await list();
    check(
      "Creating a task is recorded",
      items[0].action === "task.created" && items[0].category === "tasks" && items[0].target.name === "Login API"
    );

    const second = (await api("POST", tasks, { token: anshika.token, body: { title: "Second" } })).data.task;
    const countBefore = (await list()).length;
    await api("PATCH", `${tasks}/${task.id}/move`, {
      token: anshika.token,
      body: { status: "todo", afterId: second.id },
    });
    check("Reordering inside a column is not recorded", (await list()).length === countBefore);

    await api("PATCH", `${tasks}/${task.id}/move`, {
      token: anshika.token,
      body: { status: "review", afterId: null },
    });
    items = await list();
    check(
      "Moving to another column is recorded, from and to",
      items[0].action === "task.moved" && items[0].meta.from === "todo" && items[0].meta.to === "review",
      JSON.stringify(items[0])
    );
    check(
      "A teammate hears it live",
      await waitFor(() => heardActivity(r.socket, "task.moved").length === 1)
    );

    await api("PATCH", `${tasks}/${task.id}`, { token: anshika.token, body: { status: "done" } });
    items = await list();
    check(
      "Changing the status in the edit dialog is recorded the same way",
      items[0].action === "task.moved" && items[0].meta.from === "review" && items[0].meta.to === "done"
    );

    await api("PATCH", `${tasks}/${task.id}`, { token: anshika.token, body: { assignee: rahul.id } });
    items = await list();
    check(
      "Assigning a task is recorded, with the person's name",
      items[0].action === "task.assigned" &&
        items[0].meta.assigneeName === "Rahul" &&
        items[0].meta.assigneeId === rahul.id,
      JSON.stringify(items[0])
    );
    check("Assigning doesn't also count as an edit", count(items, "task.updated") === 0);

    await api("PATCH", `${tasks}/${task.id}`, { token: anshika.token, body: { assignee: null } });
    items = await list();
    check("Unassigning is recorded", items[0].action === "task.unassigned");

    await api("PATCH", `${tasks}/${task.id}`, { token: anshika.token, body: { priority: "high" } });
    await api("PATCH", `${tasks}/${task.id}`, { token: anshika.token, body: { priority: "urgent" } });
    items = await list();
    check("Editing a task is recorded once, not for every change", count(items, "task.updated") === 1, String(count(items, "task.updated")));

    await api("DELETE", `${tasks}/${task.id}`, { token: anshika.token });
    items = await list();
    check(
      "Deleting a task is recorded, with the name it had",
      items[0].action === "task.deleted" && items[0].target.name === "Login API"
    );

    // 5. Snippets
    const snippets = `${base}/snippets`;
    const snippet = (
      await api("POST", snippets, {
        token: anshika.token,
        body: { title: "Verify", code: "const a = 1;", language: "javascript" },
      })
    ).data.snippet;
    items = await list();
    check(
      "Creating a snippet is recorded",
      items[0].action === "snippet.created" && items[0].category === "snippets" && items[0].target.name === "Verify"
    );

    await api("PATCH", `${snippets}/${snippet.id}`, {
      token: anshika.token,
      body: { baseRevision: 0, title: "Verify v2" },
    });
    await api("PATCH", `${snippets}/${snippet.id}`, {
      token: anshika.token,
      body: { baseRevision: 1, code: "const b = 2;" },
    });
    items = await list();
    check("Editing a snippet is recorded once", count(items, "snippet.updated") === 1);

    await api("DELETE", `${snippets}/${snippet.id}`, { token: anshika.token });
    items = await list();
    check("Deleting a snippet is recorded", items[0].action === "snippet.deleted");

    // 6. People and the workspace
    await api("PATCH", `${base}/members/${rahul.id}`, {
      token: anshika.token,
      body: { role: "admin" },
    });
    items = await list();
    check(
      "Changing someone's role is recorded, from and to",
      items[0].action === "member.role_changed" &&
        items[0].target.name === "Rahul" &&
        items[0].meta.from === "member" &&
        items[0].meta.role === "admin",
      JSON.stringify(items[0])
    );
    check(
      "A teammate hears it live",
      await waitFor(() => heardActivity(r.socket, "member.role_changed").length === 1)
    );

    await api("POST", `${base}/members`, { token: anshika.token, body: { email: "priya@example.com" } });
    await api("DELETE", `${base}/members/${priya.id}`, { token: priya.token });
    items = await list();
    check(
      "Someone leaving is recorded as theirs, not as a removal",
      items[0].action === "member.left" && items[0].actor.name === "Priya" && items[0].target.name === "Priya",
      JSON.stringify(items[0])
    );
    check(
      "Someone who left can no longer read the feed",
      (await api("GET", feedUrl, { token: priya.token })).status === 404
    );

    await api("PATCH", base, { token: anshika.token, body: { name: "Activity Check 2" } });
    items = await list();
    check(
      "Renaming the workspace is recorded, from and to",
      items[0].action === "workspace.renamed" &&
        items[0].meta.from === "Activity Check" &&
        items[0].meta.to === "Activity Check 2",
      JSON.stringify(items[0])
    );

    await api("DELETE", docUrl, { token: anshika.token });
    items = await list();
    check(
      "Deleting a document is recorded, with the name it had",
      items[0].action === "document.deleted" && items[0].target.name === "Roadmap"
    );

    // 7. Filters
    const tasksOnly = await list({ category: "tasks" });
    check(
      "category=tasks returns only task entries",
      tasksOnly.length > 0 && tasksOnly.every((item) => item.category === "tasks")
    );
    const docsOnly = await list({ category: "documents" });
    check(
      "category=documents includes versions",
      docsOnly.every((item) => item.category === "documents") && count(docsOnly, "version.saved") === 1
    );
    const teamOnly = await list({ category: "team" });
    check(
      "category=team returns people and workspace entries",
      teamOnly.every((item) => item.category === "team") && count(teamOnly, "member.added") === 2
    );

    const mine = await list({ actor: "me" });
    check(
      "actor=me returns only your entries",
      mine.length > 0 && mine.every((item) => item.actor.id === anshika.id)
    );
    const rahulsEntries = await list({ actor: rahul.id });
    check(
      "actor=<id> returns only that person's entries",
      rahulsEntries.length === 1 && rahulsEntries[0].actor.name === "Rahul",
      JSON.stringify(rahulsEntries)
    );

    const history = await list({ target: doc.id });
    check(
      "target=<id> returns one document's whole history, even after it was deleted",
      history.length >= 7 &&
        history.every((item) => item.target.id === doc.id) &&
        count(history, "document.created") === 1 &&
        count(history, "document.deleted") === 1,
      `${history.length} entries`
    );

    check(
      "A bad category is refused",
      (await api("GET", `${feedUrl}?category=bogus`, { token: anshika.token })).status === 400
    );
    check(
      "A bad person filter is refused",
      (await api("GET", `${feedUrl}?actor=nobody`, { token: anshika.token })).status === 400
    );
    check(
      "A bad target is refused",
      (await api("GET", `${feedUrl}?target=123`, { token: anshika.token })).status === 400
    );
    check(
      "A bad cursor is refused",
      (await api("GET", `${feedUrl}?before=zzz`, { token: anshika.token })).status === 400
    );

    // 8. Pages
    const full = await list();
    const walked = [];
    let cursor = null;
    let pages = 0;
    do {
      const query = new URLSearchParams({ limit: "5" });
      if (cursor) query.set("before", cursor);
      const page = (await api("GET", `${feedUrl}?${query}`, { token: anshika.token })).data;
      walked.push(...page.activities);
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 100);

    check("Entries come newest first", full.every((item, i) => i === 0 || full[i - 1].id > item.id));
    check(
      "Paging through 5 at a time gives every entry exactly once, in the same order",
      walked.length === full.length && JSON.stringify(walked.map((i) => i.id)) === JSON.stringify(full.map((i) => i.id)),
      `${walked.length} vs ${full.length}`
    );
    const firstPage = (await api("GET", `${feedUrl}?limit=5`, { token: anshika.token })).data;
    check(
      "A page that isn't the last gives a cursor, and the last page gives none",
      typeof firstPage.nextCursor === "string" && firstPage.activities.length === 5 && cursor === null
    );

    // 9. Nobody can write to the feed
    check(
      "Writing to the feed is refused",
      (await api("POST", feedUrl, { token: anshika.token, body: { action: "task.deleted" } })).status === 404 &&
        (await api("PATCH", feedUrl, { token: anshika.token, body: {} })).status === 404 &&
        (await api("DELETE", feedUrl, { token: anshika.token })).status === 404
    );

    // 10. Removing someone ends their access to the history
    await api("DELETE", `${base}/members/${rahul.id}`, { token: anshika.token });
    items = await list();
    check(
      "Removing a member is recorded",
      items[0].action === "member.removed" && items[0].target.name === "Rahul" && items[0].actor.name === "Anshika"
    );
    check(
      "A removed member can no longer read the feed",
      (await api("GET", feedUrl, { token: rahul.token })).status === 404
    );
    await sleep(300);
    check(
      "...and wasn't sent the entry about their own removal",
      heardActivity(r.socket, "member.removed").length === 0
    );
  } finally {
    for (const socket of sockets) socket.close();
    if (workspaceId) {
      await api("DELETE", `/api/workspaces/${workspaceId}`, { token: anshika.token });
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  process.exit(1);
});