import NotificationPreference from "../models/NotificationPreference.js";
import SentReminder from "../models/SentReminder.js";
import Task from "../models/Task.js";
import Workspace from "../models/Workspace.js";
import { notify } from "./notificationService.js";
import { candidateWindow, planReminders } from "../utils/reminderRules.js";

// The most reminders one run will send. Anything left waits for the next run.
export const MAX_PER_RUN = 500;
// The most tasks one run will look at.
const MAX_CANDIDATES = 10000;

// Sends the due-date reminders that are due right now. Safe to run as often as you like: each
// reminder has a once-only key, so running twice never sends anything twice.
//   now:         the moment to treat as "now" (tests pick one; the scheduler never passes it).
//   limit:       the most to send in this run.
//   workspaceId: only look at this workspace (tests use it; the scheduler never passes it).
// Never throws. Returns { ok, considered, planned, alreadySent, created, deferred }.
export async function runReminders({ now = new Date(), limit = MAX_PER_RUN, workspaceId = null } = {}) {
  try {
    const { from, to } = candidateWindow(now);

    // Only tasks that could possibly need a reminder: assigned, not done, due in a narrow range.
    const filter = { status: { $ne: "done" }, assignee: { $ne: null }, dueDate: { $gte: from, $lte: to } };
    if (workspaceId) filter.workspace = workspaceId;

    const rows = await Task.find(filter)
      .sort({ dueDate: 1 })
      .limit(MAX_CANDIDATES)
      .select("workspace title priority assignee status dueDate")
      .lean();

    const tasks = rows.map((row) => ({
      id: String(row._id),
      workspace: String(row.workspace),
      title: row.title,
      priority: row.priority,
      assignee: String(row.assignee),
      status: row.status,
      dueDate: row.dueDate,
    }));

    // Each assignee's time zone and muted kinds, in one query.
    const userIds = [...new Set(tasks.map((task) => task.assignee))];
    const prefs = userIds.length
      ? await NotificationPreference.find({ user: { $in: userIds } }).select("user muted timeZone").lean()
      : [];
    const people = new Map(prefs.map((pref) => [String(pref.user), { timeZone: pref.timeZone, muted: pref.muted ?? [] }]));

    const plan = planReminders({ tasks, people, now });

    // Which of them were already sent? The record is kept apart from the notifications, so
    // dismissing or deleting a notification never makes its reminder come back.
    const sentRows = plan.length
      ? await SentReminder.find({ user: { $in: userIds }, key: { $in: plan.map((item) => item.key) } })
          .select("user key")
          .lean()
      : [];
    const sent = new Set(sentRows.map((row) => `${row.user}|${row.key}`));
    const pending = plan.filter((item) => !sent.has(`${item.userId}|${item.key}`));

    const batch = pending.slice(0, Math.max(0, limit));

    const workspaceIds = [...new Set(batch.map((item) => item.workspaceId))];
    const workspaces = new Map(
      (workspaceIds.length ? await Workspace.find({ _id: { $in: workspaceIds } }).select("name").lean() : []).map((w) => [
        String(w._id),
        w,
      ])
    );

    let created = 0;
    for (const item of batch) {
      const workspace = workspaces.get(item.workspaceId);
      if (!workspace) continue;

      // notify checks the person's settings and membership again, and the once-only key is the
      // final guard if two runs happen at the same moment.
      const made = await notify({
        recipientId: item.userId,
        actor: null,
        workspace,
        kind: item.kind,
        target: { type: "task", id: item.taskId, name: item.title },
        meta: item.meta,
        dedupeKey: item.key,
      });
      if (made) created += 1;
    }

    return {
      ok: true,
      considered: tasks.length,
      planned: plan.length,
      alreadySent: plan.length - pending.length,
      created,
      deferred: pending.length - batch.length,
    };
  } catch (error) {
    console.error("Reminder run failed:", error.message);
    return { ok: false, error: error.message, considered: 0, planned: 0, alreadySent: 0, created: 0, deferred: 0 };
  }
}