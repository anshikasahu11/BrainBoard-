// A self-test for due-date reminders. It builds a small workspace through the running backend,
// then runs the reminder job ITSELF against the same database, with a pretend clock set in the
// year 2030 and limited to the test workspace, so it can't touch anything real. Two throwaway
// people receive the reminders, so your own accounts are never involved.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/reminders-check.mjs

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { runReminders } from "../services/reminderService.js";

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

async function newPerson(name) {
  const email = `reminder-${name.toLowerCase()}-${Date.now()}@example.com`;
  const registered = await api("POST", "/api/auth/register", { body: { name: `Reminder ${name}`, email, password: PASSWORD } });
  if (![200, 201].includes(registered.status)) {
    throw new Error(`Couldn't create the test person (status ${registered.status}: ${registered.data?.message})`);
  }
  return { ...(await login(email)), email };
}

// The pretend clocks. 20:00 UTC is already the next morning in Kolkata (01:30).
const NOW1 = new Date("2030-06-15T20:00:00Z"); // UTC: June 15th.   Kolkata: June 16th.
const NOW2 = new Date("2030-06-16T20:00:00Z"); // UTC: June 16th.   Kolkata: June 17th.
const NOW3 = new Date("2030-06-17T20:00:00Z"); // UTC: June 17th.   Kolkata: June 18th.
const NOW4 = new Date("2030-06-25T20:00:00Z"); // UTC: June 25th.   Kolkata: June 26th.   Pago Pago: June 25th.

async function main() {
  console.log(`Checking reminders at ${API}\n`);

  await connectDB();

  const anshika = await login("anshika@example.com");
  const a = await newPerson("A"); // will be in Asia/Kolkata
  const b = await newPerson("B"); // never sets a time zone, so UTC

  let workspaceId = null;

  try {
    // ---------- 1. Time zone settings ----------
    check("Without a login, setting a time zone is refused", (await api("PUT", "/api/notifications/time-zone", { body: { timeZone: "UTC" } })).status === 401);

    const before = await api("GET", "/api/notifications/preferences", { token: a.token });
    check("A new person has no time zone yet", before.status === 200 && before.data.timeZone === null);
    check("...and the settings still list every kind", before.data.preferences.length >= 6 && before.data.preferences.some((item) => item.kind === "task.due_soon") && before.data.preferences.some((item) => item.kind === "task.overdue"));

    for (const bad of ["Mars/Olympus", "../etc/passwd", "", "   ", "A".repeat(100), "Asia//Kolkata"]) {
      const reply = await api("PUT", "/api/notifications/time-zone", { token: a.token, body: { timeZone: bad } });
      check(`A time zone of ${JSON.stringify(bad.length > 20 ? `${bad.slice(0, 10)}...` : bad)} is refused`, reply.status === 400 && Boolean(reply.data?.errors?.timeZone), `${reply.status} ${JSON.stringify(reply.data)}`);
    }
    check("A time zone that isn't text is refused", (await api("PUT", "/api/notifications/time-zone", { token: a.token, body: { timeZone: 5 } })).status === 400);
    check("A missing time zone is refused", (await api("PUT", "/api/notifications/time-zone", { token: a.token, body: {} })).status === 400);
    check("Nothing was saved by those", (await api("GET", "/api/notifications/preferences", { token: a.token })).data.timeZone === null);

    const set = await api("PUT", "/api/notifications/time-zone", { token: a.token, body: { timeZone: "  Asia/Kolkata  " } });
    check("A real time zone is saved (spaces around it are fine)", set.status === 200 && set.data.timeZone === "Asia/Kolkata", JSON.stringify(set.data));
    check("...and remembered", (await api("GET", "/api/notifications/preferences", { token: a.token })).data.timeZone === "Asia/Kolkata");
    check("It's personal: the other person still has none", (await api("GET", "/api/notifications/preferences", { token: b.token })).data.timeZone === null);
    check("Saving a time zone leaves the on/off settings alone", (await api("GET", "/api/notifications/preferences", { token: a.token })).data.preferences.every((item) => item.enabled));

    // ---------- 2. A small workspace ----------
    const created = await api("POST", "/api/workspaces", { token: anshika.token, body: { name: "Reminder Check" } });
    workspaceId = created.data.workspace.id;
    const ws = workspaceId;
    const base = `/api/workspaces/${ws}`;

    await api("POST", `${base}/members`, { token: anshika.token, body: { email: a.email } });
    await api("POST", `${base}/members`, { token: anshika.token, body: { email: b.email } });

    const addTask = async (body) => {
      const reply = await api("POST", `${base}/tasks`, { token: anshika.token, body });
      if (reply.status !== 201) throw new Error(`Couldn't create the test task "${body.title}" (status ${reply.status}: ${reply.data?.message})`);
      return reply.data.task;
    };
    const patchTask = (task, body) => api("PATCH", `${base}/tasks/${task.id}`, { token: anshika.token, body });

    const run = (now, extra = {}) => runReminders({ now, workspaceId: ws, ...extra });
    const reminders = async (who) => {
      const reply = await api("GET", `/api/notifications?${new URLSearchParams({ limit: "100", workspace: ws })}`, { token: who.token });
      return (reply.data?.notifications ?? []).filter((item) => item.kind === "task.due_soon" || item.kind === "task.overdue");
    };
    const forTask = (list, task, kind) => list.filter((item) => item.target.id === task.id && item.kind === kind);

    // A is in Kolkata. B is in UTC. On the first pretend clock, A's date is June 16th and B's is June 15th.
    const a1 = await addTask({ title: "A due today", assignee: a.id, dueDate: "2030-06-16" });
    const a2 = await addTask({ title: "A late by two", assignee: a.id, dueDate: "2030-06-14" });
    const a3 = await addTask({ title: "A late by five", assignee: a.id, dueDate: "2030-06-11" });
    const a4 = await addTask({ title: "A far ahead", assignee: a.id, dueDate: "2030-06-20" });
    const a5 = await addTask({ title: "A already done", assignee: a.id, dueDate: "2030-06-16", status: "done" });
    const a6 = await addTask({ title: "A tomorrow", assignee: a.id, dueDate: "2030-06-17" });
    const b1 = await addTask({ title: "B tomorrow", assignee: b.id, dueDate: "2030-06-16" });
    const b2 = await addTask({ title: "B today", assignee: b.id, dueDate: "2030-06-15" });
    const b3 = await addTask({ title: "B late by one", assignee: b.id, dueDate: "2030-06-14" });
    await addTask({ title: "Nobody's", dueDate: "2030-06-16" });
    await addTask({ title: "No date", assignee: a.id });

    // ---------- 3. The first run ----------
    const r1 = await run(NOW1);
    check(
      "The first run looks at the 7 tasks in range, and sends the 6 that apply",
      r1.ok && r1.considered === 7 && r1.planned === 6 && r1.created === 6 && r1.alreadySent === 0 && r1.deferred === 0,
      JSON.stringify(r1)
    );

    let aList = await reminders(a);
    let bList = await reminders(b);
    check("A gets three reminders and B gets three", aList.length === 3 && bList.length === 3, `${aList.length} and ${bList.length}`);

    const a1Soon = forTask(aList, a1, "task.due_soon")[0];
    check(
      "A reminder says which task, which due date, and how soon",
      a1Soon?.target.type === "task" &&
        a1Soon.target.id === a1.id &&
        a1Soon.target.name === "A due today" &&
        a1Soon.meta.dueDate === "2030-06-16" &&
        a1Soon.meta.days === 0 &&
        a1Soon.meta.priority === "medium" &&
        a1Soon.workspace.id === ws &&
        a1Soon.workspace.name === "Reminder Check" &&
        a1Soon.read === false,
      JSON.stringify(a1Soon)
    );
    check("It has nobody behind it", a1Soon?.actor === null);
    check("It has exactly the usual fields", same(Object.keys(a1Soon).sort(), ["actor", "createdAt", "id", "kind", "meta", "read", "readAt", "target", "workspace"]));
    check("A's other reminders: 'tomorrow' for one task and 'late by 2 days' for another", forTask(aList, a6, "task.due_soon")[0]?.meta.days === 1 && forTask(aList, a2, "task.overdue")[0]?.meta.daysLate === 2);
    check(
      "Late by five days, far ahead, already done, and no date: nothing",
      forTask(aList, a3, "task.overdue").length === 0 && [a4, a5].every((task) => aList.every((item) => item.target.id !== task.id)) && aList.every((item) => item.target.name !== "No date")
    );
    check("Unassigned tasks remind nobody", [...aList, ...bList].every((item) => item.target.name !== "Nobody's"));

    check(
      "THE SAME DUE DATE: 'today' for A in Kolkata, 'tomorrow' for B in UTC",
      forTask(bList, b1, "task.due_soon")[0]?.meta.days === 1 && a1Soon.meta.dueDate === forTask(bList, b1, "task.due_soon")[0].meta.dueDate && a1Soon.meta.days === 0
    );
    check("B's other reminders: 'due today' and 'late by 1 day'", forTask(bList, b2, "task.due_soon")[0]?.meta.days === 0 && forTask(bList, b3, "task.overdue")[0]?.meta.daysLate === 1);

    // ---------- 4. Once each ----------
    const r2 = await run(NOW1);
    check("Running again at the same moment sends nothing", r2.ok && r2.created === 0 && r2.alreadySent === 6 && r2.planned === 6, JSON.stringify(r2));
    check("...and the lists are unchanged", (await reminders(a)).length === 3 && (await reminders(b)).length === 3);

    // ---------- 5. A day later ----------
    const r3 = await run(NOW2);
    check("A day later, only the new things are sent: 2 of the 6 that apply", r3.ok && r3.considered === 6 && r3.planned === 6 && r3.alreadySent === 4 && r3.created === 2, JSON.stringify(r3));

    aList = await reminders(a);
    bList = await reminders(b);
    check(
      "A's task that was due today is now overdue, and 'due soon' is NOT sent a second time",
      forTask(aList, a1, "task.overdue")[0]?.meta.daysLate === 1 && forTask(aList, a1, "task.due_soon").length === 1
    );
    check("B's 'today' task is now overdue too", forTask(bList, b2, "task.overdue")[0]?.meta.daysLate === 1 && forTask(bList, b2, "task.due_soon").length === 1);
    check("B's task that was 'tomorrow' becomes today, and is not announced again", forTask(bList, b1, "task.due_soon").length === 1 && forTask(bList, b1, "task.overdue").length === 0);
    check("An overdue reminder that was already sent isn't sent again", forTask(aList, a2, "task.overdue").length === 1 && forTask(bList, b3, "task.overdue").length === 1);

    // ---------- 6. Changing a due date earns a new reminder ----------
    await patchTask(a4, { dueDate: "2030-06-17" }); // Kolkata's today on the second clock
    const r4 = await run(NOW2);
    check("Moving a due date into range sends a reminder for it", r4.created === 1 && forTask(await reminders(a), a4, "task.due_soon")[0]?.meta.days === 0, JSON.stringify(r4));

    await patchTask(a4, { dueDate: "2030-06-18" });
    const r5 = await run(NOW2);
    check("Moving it again earns another, for the new date", r5.created === 1 && forTask(await reminders(a), a4, "task.due_soon").length === 2, JSON.stringify(r5));
    check("Each reminder remembers which date it was about", same(forTask(await reminders(a), a4, "task.due_soon").map((item) => item.meta.dueDate).sort(), ["2030-06-17", "2030-06-18"]));

    // ---------- 7. Finished tasks don't remind ----------
    const a7 = await addTask({ title: "A will be done", assignee: a.id, dueDate: "2030-06-17" });
    await patchTask(a7, { status: "done" });
    const r6 = await run(NOW2);
    check("A task finished before the reminder was due never sends one", r6.created === 0 && forTask(await reminders(a), a7, "task.due_soon").length === 0, JSON.stringify(r6));

    // ---------- 8. A muted reminder isn't lost ----------
    await api("PUT", "/api/notifications/preferences/task.due_soon", { token: a.token, body: { enabled: false } });
    const a8 = await addTask({ title: "A while muted", assignee: a.id, dueDate: "2030-06-17" });
    const r7 = await run(NOW2);
    check("With 'tasks due soon' switched off, nothing is sent for it", r7.created === 0 && forTask(await reminders(a), a8, "task.due_soon").length === 0, JSON.stringify(r7));

    await api("PUT", "/api/notifications/preferences/task.due_soon", { token: a.token, body: { enabled: true } });
    const r8 = await run(NOW2);
    check("Switched back on, the reminder that still applies arrives", r8.created === 1 && forTask(await reminders(a), a8, "task.due_soon")[0]?.meta.days === 0, JSON.stringify(r8));

    await api("PUT", "/api/notifications/preferences/task.overdue", { token: a.token, body: { enabled: false } });
    const a9 = await addTask({ title: "A late while muted", assignee: a.id, dueDate: "2030-06-16" });
    const r9 = await run(NOW2);
    check("Muting 'overdue' only stops overdue reminders: other kinds are unaffected", r9.created === 0 && forTask(await reminders(a), a9, "task.overdue").length === 0);
    await api("PUT", "/api/notifications/preferences/task.overdue", { token: a.token, body: { enabled: true } });
    check("...and they arrive when it is switched back on", (await run(NOW2)).created === 1 && forTask(await reminders(a), a9, "task.overdue").length === 1);

    // ---------- 9. People who are no longer members ----------
    const bBefore = (await reminders(b)).length;
    const removed = await api("DELETE", `${base}/members/${b.id}`, { token: anshika.token });
    check("Removing B unassigns their tasks", removed.status === 204 && (await api("GET", `${base}/tasks/${b1.id}`, { token: anshika.token })).data.task.assignee === null && (await api("GET", `${base}/tasks/${b3.id}`, { token: anshika.token })).data.task.assignee === null);

    const r10 = await run(NOW3);
    check("A day on, B gets nothing more, and A gets the 2 that are new (3 were already sent)", r10.ok && r10.planned === 5 && r10.alreadySent === 3 && r10.created === 2 && forTask(await reminders(a), a6, "task.overdue").length === 1 && forTask(await reminders(a), a8, "task.overdue").length === 1, JSON.stringify(r10));
    check("B's earlier reminders are still readable, and no new ones came", (await reminders(b)).length === bBefore);
    void b2;

    // ---------- 10. A busy day is spread over runs ----------
    const c1 = await addTask({ title: "Busy one", assignee: a.id, dueDate: "2030-06-18" });
    const c2 = await addTask({ title: "Busy two", assignee: a.id, dueDate: "2030-06-18" });
    const c3 = await addTask({ title: "Busy three", assignee: a.id, dueDate: "2030-06-18" });
    const beforeBusy = (await reminders(a)).length;

    const s1 = await run(NOW3, { limit: 1 });
    check("With a limit of 1, one is sent and the other two wait", s1.created === 1 && s1.deferred === 2, JSON.stringify(s1));
    const s2 = await run(NOW3, { limit: 1 });
    check("The next run sends the next one", s2.created === 1 && s2.deferred === 1, JSON.stringify(s2));
    const s3 = await run(NOW3, { limit: 1 });
    check("...and the one after that finishes it", s3.created === 1 && s3.deferred === 0, JSON.stringify(s3));
    const s4 = await run(NOW3, { limit: 1 });
    check("Then there is nothing left", s4.created === 0 && s4.deferred === 0, JSON.stringify(s4));
    const afterBusy = await reminders(a);
    check("Each of the three got exactly one reminder", afterBusy.length === beforeBusy + 3 && [c1, c2, c3].every((task) => forTask(afterBusy, task, "task.due_soon").length === 1));

    // ---------- 11. Two runs at the same moment ----------
    const d1 = await addTask({ title: "Race one", assignee: a.id, dueDate: "2030-06-18" });
    const d2 = await addTask({ title: "Race two", assignee: a.id, dueDate: "2030-06-18" });
    const beforeRace = (await reminders(a)).length;
    const [x, y] = await Promise.all([run(NOW3), run(NOW3)]);
    const afterRace = await reminders(a);
    check(
      "Two runs at once never send the same reminder twice",
      x.ok && y.ok && x.created + y.created === 2 && afterRace.length === beforeRace + 2 && [d1, d2].every((task) => forTask(afterRace, task, "task.due_soon").length === 1),
      `${x.created} + ${y.created}`
    );

    // ---------- 12. A person's time zone is read at the moment the job runs ----------
    await api("PUT", "/api/notifications/time-zone", { token: a.token, body: { timeZone: "Pacific/Pago_Pago" } });
    const z1 = await addTask({ title: "Zone one", assignee: a.id, dueDate: "2030-06-26" });
    const r11 = await run(NOW4);
    check(
      "In Pago Pago (UTC-11) it's still June 25th, so a June 26th task is 'tomorrow'",
      r11.created === 1 && forTask(await reminders(a), z1, "task.due_soon")[0]?.meta.days === 1,
      JSON.stringify(r11)
    );

    await api("PUT", "/api/notifications/time-zone", { token: a.token, body: { timeZone: "Asia/Kolkata" } });
    const z2 = await addTask({ title: "Zone two", assignee: a.id, dueDate: "2030-06-26" });
    const r12 = await run(NOW4);
    check(
      "Back in Kolkata it's June 26th, so the same date is 'today'",
      r12.created === 1 && forTask(await reminders(a), z2, "task.due_soon")[0]?.meta.days === 0 && forTask(await reminders(a), z1, "task.due_soon").length === 1,
      JSON.stringify(r12)
    );

    // ---------- 13. The usual notification rules still apply to reminders ----------
    const listing = await api("GET", `/api/notifications?${new URLSearchParams({ workspace: ws, limit: "100" })}`, { token: a.token });
    const first = (await reminders(a))[0];
    const read = await api("POST", `/api/notifications/${first.id}/read`, { token: a.token });
    check("A reminder can be marked as read", read.status === 200 && read.data.notification.read === true && listing.data.unreadCount > read.data.unreadCount);
    check("Someone else can't read it", (await api("POST", `/api/notifications/${first.id}/read`, { token: b.token })).status === 404);
    check("A reminder can be dismissed", (await api("DELETE", `/api/notifications/${first.id}`, { token: a.token })).status === 204 && (await reminders(a)).every((item) => item.id !== first.id));

    const resend = await run(NOW4);
    check("Dismissing a reminder doesn't bring it back: the record that it was sent is kept separately", resend.created === 0 && (await reminders(a)).every((item) => item.id !== first.id), JSON.stringify(resend));

    // ---------- 14. Deleting the workspace takes them with it ----------
    check("Before deleting, A has reminders for this workspace", (await reminders(a)).length > 0);
    await api("DELETE", base, { token: anshika.token });
    workspaceId = null;
    check("Deleting the workspace removes them", (await reminders(a)).length === 0 && (await reminders(b)).length === 0);
  } finally {
    if (workspaceId) await api("DELETE", `/api/workspaces/${workspaceId}`, { token: anshika.token });
    await mongoose.disconnect();
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});