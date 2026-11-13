import { Router } from "express";
import { aiStatus, summarizeDocument } from "../controllers/aiController.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { summarizeDocumentSchema } from "../validators/aiValidators.js";

// mergeParams lets this router see :workspaceId from the parent route. By the time a
// request gets here, loadWorkspace has confirmed the user is a member.
const router = Router({ mergeParams: true });

router.get("/status", aiStatus);
router.post("/summarize-document", aiLimiter, validate(summarizeDocumentSchema), summarizeDocument);

export default router;