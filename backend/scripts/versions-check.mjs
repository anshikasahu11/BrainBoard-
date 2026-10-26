// A self-test for version history. It signs in as three different people, edits a
// document, tries the things that must be refused, and prints PASS or FAIL for each rule.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/versions-check.mjs

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
const textOf = (content) => content?.content?.[0]?.content?.[0]?.text;

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

async function main() {
  console.log(`Checking version history at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");
  const priya = await login("priya@example.com");

  const sockets = [];
  let workspaceId = null;

  try {
    // A workspace: Anshika owns it, Rahul is a member, Priya is NOT in it.
    const created = await api("POST", "/api/workspaces", {
      token: anshika.token,
      body: { name: "Version Check" },
    });
    workspaceId = created.data.workspace.id;
    const base = `/api/workspaces/${workspaceId}`;
    await api("POST", `${base}/members`, {
      token: anshika.token,
      body: { email: "rahul@example.com" },
    });

    // Rahul listens, to prove teammates hear about versions.
    const listener = await connect(rahul.token);
    if (!listener.ok) throw new Error("Couldn't connect to the live server. Is the backend running?");
    sockets.push(listener.socket);
    check("A teammate can listen to the workspace", (await join(listener.socket, workspaceId)).ok);
    const heard = (event) => listener.socket.events.filter((item) => item.event === event);

    const doc = (
      await api("POST", `${base}/documents`, {
        token: anshika.token,
        body: { title: "Version Check" },
      })
    ).data.document;
    const docUrl = `${base}/documents/${doc.id}`;
    const versions = `${docUrl}/versions`;

    const list = async (token = anshika.token) => (await api("GET", versions, { token })).data;
    const save = (token, baseRevision, words) =>
      api("PATCH", docUrl, { token, body: { baseRevision, content: text(words) } });
    const restore = (token, number, baseRevision) =>
      api("POST", `${versions}/${number}/restore`, { token, body: { baseRevision } });

    // 1. Automatic versions
    let current = await list();
    check("A new document has no versions", current.total === 0 && current.versions.length === 0);

    await save(anshika.token, 0, "First draft");
    current = await list();
    check("A blank starting point is not kept as a version", current.total === 0);

    await save(anshika.token, 1, "Second draft");
    current = await list();
    check(
      "Saving over real text keeps the earlier text as version 1 (automatic)",
      current.total === 1 && current.versions[0].number === 1 && current.versions[0].kind === "auto"
    );
    check(
      "The version records who wrote it, and has no content in the list",
      current.versions[0].editedBy?.name === "Anshika" && !("content" in current.versions[0])
    );

    const v1 = (await api("GET", `${versions}/1`, { token: anshika.token })).data.version;
    check("Opening version 1 returns the EARLIER text", textOf(v1.content) === "First draft");

    await save(anshika.token, 2, "Third draft");
    current = await list();
    check("Saving again right away doesn't pile up versions", current.total === 1);

    // 2. Named versions
    const named = await api("POST", versions, {
      token: anshika.token,
      body: { label: "Release candidate" },
    });
    check(
      "Anyone can save a named version",
      named.status === 201 &&
        named.data.version.number === 2 &&
        named.data.version.kind === "manual" &&
        named.data.version.label === "Release candidate",
      JSON.stringify(named.data)
    );
    const v2 = (await api("GET", `${versions}/2`, { token: anshika.token })).data.version;
    check("A named version holds the text as it is right now", textOf(v2.content) === "Third draft");

    const byRahul = await api("POST", versions, { token: rahul.token, body: {} });
    check(
      "A plain member can save one too, with no name",
      byRahul.status === 201 &&
        byRahul.data.version.number === 3 &&
        byRahul.data.version.createdBy?.name === "Rahul",
      JSON.stringify(byRahul.data)
    );

    const blankDoc = (
      await api("POST", `${base}/documents`, { token: anshika.token, body: { title: "Blank" } })
    ).data.document;
    const blank = await api("POST", `${base}/documents/${blankDoc.id}/versions`, {
      token: anshika.token,
      body: {},
    });
    check(
      "A blank document can't be saved as a version",
      blank.status === 400 && /nothing to save/i.test(blank.data?.message ?? ""),
      JSON.stringify(blank.data)
    );

    // 3. Looking in the wrong places
    check(
      "An unknown version number gives 404",
      (await api("GET", `${versions}/99`, { token: anshika.token })).status === 404
    );
    check(
      "A malformed version number gives 404",
      (await api("GET", `${versions}/abc`, { token: anshika.token })).status === 404 &&
        (await api("GET", `${versions}/0`, { token: anshika.token })).status === 404
    );
    check(
      "A version number doesn't work under a different document",
      (await api("GET", `${base}/documents/${blankDoc.id}/versions/1`, { token: anshika.token }))
        .status === 404
    );
    const outsider = await api("GET", versions, { token: priya.token });
    check(
      "A non-member gets the same 'not found' as everywhere else",
      outsider.status === 404 && outsider.data?.message === "Workspace not found",
      JSON.stringify(outsider.data)
    );
    check(
      "A non-member can't save a version",
      (await api("POST", versions, { token: priya.token, body: {} })).status === 404
    );
    check("Without a login, history is refused", (await api("GET", versions)).status === 401);
    check("A member can read the history", (await list(rahul.token)).total === 3);

    // 4. Restoring
    await save(anshika.token, 3, "Fourth draft");

    const stale = await restore(anshika.token, 1, 3);
    check(
      "Restoring from an out-of-date screen is refused (409), with the current revision",
      stale.status === 409 && stale.data?.errors?.currentRevision === 4,
      JSON.stringify(stale.data)
    );
    check(
      "Restoring needs a revision",
      (await api("POST", `${versions}/1/restore`, { token: anshika.token, body: {} })).status === 400
    );
    check("Restoring an unknown version gives 404", (await restore(anshika.token, 99, 4)).status === 404);

    const restored = await restore(anshika.token, 1, 4);
    check(
      "Restoring version 1 puts the earlier text back",
      restored.status === 200 &&
        textOf(restored.data?.document?.content) === "First draft" &&
        restored.data.restoredFrom === 1,
      JSON.stringify(restored.data)
    );
    check("Restoring counts as a new save (revision goes up)", restored.data?.document?.revision === 5);

    current = await list();
    check(
      "What was replaced is kept as a 'before restoring' backup",
      current.versions[0].number === 4 &&
        current.versions[0].kind === "restore-backup" &&
        current.versions[0].label === "Before restoring version 1",
      JSON.stringify(current.versions[0])
    );
    const v4 = (await api("GET", `${versions}/4`, { token: anshika.token })).data.version;
    check("The backup holds the text that was replaced", textOf(v4.content) === "Fourth draft");

    // 5. Deleting a version
    const denied = await api("DELETE", `${versions}/3`, { token: rahul.token });
    check("A plain member can't delete a version", denied.status === 403, JSON.stringify(denied.data));
    check(
      "The owner can delete a version",
      (await api("DELETE", `${versions}/3`, { token: anshika.token })).status === 204
    );
    check(
      "A deleted version is gone",
      (await api("GET", `${versions}/3`, { token: anshika.token })).status === 404 &&
        (await list()).total === 3
    );

    const again = await api("POST", versions, { token: anshika.token, body: { label: "After delete" } });
    check(
      "Version numbers are never reused",
      again.status === 201 && again.data.version.number === 5,
      JSON.stringify(again.data)
    );

    // 6. Teammates hear about it live
    check(
      "A teammate hears version:created for the automatic version",
      await waitFor(() =>
        heard("version:created").some(
          (item) => item.payload?.version?.number === 1 && item.payload.version.kind === "auto"
        )
      )
    );
    check(
      "...and for a named version, with its name",
      await waitFor(() =>
        heard("version:created").some(
          (item) =>
            item.payload?.version?.number === 2 && item.payload.version.label === "Release candidate"
        )
      )
    );
    check(
      "...and for the 'before restoring' backup",
      await waitFor(() =>
        heard("version:created").some(
          (item) => item.payload?.version?.number === 4 && item.payload.documentId === doc.id
        )
      )
    );
    check(
      "A teammate hears document:updated when a version is restored",
      await waitFor(() =>
        heard("document:updated").some(
          (item) => item.payload?.document?.id === doc.id && item.payload.document.revision === 5
        )
      )
    );
    check(
      "A teammate hears version:deleted",
      await waitFor(() =>
        heard("version:deleted").some(
          (item) => item.payload?.number === 3 && item.payload.documentId === doc.id
        )
      )
    );

    // 7. A deleted document takes its history with it.
    check("The document can be deleted", (await api("DELETE", docUrl, { token: anshika.token })).status === 204);
    const gone = await api("GET", versions, { token: anshika.token });
    check(
      "Its history is no longer reachable",
      gone.status === 404 && gone.data?.message === "Document not found",
      JSON.stringify(gone.data)
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