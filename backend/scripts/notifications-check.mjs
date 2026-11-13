// A self-test for notifications, run against the live backend. It creates one throwaway
// person to RECEIVE notifications (so your real accounts' notifications and settings are
// never touched), has Anshika and Rahul do things in a small workspace, and prints PASS or
// FAIL for each rule. The throwaway person's notifications are all inside the test
// workspace, so deleting it at the end removes them.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/notifications-check.mjs

import { io } from "socket.io-client";

const API = process.env.API_URL || "http://localhost:5000";
const PASSWORD = "Password123";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
  const { status, data } = await api("POST", "/api/auth/login", { body: { email, password: PASSWORD } });
  if (status !== 200) throw new Error(`Couldn't log in as ${email} (status ${status})`);
  return { token: data.token, id: data.user.id };
}

// Opens a live connection. Everything it receives is collected in socket.events.
function connect(token) {
  return new Promise((resolve) => {
    const socket = io(API, { auth: { token }, transports: ["websocket"], reconnection: false });
    socket.events = [];
    socket.onAny((event, payload) => socket.events.push({ event, payload }));

    socket.on("connect", () => resolve({ ok: true, socket }));
    socket.on("connect_error", (error) => {
      socket.close();
      resolve({ ok: false, error: error.message });
    });
  });
}

const received = (socket, event) => socket.events.filter((item) => item.event === event);

async function main() {
  console.log(`Checking notifications at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");

  // A throwaway person who receives everything.
  const email = `notify-check-${Date.now()}@example.com`;
  const registered = await api("POST", "/api/auth/register", {
    body: { name: "Notify Check", email, password: PASSWORD },
  });
  if (![200, 201].includes(registered.status)) {
    throw new Error(`Couldn't create the test person (status ${registered.status}: ${registered.data?.message})`);
  }
  const temp = await login(email);

  const sockets = [];
  let workspaceId = null;

  try {
    const created = await api("POST", "/api/workspaces", { token: anshika.token, body: { name: "Notify Check" } });
    workspaceId = created.data.workspace.id;
    const ws = workspaceId;
    const base = `/api/workspaces/${ws}`;

    // The throwaway person has two tabs open.
    const tab1 = await connect(temp.token);
    const tab2 = await connect(temp.token);
    if (!tab1.ok || !tab2.ok) throw new Error("Couldn't connect to the live server. Is the backend running?");
    sockets.push(tab1.socket, tab2.socket);
    const a1 = tab1.socket;
    const a2 = tab2.socket;

    const listRaw = (who, params = {}) =>
      api("GET", `/api/notifications?${new URLSearchParams({ limit: "100", ...params })}`, { token: who.token });
    const list = async (who, params = {}) => (await listRaw(who, { workspace: ws, ...params })).data?.notifications ?? [];
    const unread = async (who) => (await api("GET", "/api/notifications/unread-count", { token: who.token })).data?.unreadCount;
    const makeTask = (token, body) => api("POST", `${base}/tasks`, { token, body });
    const patchTask = (token, id, body) => api("PATCH", `${base}/tasks/${id}`, { token, body });
    const created_ = (n) => received(a1, "notification:created").length === n;
    const changedCount = (socket) => received(socket, "notification:changed").length;

    // 1. Who may use it?
    check("Without a login, the list is refused", (await api("GET", "/api/notifications")).status === 401);
    check("...and so is the count", (await api("GET", "/api/notifications/unread-count")).status === 401);
    check("...and so are the settings", (await api("GET", "/api/notifications/preferences")).status === 401);
    check("...and so is marking everything read", (await api("POST", "/api/notifications/read-all")).status === 401);

    const anshikaBefore = await unread(anshika);
    check("A brand-new person has nothing", (await unread(temp)) === 0 && (await list(temp)).length === 0);

    // 2. Being added
    await api("POST", `${base}/members`, { token: anshika.token, body: { email } });
    check(
      "Being added is delivered live, with the new unread count",
      (await waitFor(() => created_(1))) && received(a1, "notification:created")[0].payload.unreadCount === 1
    );
    check("Both of the person's tabs hear it", await waitFor(() => received(a2, "notification:created").length === 1));

    const added = (await list(temp))[0];
    check(
      "It says who, what, where and when",
      added?.kind === "member.added" &&
        added.actor.name === "Anshika" &&
        added.actor.id === anshika.id &&
        added.workspace.id === ws &&
        added.workspace.name === "Notify Check" &&
        added.target.type === "workspace" &&
        added.target.id === ws &&
        added.target.name === "Notify Check" &&
        added.meta.role === "member" &&
        added.read === false &&
        added.readAt === null,
      JSON.stringify(added)
    );
    check(
      "A notification has exactly these fields",
      same(Object.keys(added).sort(), ["actor", "createdAt", "id", "kind", "meta", "read", "readAt", "target", "workspace"])
    );
    check("The count endpoint agrees", (await unread(temp)) === 1);

    await api("POST", `${base}/members`, { token: anshika.token, body: { email: "rahul@example.com" } });

    // 3. Being assigned a task
    const task1 = (await makeTask(anshika.token, { title: "Login API", assignee: temp.id })).data.task;
    check("Being assigned a task is delivered live", await waitFor(() => created_(2)));

    const assigned = (await list(temp))[0];
    check(
      "It names the task, the person who assigned it, and a few facts about it",
      assigned?.kind === "task.assigned" &&
        assigned.target.type === "task" &&
        assigned.target.id === task1.id &&
        assigned.target.name === "Login API" &&
        assigned.actor.name === "Anshika" &&
        assigned.meta.priority === "medium" &&
        assigned.meta.dueDate === null,
      JSON.stringify(assigned)
    );

    const forSelf = await makeTask(anshika.token, { title: "Mine", assignee: anshika.id });
    await sleep(400);
    check(
      "Assigning a task to yourself notifies nobody",
      forSelf.status === 201 && created_(2) && (await unread(anshika)) === anshikaBefore
    );

    await patchTask(anshika.token, task1.id, { assignee: null });
    await patchTask(anshika.token, task1.id, { assignee: temp.id });
    await sleep(500);
    check(
      "Unassigning and reassigning the same task within minutes counts once",
      created_(2) && (await list(temp)).filter((item) => item.kind === "task.assigned").length === 1
    );

    const task2 = (await makeTask(anshika.token, { title: "Second" })).data.task;
    await patchTask(anshika.token, task2.id, { assignee: temp.id });
    check("Assigning an existing task (by editing it) also notifies", await waitFor(() => created_(3)));

    const task3 = (await makeTask(anshika.token, { title: "Third" })).data.task;
    await patchTask(rahul.token, task3.id, { assignee: temp.id });
    check("A plain member can assign a task, and is named as the one who did", await waitFor(() => created_(4)) && (await list(temp))[0].actor.name === "Rahul");

    await makeTask(anshika.token, { title: "For Rahul", assignee: rahul.id });
    await sleep(400);
    check("A task assigned to someone else doesn't notify this person", created_(4));
    const rahulsList = await list(rahul);
    check(
      "...it notifies THEM, and only about this workspace",
      rahulsList.length === 2 && rahulsList.some((item) => item.kind === "task.assigned" && item.target.name === "For Rahul") && rahulsList.every((item) => item.workspace.id === ws)
    );

    // 4. Role changes, being removed, leaving
    await api("PATCH", `${base}/members/${temp.id}`, { token: anshika.token, body: { role: "admin" } });
    check("A role change is delivered live", await waitFor(() => created_(5)));
    const promoted = (await list(temp))[0];
    check("It says the old and new role", promoted.kind === "member.role_changed" && promoted.meta.from === "member" && promoted.meta.role === "admin", JSON.stringify(promoted.meta));

    await api("PATCH", `${base}/members/${temp.id}`, { token: anshika.token, body: { role: "member" } });
    check("A second role change right away is NOT collapsed", (await waitFor(() => created_(6))) && (await list(temp))[0].meta.role === "member");

    await api("DELETE", `${base}/members/${temp.id}`, { token: anshika.token });
    check("Being removed is delivered live", await waitFor(() => created_(7)));
    const removed = (await list(temp))[0];
    check(
      "A removed person can still read the notice, even without access to the workspace",
      removed?.kind === "member.removed" && removed.actor.name === "Anshika" && removed.workspace.name === "Notify Check" && (await listRaw(temp)).status === 200
    );
    check(
      "...and the workspace itself is closed to them",
      (await api("GET", base, { token: temp.token })).status === 404
    );

    await api("POST", `${base}/members`, { token: anshika.token, body: { email } });
    check("Being added again is a new notification", await waitFor(() => created_(8)));

    await api("DELETE", `${base}/members/${temp.id}`, { token: temp.token });
    await sleep(500);
    check("Leaving on your own doesn't notify you", created_(8));

    // 5. The list, filters and paging
    const everything = await list(temp);
    check(
      "The list has all 8, newest first",
      everything.length === 8 && everything.every((item, i) => i === 0 || everything[i - 1].id > item.id),
      `${everything.length} items`
    );
    check(
      "They are the right kinds, in the right order",
      same(everything.map((item) => item.kind).reverse(), [
        "member.added",
        "task.assigned",
        "task.assigned",
        "task.assigned",
        "member.role_changed",
        "member.role_changed",
        "member.removed",
        "member.added",
      ])
    );

    const walked = [];
    let cursor = null;
    let pages = 0;
    do {
      const params = { workspace: ws, limit: "3" };
      if (cursor) params.before = cursor;
      const page = (await listRaw(temp, params)).data;
      walked.push(...page.notifications);
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 20);
    check(
      "Paging 3 at a time gives every notification exactly once, in the same order",
      pages === 3 && same(walked.map((item) => item.id), everything.map((item) => item.id)),
      `${pages} pages, ${walked.length} items`
    );
    check("A page that isn't the last gives a cursor", typeof (await listRaw(temp, { workspace: ws, limit: "3" })).data.nextCursor === "string");

    const filtered = await listRaw(temp, { workspace: ws, unread: "true" });
    check("unread=true returns the unread ones, and the list reports the count", filtered.data.notifications.length === 8 && filtered.data.unreadCount === 8);
    check("A workspace with nothing for this person gives an empty list", (await list(temp, { workspace: "0".repeat(24) })).length === 0);
    check("A malformed workspace filter is refused", (await listRaw(temp, { workspace: "abc" })).status === 400);
    check("A malformed cursor is refused", (await listRaw(temp, { before: "zzz" })).status === 400);

    // 6. Marking as read
    const newest = everything[0];
    const readOnce = await api("POST", `/api/notifications/${newest.id}/read`, { token: temp.token });
    check(
      "Marking one as read works, and says how many are left",
      readOnce.status === 200 && readOnce.data.notification.read === true && readOnce.data.notification.readAt !== null && readOnce.data.unreadCount === 7,
      JSON.stringify(readOnce.data)
    );
    const readTwice = await api("POST", `/api/notifications/${newest.id}/read`, { token: temp.token });
    check(
      "Doing it again is fine and changes nothing",
      readTwice.status === 200 && readTwice.data.unreadCount === 7 && readTwice.data.notification.readAt === readOnce.data.notification.readAt
    );
    check("The count endpoint agrees", (await unread(temp)) === 7);

    const hers = await api("POST", `/api/notifications/${everything[1].id}/read`, { token: rahul.token });
    check(
      "Someone else can't read it: they get the same 'not found' as for an id that doesn't exist",
      hers.status === 404 && hers.data?.message === "Notification not found" && (await unread(temp)) === 7,
      JSON.stringify(hers.data)
    );
    check("A made-up id is 'not found'", (await api("POST", `/api/notifications/${"0".repeat(24)}/read`, { token: temp.token })).status === 404);
    check("A malformed id is 'not found'", (await api("POST", "/api/notifications/123/read", { token: temp.token })).status === 404);
    check("Without a login it is refused", (await api("POST", `/api/notifications/${newest.id}/read`)).status === 401);

    // 7. The other tab hears about it, but the tab that did it doesn't.
    // (The unnamed read above told BOTH tabs once, so each is measured from where it is now.)
    const tab1Changed = changedCount(a1);
    const tab2Changed = changedCount(a2);

    await api("POST", `/api/notifications/${everything[1].id}/read`, { token: temp.token, socketId: a1.id });
    check(
      "Reading in one tab tells the person's other tab the new count",
      (await waitFor(() => changedCount(a2) === tab2Changed + 1)) && received(a2, "notification:changed").at(-1).payload.unreadCount === 6
    );
    await sleep(300);
    check("...but not the tab that did it", changedCount(a1) === tab1Changed);

    await api("POST", `/api/notifications/${everything[2].id}/read`, { token: temp.token });
    check(
      "Without a tab named, both tabs hear it",
      await waitFor(() => changedCount(a1) === tab1Changed + 1 && changedCount(a2) === tab2Changed + 2)
    );

    // 8. Read all
    const all = await api("POST", "/api/notifications/read-all", { token: temp.token, socketId: a1.id });
    check("Reading everything says how many it changed, and leaves none", all.status === 200 && all.data.updated === 5 && all.data.unreadCount === 0, JSON.stringify(all.data));
    check("Nothing is unread afterwards", (await list(temp, { unread: "true" })).length === 0 && (await unread(temp)) === 0);
    check("Doing it again changes nothing", (await api("POST", "/api/notifications/read-all", { token: temp.token })).data.updated === 0);
    check("The other tab was told", await waitFor(() => received(a2, "notification:changed").at(-1)?.payload?.unreadCount === 0));

    // 9. Dismissing
    const doomed = everything[3];
    const dismissed = await api("DELETE", `/api/notifications/${doomed.id}`, { token: temp.token });
    check("Dismissing one works", dismissed.status === 204 && (await list(temp)).length === 7 && (await list(temp)).every((item) => item.id !== doomed.id));
    check("Dismissing it again is 'not found'", (await api("DELETE", `/api/notifications/${doomed.id}`, { token: temp.token })).status === 404);
    check("Someone else can't dismiss it", (await api("DELETE", `/api/notifications/${everything[4].id}`, { token: rahul.token })).status === 404 && (await list(temp)).length === 7);
    check("Without a login it is refused", (await api("DELETE", `/api/notifications/${everything[4].id}`)).status === 401);

    // Being added back is one new notification, and being assigned a task is another: two unread.
    const createdBefore = received(a1, "notification:created").length;
    await api("POST", `${base}/members`, { token: anshika.token, body: { email } });
    await waitFor(() => received(a1, "notification:created").length === createdBefore + 1);
    const task4 = (await makeTask(anshika.token, { title: "Dismiss me", assignee: temp.id })).data.task;
    await waitFor(() => received(a1, "notification:created").length === createdBefore + 2);
    check("Being added back, then assigned a task, gives two unread notifications", (await unread(temp)) === 2);

    const fresh = (await list(temp))[0];
    const a1Before = changedCount(a1);
    const a2Before = changedCount(a2);
    await api("DELETE", `/api/notifications/${fresh.id}`, { token: temp.token, socketId: a1.id });
    check(
      "Dismissing an unread one lowers the count by one, and the other tab hears it",
      fresh.kind === "task.assigned" && (await unread(temp)) === 1 && (await waitFor(() => changedCount(a2) === a2Before + 1))
    );
    await sleep(300);
    check("...but the tab that did it isn't told", changedCount(a1) === a1Before);
    check("(that task still exists: dismissing only removes the notice)", (await api("GET", `${base}/tasks/${task4.id}`, { token: anshika.token })).status === 200);

    // 10. Settings
    const rahulPrefsBefore = (await api("GET", "/api/notifications/preferences", { token: rahul.token })).data;
    const prefs0 = (await api("GET", "/api/notifications/preferences", { token: temp.token })).data.preferences;
    check(
      "Settings list every kind, all on, with a label and a description",
      prefs0.length === 4 &&
        prefs0.every((item) => item.enabled === true && item.label && item.description && same(Object.keys(item).sort(), ["description", "enabled", "kind", "label"])) &&
        same(prefs0.map((item) => item.kind), ["task.assigned", "member.added", "member.role_changed", "member.removed"])
    );

    const mute = await api("PUT", "/api/notifications/preferences/task.assigned", { token: temp.token, body: { enabled: false } });
    check(
      "Switching a kind off works, and only that one changes",
      mute.status === 200 && mute.data.preferences.find((item) => item.kind === "task.assigned").enabled === false && mute.data.preferences.filter((item) => item.enabled).length === 3
    );
    check(
      "It is remembered",
      (await api("GET", "/api/notifications/preferences", { token: temp.token })).data.preferences.find((item) => item.kind === "task.assigned").enabled === false
    );
    check(
      "Switching it off twice is fine",
      (await api("PUT", "/api/notifications/preferences/task.assigned", { token: temp.token, body: { enabled: false } })).data.preferences.filter((item) => !item.enabled).length === 1
    );

    const mutedBefore = await unread(temp);
    const createdMark = received(a1, "notification:created").length;
    const task5 = (await makeTask(anshika.token, { title: "Muted one" })).data.task;
    await patchTask(anshika.token, task5.id, { assignee: temp.id });
    await sleep(500);
    check(
      "With 'tasks assigned to you' off, being assigned a task notifies nobody",
      (await unread(temp)) === mutedBefore && received(a1, "notification:created").length === createdMark
    );

    await api("PATCH", `${base}/members/${temp.id}`, { token: anshika.token, body: { role: "admin" } });
    check("...but other kinds still arrive", await waitFor(() => received(a1, "notification:created").length === createdMark + 1));

    const unmute = await api("PUT", "/api/notifications/preferences/task.assigned", { token: temp.token, body: { enabled: true } });
    check("Switching it back on works", unmute.status === 200 && unmute.data.preferences.every((item) => item.enabled));
    const task6 = (await makeTask(anshika.token, { title: "Unmuted one", assignee: temp.id })).data.task;
    check("...and then being assigned notifies again", (await waitFor(() => received(a1, "notification:created").length === createdMark + 2)) && task6.id.length === 24);

    check("An unknown kind is refused", (await api("PUT", "/api/notifications/preferences/robot.dance", { token: temp.token, body: { enabled: false } })).status === 400);
    check("A missing value is refused", (await api("PUT", "/api/notifications/preferences/task.assigned", { token: temp.token, body: {} })).status === 400);
    check("A value that isn't true or false is refused", (await api("PUT", "/api/notifications/preferences/task.assigned", { token: temp.token, body: { enabled: "no" } })).status === 400);
    check("Without a login it is refused", (await api("PUT", "/api/notifications/preferences/task.assigned", { body: { enabled: false } })).status === 401);
    check(
      "One person's settings never affect another's",
      same((await api("GET", "/api/notifications/preferences", { token: rahul.token })).data, rahulPrefsBefore)
    );

    // 11. Deleting the workspace takes its notifications with it
    check("Before deleting, there are notifications for this workspace", (await list(temp)).length > 0 && (await list(rahul)).length > 0);
    await api("DELETE", base, { token: anshika.token });
    workspaceId = null;
    check(
      "Deleting the workspace removes everyone's notifications about it",
      (await list(temp)).length === 0 && (await list(rahul)).length === 0 && (await unread(temp)) === 0
    );
  } finally {
    for (const socket of sockets) socket.close();
    if (workspaceId) await api("DELETE", `/api/workspaces/${workspaceId}`, { token: anshika.token });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  process.exit(1);
});