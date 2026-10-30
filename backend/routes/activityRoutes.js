import { Router } from "express";
import { listActivity } from "../controllers/activityController.js";

// mergeParams lets this router see :workspaceId from the parent route. By the time a
// request gets here, loadWorkspace has confirmed the user is a member.
const router = Router({ mergeParams: true });

// The feed can be read, and nothing else: there is deliberately no way to write to it.
router.get("/", listActivity);

export default router;