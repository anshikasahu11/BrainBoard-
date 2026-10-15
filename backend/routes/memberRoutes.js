import { Router } from "express";
import {
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "../controllers/memberController.js";
import { requireRole } from "../middleware/workspaceAccess.js";
import { validate } from "../middleware/validate.js";
import { inviteLimiter } from "../middleware/rateLimiter.js";
import { addMemberSchema, updateRoleSchema } from "../validators/workspaceValidators.js";
import { ROLES } from "../constants/roles.js";

// mergeParams lets this router see :workspaceId from the parent route.
// By the time a request gets here, loadWorkspace has already confirmed
// the user is a member and attached req.workspace and req.membership.
const router = Router({ mergeParams: true });

router.get("/", listMembers);

router.post(
  "/",
  inviteLimiter,
  requireRole(ROLES.OWNER, ROLES.ADMIN),
  validate(addMemberSchema),
  addMember
);

router.patch("/:userId", requireRole(ROLES.OWNER), validate(updateRoleSchema), updateMemberRole);

// No requireRole here: anyone may remove THEMSELVES (leave). The controller
// applies the stricter rules when the target is somebody else.
router.delete("/:userId", removeMember);

export default router;