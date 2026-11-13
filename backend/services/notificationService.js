import Membership from "../models/Membership.js";
import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import SentReminder from "../models/SentReminder.js";
import { KINDS } from "../constants/notifications.js";
import { emitToUser } from "../socket/realtime.js";
import { cleanNotificationMeta, decide, throttleCutoff } from "../utils/notificationRules.js";

const clip = (value, max) => String(value ?? "").slice(0, max);

export const countUnread = (userId) => Notification.countDocuments({ user: userId, readAt: null });

// The kinds this person has switched off.
export async function mutedKinds(userId) {
  const prefs = await NotificationPreference.findOne({ user: userId }).select("muted");
  return prefs?.muted ?? [];
}

// The shape the frontend receives. Structured data, never a sentence: the screen decides the wording.
// actor is null for a reminder, since nobody did it.
export function toNotificationDTO(notification) {
  return {
    id: notification.id,
    kind: notification.kind,
    read: Boolean(notification.readAt),
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
    actor: notification.actor ? { id: notification.actor.toString(), name: notification.actorName } : null,
    workspace: { id: notification.workspace.toString(), name: notification.workspaceName },
    target: {
      type: notification.target.kind,
      id: notification.target.id.toString(),
      name: notification.target.name,
    },
    meta: notification.meta ?? {},
  };
}

// Tells one person that something needs their attention.
//   recipientId: who it's for.
//   actor:       the signed-in user who caused it (req.user), or null for a reminder.
//   workspace:   where it happened. It needs _id and name (req.workspace works).
//   kind:        one of the kinds in constants/notifications.
//   target:      { type: "task" | "workspace", id, name }.   meta: a few small facts.
//   dedupeKey:   optional. A once-only key: if this person was already sent one with the same key,
//                nothing is sent. The record of it lives in its own collection (SentReminder), so
//                dismissing the notification never makes it come back.
//
// Call it AFTER the change succeeded. It never throws: the change is already done, and a
// notification is a courtesy, not a gate. Returns the notification, or null if nothing was sent.
export async function notify({ recipientId, actor = null, workspace, kind, target, meta = {}, dedupeKey = null }) {
  try {
    const spec = KINDS[kind];
    if (!spec || !recipientId) return null;

    // Is it for someone other than the person who did it, and have they left this kind on?
    const verdict = decide({
      kind,
      recipientId: String(recipientId),
      actorId: actor ? String(actor._id) : undefined,
      muted: await mutedKinds(recipientId),
    });
    if (!verdict.send) return null;

    // The person must still be in the workspace (except for "you were removed").
    if (spec.recipientMustBeMember) {
      const member = await Membership.exists({ workspace: workspace._id, user: recipientId });
      if (!member) return null;
    }

    // The same thing again, too soon: collapse it.
    const cutoff = throttleCutoff(kind);
    if (cutoff) {
      const recent = await Notification.exists({
        user: recipientId,
        kind,
        "target.id": target.id,
        createdAt: { $gte: cutoff },
      });
      if (recent) return null;
    }

    // A once-only key is claimed AFTER the checks above (so a muted reminder isn't used up) and
    // BEFORE anything is created. If the database says someone already claimed it, it was sent.
    const claim = dedupeKey ? { user: recipientId, key: clip(dedupeKey, 120) } : null;
    if (claim) {
      try {
        await SentReminder.create(claim);
      } catch (error) {
        if (error?.code === 11000) return null;
        throw error;
      }
    }

    let notification;
    try {
      notification = await Notification.create({
        user: recipientId,
        workspace: workspace._id,
        workspaceName: clip(workspace.name, 50),
        actor: actor ? actor._id : null,
        actorName: actor ? clip(actor.name, 50) : "",
        kind,
        target: { kind: target.type, id: target.id, name: clip(target.name, 140) },
        meta: cleanNotificationMeta(meta),
      });
    } catch (error) {
      // It wasn't delivered, so give the claim back and a later run can try again.
      if (claim) await SentReminder.deleteOne(claim).catch(() => {});
      throw error;
    }

    // Only that person's tabs hear it, with the new unread count for the badge.
    emitToUser(recipientId, "notification:created", {
      notification: toNotificationDTO(notification),
      unreadCount: await countUnread(recipientId),
    });

    return notification;
  } catch (error) {
    console.error("Creating a notification failed:", error.message);
    return null;
  }
}