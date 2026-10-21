import { Router } from "express";
import {
  listSnippets,
  listTags,
  createSnippet,
  getSnippet,
  updateSnippet,
  deleteSnippet,
} from "../controllers/snippetController.js";
import { validate } from "../middleware/validate.js";
import { createSnippetSchema, updateSnippetSchema } from "../validators/snippetValidators.js";

// mergeParams lets this router see :workspaceId from the parent route.
// By the time a request gets here, loadWorkspace has already confirmed the
// user is a member and attached req.workspace and req.membership.
const router = Router({ mergeParams: true });

router.route("/").get(listSnippets).post(validate(createSnippetSchema), createSnippet);

// "tags" must come BEFORE "/:snippetId", or it would be read as a snippet id.
router.get("/tags", listTags);

router
  .route("/:snippetId")
  .get(getSnippet)
  .patch(validate(updateSnippetSchema), updateSnippet)
  .delete(deleteSnippet);

export default router;