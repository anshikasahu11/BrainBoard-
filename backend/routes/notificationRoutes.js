import { Router } from "express";
import {
  deleteNotification,
  getPreferences,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  setPreference,
  setTimeZone,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { preferenceSchema, timeZoneSchema } from "../validators/notificationValidators.js";

// Notifications belong to a person, not a workspace: one bell for every workspace you're in.
// Every query is scoped to the signed-in person.
const router = Router();

router.use(protect);

router.get("/", listNotifications);

// Fixed paths come BEFORE "/:id", or they would be read as an id.
router.get("/unread-count", getUnreadCount);
router.post("/read-all", markAllRead);
router.get("/preferences", getPreferences);
router.put("/preferences/:kind", validate(preferenceSchema), setPreference);
router.put("/time-zone", validate(timeZoneSchema), setTimeZone);

router.post("/:id/read", markRead);
router.delete("/:id", deleteNotification);

export default router;