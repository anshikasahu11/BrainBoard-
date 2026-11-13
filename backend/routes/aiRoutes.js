import { Router } from "express";
import {
  aiStatus,
  explainSnippet,
  improveSnippet,
  summarizeDocument,
  tasksFromText,
} from "../controllers/aiController.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import {
  explainSnippetSchema,
  improveSnippetSchema,
  summarizeDocumentSchema,
  tasksFromTextSchema,
} from "../validators/aiValidators.js";

// mergeParams lets this router see :workspaceId from the parent route. By the time a
// request gets here, loadWorkspace has confirmed the user is a member.
const router = Router({ mergeParams: true });

router.get("/status", aiStatus);

// Every action below only SUGGESTS. None of them creates, changes or deletes anything.
router.post("/summarize-document", aiLimiter, validate(summarizeDocumentSchema), summarizeDocument);
router.post("/explain-snippet", aiLimiter, validate(explainSnippetSchema), explainSnippet);
router.post("/improve-snippet", aiLimiter, validate(improveSnippetSchema), improveSnippet);
router.post("/tasks-from-text", aiLimiter, validate(tasksFromTextSchema), tasksFromText);

export default router;