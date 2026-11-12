import { Router } from "express";
import { searchWorkspace } from "../controllers/searchController.js";
import { searchLimiter } from "../middleware/rateLimiter.js";

// mergeParams lets this router see :workspaceId from the parent route. By the time a
// request gets here, loadWorkspace has confirmed the user is a member.
const router = Router({ mergeParams: true });

// Search can only be read. There is nothing to create, change or delete.
router.get("/", searchLimiter, searchWorkspace);

export default router;