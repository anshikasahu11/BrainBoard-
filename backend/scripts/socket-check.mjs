// A self-test for the real-time server. It connects as three different people,
// tries the things that must be refused, makes changes over REST, and prints
// PASS or FAIL for each rule.
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
  return data.token;
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

const join = (socket, workspaceId) =>
  new Promise((resolve) => {
    socket.timeout(3000).emit("workspace:join", workspaceId, (error, response) => {
      resolve(error ? { ok: false, error: "no answer" } : response);
    });
  });

const received = (socket, event) => socket.events.filter((item) => item.event === event);

async function main() {
  console.log(`Checking the real-time server at ${API}\n`);

  const tokens = {
    anshika: await login("anshika@example.com"),
    rahul: await login("rahul@example.com"),
    priya: await login("priya@example.com"),
  };

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

    const a = await connect(tokens.anshika);
    const r = await connect(tokens.rahul);
    const p = await connect(tokens.priya);
    for (const entry of [a, r, p]) if (entry.ok) sockets.push(entry.socket);
    check("People with valid tokens can connect", a.ok && r.ok && p.ok);
    if (!(a.ok && r.ok && p.ok)) throw new Error("Couldn't connect. Is the backend running?");

    // A workspace: Anshika owns it, Rahul is a member, Priya is NOT in it.
    const created = await api("POST", "/api/workspaces", {
      token: tokens.anshika,
      body: { name: "Realtime Check" },
    });
    workspaceId = created.data.workspace.id;
    await api("POST", `/api/workspaces/${workspaceId}/members`, {
      token: tokens.anshika,
      body: { email: "rahul@example.com" },
    });

    // 2. Who may listen to the workspace?
    check("The owner can join the workspace room", (await join(a.socket, workspaceId)).ok);
    check("A member can join the workspace room", (await join(r.socket, workspaceId)).ok);

    const outsider = await join(p.socket, workspaceId);
    check(
      "A non-member is refused, with the same message REST gives",
      !outsider.ok && outsider.error === "Workspace not found",
      JSON.stringify(outsider)
    );
    check("A malformed workspace id is refused", !(await join(a.socket, "123")).ok);

    // 3. Do the right people hear about changes?
    const base = `/api/workspaces/${workspaceId}/tasks`;

    const made = await api("POST", base, {
      token: tokens.anshika,
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
      heard?.workspaceId === workspaceId && heard?.task?.title === "Live task"
    );

    await sleep(400);
    check(
      "The person who made the change gets no echo",
      received(a.socket, "task:created").length === 0
    );
    check("A non-member hears nothing at all", p.socket.events.length === 0);

    await api("PATCH", `${base}/${taskId}`, {
      token: tokens.anshika,
      socketId: a.socket.id,
      body: { title: "Renamed", priority: "high" },
    });
    check(
      "A teammate hears task:updated",
      await waitFor(() => received(r.socket, "task:updated")[0]?.payload?.task?.title === "Renamed")
    );

    await api("PATCH", `${base}/${taskId}/move`, {
      token: tokens.anshika,
      socketId: a.socket.id,
      body: { status: "review", afterId: null },
    });
    check(
      "A teammate hears task:moved with the new column",
      await waitFor(() => received(r.socket, "task:moved")[0]?.payload?.task?.status === "review")
    );

    // Rahul makes a change WITHOUT sending a socket id: everyone hears it, himself included.
    await api("POST", base, { token: tokens.rahul, body: { title: "From Rahul" } });
    check(
      "Without a socket id, every member hears the change",
      await waitFor(
        () =>
          received(a.socket, "task:created").length === 1 &&
          received(r.socket, "task:created").length === 2
      )
    );

    await api("DELETE", `${base}/${taskId}`, { token: tokens.anshika, socketId: a.socket.id });
    check(
      "A teammate hears task:deleted, with the id",
      await waitFor(() =>
        received(r.socket, "task:deleted").some((item) => item.payload?.taskId === taskId)
      )
    );

    // A made-up X-Socket-Id must not break anything.
    const odd = await api("POST", base, {
      token: tokens.anshika,
      socketId: "x",
      body: { title: "Odd header" },
    });
    check("A malformed X-Socket-Id is ignored, and the request still works", odd.status === 201);

    await sleep(300);
    check("The non-member still heard nothing", p.socket.events.length === 0);
  } finally {
    for (const socket of sockets) socket.close();
    if (workspaceId) await api("DELETE", `/api/workspaces/${workspaceId}`, { token: tokens.anshika });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  process.exit(1);
});