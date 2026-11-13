import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { isKnownKind, pageSize, preferenceList } from "../utils/notificationRules.js";
import { emitToUser, socketIdFrom } from "../socket/realtime.js";
import { countUnread, mutedKinds, toNotificationDTO } from "../services/notificationService.js";

const asText = (value) => (typeof value === "string" ? value : "");
const notFound = () => new AppError(404, "Notification not found");

// Every lookup includes the signed-in person, so someone else's notification gets the same
// 404 as one that doesn't exist.
function mine(req, id) {
  if (!isObjectId(id)) throw notFound();
  return { _id: id, user: req.user._id };
}

// Tells this person's OTHER tabs that the count changed (not the tab that did it: it already
// knows). Returns the new unread count.
async function tellOtherTabs(req) {
  const unreadCount = await countUnread(req.user._id);
  emitToUser(req.user.id, "notification:changed", { unreadCount }, { exceptSocketId: socketIdFrom(req) });
  return unreadCount;
}

// GET /api/notifications
// Filters: ?unread=true  ?workspace=<id>   Paging: ?limit=20  ?before=<nextCursor>
export async function listNotifications(req, res) {
  const filter = { user: req.user._id };

  if (asText(req.query.unread) === "true") filter.readAt = null;

  const workspace = asText(req.query.workspace);
  if (workspace) {
    if (!isObjectId(workspace)) throw new AppError(400, "Invalid workspace filter");
    filter.workspace = workspace;
  }

  // Ids grow over time, so "older than this id" is a stable page boundary.
  const before = asText(req.query.before);
  if (before) {
    if (!isObjectId(before)) throw new AppError(400, "Invalid cursor");
    filter._id = { $lt: before };
  }

  const limit = pageSize(req.query.limit);

  // One extra row tells us whether there's another page.
  const rows = await Notification.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    notifications: page.map(toNotificationDTO),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount: await countUnread(req.user._id),
  });
}

// GET /api/notifications/unread-count
export async function getUnreadCount(req, res) {
  res.json({ unreadCount: await countUnread(req.user._id) });
}

// POST /api/notifications/:id/read  (safe to repeat)
export async function markRead(req, res) {
  const filter = mine(req, req.params.id);

  const updated = await Notification.findOneAndUpdate(
    { ...filter, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  );

  if (!updated) {
    // Already read (fine), or not yours, or doesn't exist (404).
    const existing = await Notification.findOne(filter);
    if (!existing) throw notFound();

    res.json({ notification: toNotificationDTO(existing), unreadCount: await countUnread(req.user._id) });
    return;
  }

  res.json({ notification: toNotificationDTO(updated), unreadCount: await tellOtherTabs(req) });
}

// POST /api/notifications/read-all
export async function markAllRead(req, res) {
  const result = await Notification.updateMany(
    { user: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  const unreadCount = result.modifiedCount > 0 ? await tellOtherTabs(req) : await countUnread(req.user._id);
  res.json({ updated: result.modifiedCount, unreadCount });
}

// DELETE /api/notifications/:id  (dismisses it for this person only)
export async function deleteNotification(req, res) {
  const result = await Notification.deleteOne(mine(req, req.params.id));
  if (result.deletedCount === 0) throw notFound();

  await tellOtherTabs(req);
  res.status(204).end();
}

// GET /api/notifications/preferences
export async function getPreferences(req, res) {
  res.json({ preferences: preferenceList(await mutedKinds(req.user._id)) });
}

// PUT /api/notifications/preferences/:kind   { enabled: true | false }
export async function setPreference(req, res) {
  const { kind } = req.params;
  if (!isKnownKind(kind)) throw new AppError(400, "Unknown notification type");

  // $addToSet and $pull never add a kind twice or fail when it isn't there. The upsert makes
  // the person's document on first use, and defaults are off so they don't clash with the update.
  const prefs = await NotificationPreference.findOneAndUpdate(
    { user: req.user._id },
    req.body.enabled ? { $pull: { muted: kind } } : { $addToSet: { muted: kind } },
    { upsert: true, new: true, setDefaultsOnInsert: false }
  );

  res.json({ preferences: preferenceList(prefs.muted ?? []) });
}