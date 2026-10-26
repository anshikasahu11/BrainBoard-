import { Router } from "express";
import {
  listDocuments,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
} from "../controllers/documentController.js";
import versionRoutes from "./versionRoutes.js";
import { validate } from "../middleware/validate.js";
import { createDocumentSchema, updateDocumentSchema } from "../validators/documentValidators.js";

// mergeParams lets this router see :workspaceId from the parent route.
// By the time a request gets here, loadWorkspace has already confirmed the
// user is a member and attached req.workspace and req.membership.
const router = Router({ mergeParams: true });

router.route("/").get(listDocuments).post(validate(createDocumentSchema), createDocument);

// A document's version history lives under it.
router.use("/:documentId/versions", versionRoutes);

router
  .route("/:documentId")
  .get(getDocument)
  .patch(validate(updateDocumentSchema), updateDocument)
  .delete(deleteDocument);

export default router;