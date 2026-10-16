import { Router } from "express";
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  renameWorkspace,
  deleteWorkspace,
} from "../controllers/workspaceController.js";
import memberRoutes from "./memberRoutes.js";
import documentRoutes from "./documentRoutes.js";
import { protect } from "../middleware/auth.js";
import { loadWorkspace, requireRole } from "../middleware/workspaceAccess.js";
import { validate } from "../middleware/validate.js";
import { workspaceSchema } from "../validators/workspaceValidators.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Every workspace route needs a signed-in user.
router.use(protect);

router.route("/").get(listWorkspaces).post(validate(workspaceSchema), createWorkspace);

router
  .route("/:workspaceId")
  .all(loadWorkspace) // must be a member of THIS workspace for anything below
  .get(getWorkspace)
  .patch(requireRole(ROLES.OWNER, ROLES.ADMIN), validate(workspaceSchema), renameWorkspace)
  .delete(requireRole(ROLES.OWNER), deleteWorkspace);

// Members and documents of a workspace. loadWorkspace runs first, so only members get in.
router.use("/:workspaceId/members", loadWorkspace, memberRoutes);
router.use("/:workspaceId/documents", loadWorkspace, documentRoutes);

export default router;