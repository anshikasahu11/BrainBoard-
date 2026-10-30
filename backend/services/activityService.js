import Activity from "../models/Activity.js";
import { categoryOf } from "../constants/activity.js";
import { emitToWorkspace } from "../socket/realtime.js";

const clip = (value, max = 140) => String(value ?? "").slice(0, max);

// Only small, plain facts are kept: text, numbers, true/false.
function cleanMeta(meta) {
  const clean = {};
  for (const [key, value] of Object.entries(meta ?? {}).slice(0, 10)) {
    if (typeof value === "string") clean[key] = clip(value);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) clean[key] = value;
  }
  return clean;
}

// The shape the frontend receives. Structured data, not a sentence: the screen
// decides the wording. It never contains document text, code or task descriptions.
export function toActivityDTO(activity) {
  return {
    id: activity.id,
    action: activity.action,
    category: activity.category,
    actor: { id: activity.actor.toString(), name: activity.actorName },
    target: {
      type: activity.target.kind,
      id: activity.target.id.toString(),
      name: activity.target.name,
    },
    meta: activity.meta ?? {},
    createdAt: activity.createdAt,
  };
}

// Writes one line of history, then tells everyone in the workspace.
//   req:        the request. The person making it is the actor.
//   workspaceId: only needed when the route has no loaded workspace (creating one).
//   target:     { type, id, name }
//   meta:       a few small facts
//   throttleMs: skip it if this person already caused the same action on the same thing this recently
//
// Call it AFTER the change succeeded. It never throws: the change is already done,
// and history is a safety net, not a gate. Returns the entry, or null if nothing was written.
export async function recordActivity(req, { workspaceId, action, target, meta = {}, throttleMs = 0 }) {
  try {
    const workspace = workspaceId ?? req.workspace?._id;
    const actor = req.user;
    if (!workspace || !actor) return null;

    if (throttleMs > 0) {
      const recent = await Activity.exists({
        workspace,
        actor: actor._id,
        action,
        "target.id": target.id,
        createdAt: { $gte: new Date(Date.now() - throttleMs) },
      });
      if (recent) return null;
    }

    const activity = await Activity.create({
      workspace,
      actor: actor._id,
      actorName: clip(actor.name, 50),
      action,
      category: categoryOf(action),
      target: { kind: target.type, id: target.id, name: clip(target.name) },
      meta: cleanMeta(meta),
    });

    // Everyone hears it, the person who caused it included: nothing on their screen adds it for them.
    emitToWorkspace(String(workspace), "activity:created", {
      workspaceId: String(workspace),
      activity: toActivityDTO(activity),
    });

    return activity;
  } catch (error) {
    console.error("Recording activity failed:", error.message);
    return null;
  }
}