// A self-test for the real-time server. It connects as different people, tries the
// things that must be refused, makes changes over REST, and prints PASS or FAIL
// for each rule.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/socket-check.mjs

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

// Opens a connection. Everything it receives is collected in socket.events.
function connect(token) {
  return new Promise((resolve) => {
    const socket = io(API, {
      auth: token ? { token } : {},
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

// Sends a message and waits for the server's answer.
const ask = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.timeout(3000).emit(event, payload, (error, response) => {
      resolve(error ? { ok: false, error: "no answer" } : response);
    });
  });

const join = (socket, workspaceId) => ask(socket, "workspace:join", workspaceId);
const focus = (socket, workspaceId, documentId) =>
  ask(socket, "document:focus", { workspaceId, documentId });
const blur = (socket, workspaceId) => ask(socket, "document:blur", { workspaceId });

const received = (socket, event) => socket.events.filter((item) => item.event === event);

// The newest list of who's online that this connection has heard.
const presenceNow = (socket) => received(socket, "presence:update").at(-1)?.payload?.users ?? [];

async function main() {
  console.log(`Checking the real-time server at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");
  const priya = await login("priya@example.com");

  const sockets = [];
  let workspaceId = null;

  try {
    // 1. Who may connect?
    const anonymous = await connect(null);
    check(
      "A connection without a token is refused",
      !anonymous.ok && anonymous.error === "Authentication required",
      anonymous.error
    );

    const forged = await connect("not-a-real-token");
    check(
      "A connection with a bad token is refused",
      !forged.ok && forged.error === "Invalid or expired token",
      forged.error
    );

    const a = await connect(anshika.token);
    const a2 = await connect(anshika.token); // Anshika's second tab
    const r = await connect(rahul.token);
    const p = await connect(priya.token);
    for (const entry of [a, a2, r, p]) if (entry.ok) sockets.push(entry.socket);
    check("People with valid tokens can connect (Anshika has two tabs)", a.ok && a2.ok && r.ok && p.ok);
    if (!(a.ok && a2.ok && r.ok && p.ok)) throw new Error("Couldn't connect. Is the backend running?");

    // A workspace: Anshika owns it, Rahul is a member, Priya is NOT in it (yet).
    const created = await api("POST", "/api/workspaces", {
      token: anshika.token,
      body: { name: "Realtime Check" },
    });
    workspaceId = created.data.workspace.id;
    const ws = workspaceId;
    const base = `/api/workspaces/${ws}`;
    await api("POST", `${base}/members`, {
      token: anshika.token,
      body: { email: "rahul@example.com" },
    });

    // 2. Rooms, and who's online
    const joinedA = await join(a.socket, ws);
    check("The owner can join the workspace room", joinedA.ok, JSON.stringify(joinedA));
    check(
      "Joining returns who is online",
      joinedA.ok &&
        Array.isArray(joinedA.presence) &&
        joinedA.presence.some((person) => person.id === anshika.id),
      JSON.stringify(joinedA)
    );
    check("Another tab of the owner can join", (await join(a2.socket, ws)).ok);
    check("A member can join the workspace room", (await join(r.socket, ws)).ok);
    check(
      "The owner hears that the member came online",
      await waitFor(() => presenceNow(a.socket).some((person) => person.id === rahul.id))
    );
    check(
      "Two tabs of one person count as one person online",
      presenceNow(r.socket).filter((person) => person.id === anshika.id).length === 1
    );

    const outsider = await join(p.socket, ws);
    check(
      "A non-member is refused, with the same message REST gives",
      !outsider.ok && outsider.error === "Workspace not found",
      JSON.stringify(outsider)
    );
    check("A malformed workspace id is refused", !(await join(a.socket, "123")).ok);

    // 3. Tasks
    const tasks = `${base}/tasks`;
    const made = await api("POST", tasks, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { title: "Live task" },
    });
    const taskId = made.data.task.id;

    check(
      "A teammate hears task:created",
      await waitFor(() => received(r.socket, "task:created").length === 1)
    );
    const heard = received(r.socket, "task:created")[0]?.payload;
    check(
      "The event carries the task and the workspace",
      heard?.workspaceId === ws && heard?.task?.title === "Live task"
    );
    check(
      "The owner's other tab hears it too",
      await waitFor(() => received(a2.socket, "task:created").length === 1)
    );

    await sleep(400);
    check(
      "The tab that made the change gets no echo",
      received(a.socket, "task:created").length === 0
    );
    check("A non-member hears nothing at all", p.socket.events.length === 0);

    await api("PATCH", `${tasks}/${taskId}`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { title: "Renamed", priority: "high" },
    });
    check(
      "A teammate hears task:updated",
      await waitFor(() => received(r.socket, "task:updated")[0]?.payload?.task?.title === "Renamed")
    );

    await api("PATCH", `${tasks}/${taskId}/move`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { status: "review", afterId: null },
    });
    check(
      "A teammate hears task:moved with the new column",
      await waitFor(() => received(r.socket, "task:moved")[0]?.payload?.task?.status === "review")
    );

    // Rahul makes a change WITHOUT sending a socket id: everyone hears it, himself included.
    await api("POST", tasks, { token: rahul.token, body: { title: "From Rahul" } });
    check(
      "Without a socket id, every member hears the change",
      await waitFor(
        () =>
          received(a.socket, "task:created").length === 1 &&
          received(r.socket, "task:created").length === 2
      )
    );

    await api("DELETE", `${tasks}/${taskId}`, { token: anshika.token, socketId: a.socket.id });
    check(
      "A teammate hears task:deleted, with the id",
      await waitFor(() =>
        received(r.socket, "task:deleted").some((item) => item.payload?.taskId === taskId)
      )
    );

    const odd = await api("POST", tasks, {
      token: anshika.token,
      socketId: "x",
      body: { title: "Odd header" },
    });
    check("A malformed X-Socket-Id is ignored, and the request still works", odd.status === 201);

    // 4. Documents
    const docs = `${base}/documents`;
    const doc = (
      await api("POST", docs, {
        token: anshika.token,
        socketId: a.socket.id,
        body: { title: "Live doc" },
      })
    ).data.document;
    check(
      "A teammate hears document:created",
      await waitFor(() =>
        received(r.socket, "document:created").some((item) => item.payload?.document?.id === doc.id)
      )
    );

    await api("PATCH", `${docs}/${doc.id}`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { title: "Live doc v2", baseRevision: 0 },
    });
    check(
      "A teammate hears document:updated, with the new revision and no content",
      await waitFor(() => {
        const item = received(r.socket, "document:updated").find(
          (entry) => entry.payload?.document?.id === doc.id
        );
        return Boolean(item) && item.payload.document.revision === 1 && !("content" in item.payload.document);
      })
    );

    await api("DELETE", `${docs}/${doc.id}`, { token: anshika.token, socketId: a.socket.id });
    check(
      "A teammate hears document:deleted, with the id",
      await waitFor(() =>
        received(r.socket, "document:deleted").some((item) => item.payload?.documentId === doc.id)
      )
    );

    // 5. Presence while editing
    const doc2 = (
      await api("POST", docs, {
        token: anshika.token,
        socketId: a.socket.id,
        body: { title: "Edited together" },
      })
    ).data.document;

    const focused = await focus(r.socket, ws, doc2.id);
    check("A member can say they're editing a document", focused.ok, JSON.stringify(focused));
    check(
      "The owner sees who is editing it",
      await waitFor(() =>
        presenceNow(a.socket)
          .find((person) => person.id === rahul.id)
          ?.editing.includes(doc2.id)
      )
    );
    check("A non-member can't claim to be editing", !(await focus(p.socket, ws, doc2.id)).ok);
    check(
      "An unknown document is refused",
      !(await focus(r.socket, ws, "000000000000000000000000")).ok
    );

    await blur(r.socket, ws);
    check(
      "Stopping editing is announced",
      await waitFor(
        () => presenceNow(a.socket).find((person) => person.id === rahul.id)?.editing.length === 0
      )
    );
    await api("DELETE", `${docs}/${doc2.id}`, { token: anshika.token, socketId: a.socket.id });

    // 6. Snippets
    const snippets = `${base}/snippets`;
    const snippet = (
      await api("POST", snippets, {
        token: anshika.token,
        socketId: a.socket.id,
        body: { title: "Live snippet", code: "const a = 1;", language: "javascript" },
      })
    ).data.snippet;
    check(
      "A teammate hears snippet:created, with a preview and no full code",
      await waitFor(() => {
        const item = received(r.socket, "snippet:created").find(
          (entry) => entry.payload?.snippet?.id === snippet.id
        );
        return (
          Boolean(item) &&
          !("code" in item.payload.snippet) &&
          item.payload.snippet.preview === "const a = 1;"
        );
      })
    );

    await api("PATCH", `${snippets}/${snippet.id}`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { title: "Live snippet v2", baseRevision: 0 },
    });
    check(
      "A teammate hears snippet:updated",
      await waitFor(() =>
        received(r.socket, "snippet:updated").some(
          (item) => item.payload?.snippet?.id === snippet.id && item.payload.snippet.revision === 1
        )
      )
    );

    await api("DELETE", `${snippets}/${snippet.id}`, {
      token: anshika.token,
      socketId: a.socket.id,
    });
    check(
      "A teammate hears snippet:deleted, with the id",
      await waitFor(() =>
        received(r.socket, "snippet:deleted").some((item) => item.payload?.snippetId === snippet.id)
      )
    );

    // 7. Members
    await api("POST", `${base}/members`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { email: "priya@example.com" },
    });
    check(
      "Teammates hear member:added",
      await waitFor(() =>
        received(r.socket, "member:added").some(
          (item) => item.payload?.member?.email === "priya@example.com"
        )
      )
    );
    check(
      "The other tab of the person who added her hears it too",
      await waitFor(() => received(a2.socket, "member:added").length === 1)
    );
    check(
      "The person who was added hears workspace:added",
      await waitFor(() =>
        received(p.socket, "workspace:added").some((item) => item.payload?.workspaceId === ws)
      )
    );
    check("She can now join the room", (await join(p.socket, ws)).ok);
    check(
      "Teammates see her come online",
      await waitFor(() => presenceNow(a.socket).some((person) => person.id === priya.id))
    );

    // Closing a tab must update who's online.
    p.socket.close();
    check(
      "Teammates see her go offline when her tab closes",
      await waitFor(() => !presenceNow(a.socket).some((person) => person.id === priya.id))
    );

    const p2 = await connect(priya.token);
    if (p2.ok) sockets.push(p2.socket);
    await join(p2.socket, ws);

    await api("PATCH", `${base}/members/${priya.id}`, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { role: "admin" },
    });
    check(
      "Teammates hear member:updated with the new role",
      await waitFor(() =>
        received(r.socket, "member:updated").some(
          (item) => item.payload?.member?.id === priya.id && item.payload.member.role === "admin"
        )
      )
    );

    // 8. The workspace itself
    await api("PATCH", base, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { name: "Realtime Check (renamed)" },
    });
    check(
      "Teammates hear workspace:updated with the new name",
      await waitFor(() =>
        received(r.socket, "workspace:updated").some(
          (item) => item.payload?.name === "Realtime Check (renamed)"
        )
      )
    );

    // 9. Removing someone must take their live access away at once.
    await api("DELETE", `${base}/members/${rahul.id}`, {
      token: anshika.token,
      socketId: a.socket.id,
    });
    check(
      "The removed person is told their access is gone",
      await waitFor(() =>
        received(r.socket, "workspace:access-lost").some(
          (item) => item.payload?.workspaceId === ws && item.payload?.reason === "removed"
        )
      )
    );
    check(
      "The others hear member:removed",
      await waitFor(() =>
        received(p2.socket, "member:removed").some(
          (item) => item.payload?.userId === rahul.id && item.payload?.reason === "removed"
        )
      )
    );
    check(
      "Boards are told to refresh (his tasks were unassigned)",
      await waitFor(() => received(p2.socket, "tasks:refresh").length >= 1)
    );
    check(
      "Teammates see him go offline",
      await waitFor(() => !presenceNow(a.socket).some((person) => person.id === rahul.id))
    );

    await sleep(300);
    const heardBefore = r.socket.events.length;
    await api("POST", tasks, {
      token: anshika.token,
      socketId: a.socket.id,
      body: { title: "After removal" },
    });
    await sleep(500);
    check("The removed person hears nothing more", r.socket.events.length === heardBefore);
    check("...and can't join the room again", !(await join(r.socket, ws)).ok);

    // 10. Leaving works the same way.
    await api("DELETE", `${base}/members/${priya.id}`, {
      token: priya.token,
      socketId: p2.socket.id,
    });
    check(
      "A person who leaves is told their access is gone",
      await waitFor(() =>
        received(p2.socket, "workspace:access-lost").some((item) => item.payload?.reason === "left")
      )
    );
    check(
      "The owner hears that she left",
      await waitFor(() =>
        received(a.socket, "member:removed").some(
          (item) => item.payload?.userId === priya.id && item.payload?.reason === "left"
        )
      )
    );

    // 11. Deleting the workspace tells everyone still in it.
    await api("DELETE", base, { token: anshika.token, socketId: a.socket.id });
    workspaceId = null;
    check(
      "Everyone still in the workspace hears workspace:deleted",
      await waitFor(() =>
        received(a2.socket, "workspace:deleted").some((item) => item.payload?.workspaceId === ws)
      )
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