import { Router } from "express";
import {
  listVersions,
  createVersion,
  getVersion,
  restoreVersion,
  deleteVersion,
} from "../controllers/versionController.js";
import { loadDocument } from "../middleware/documentAccess.js";
import { versionLimiter } from "../middleware/rateLimiter.js";
import { requireRole } from "../middleware/workspaceAccess.js";
import { validate } from "../middleware/validate.js";
import { createVersionSchema, restoreVersionSchema } from "../validators/versionValidators.js";
import { ROLES } from "../constants/roles.js";

// mergeParams lets this router see :documentId from the parent route. By the time a
// request gets here, loadWorkspace has confirmed the user is a member.
const router = Router({ mergeParams: true });

// Every route below needs a real document IN this workspace.
router.use(loadDocument);

router.route("/").get(listVersions).post(versionLimiter, validate(createVersionSchema), createVersion);

router.post("/:number/restore", validate(restoreVersionSchema), restoreVersion);

router
  .route("/:number")
  .get(getVersion)
  // Removing a single version is an admin power.
  .delete(requireRole(ROLES.OWNER, ROLES.ADMIN), deleteVersion);

export default router;