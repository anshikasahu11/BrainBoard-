import Activity from "../models/Activity.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";
import { CATEGORIES } from "../constants/activity.js";
import { toActivityDTO } from "../services/activityService.js";

const asText = (value) => (typeof value === "string" ? value : "");

// GET /api/workspaces/:workspaceId/activity
// Filters: ?category=documents|tasks|snippets|team  ?actor=me|<userId>  ?target=<id>
// Paging:  ?limit=30  ?before=<nextCursor from the previous page>
// Read-only: entries are written by the server, never by a request.
export async function listActivity(req, res) {
  const filter = { workspace: req.workspace._id };

  const category = asText(req.query.category);
  if (category) {
    if (!CATEGORIES.includes(category)) throw new AppError(400, "Invalid category filter");
    filter.category = category;
  }

  const actor = asText(req.query.actor);
  if (actor === "me") {
    filter.actor = req.user._id;
  } else if (actor) {
    if (!isObjectId(actor)) throw new AppError(400, "Invalid person filter");
    filter.actor = actor;
  }

  const target = asText(req.query.target);
  if (target) {
    if (!isObjectId(target)) throw new AppError(400, "Invalid target filter");
    filter["target.id"] = target;
  }

  // Ids grow over time, so "older than this id" is a stable page boundary even
  // while new entries keep arriving.
  const before = asText(req.query.before);
  if (before) {
    if (!isObjectId(before)) throw new AppError(400, "Invalid cursor");
    filter._id = { $lt: before };
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

  // One extra row tells us whether there's another page.
  const rows = await Activity.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    activities: page.map(toActivityDTO),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}