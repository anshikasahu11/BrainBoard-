import Document from "../models/Document.js";
import AppError from "../utils/AppError.js";
import { isObjectId } from "../utils/objectId.js";

// Runs on routes that have :documentId in their path, AFTER loadWorkspace.
// Confirms the document exists IN THIS workspace, then attaches a light copy
// (no content) as req.document. A document from another workspace gets the same
// 404 as one that doesn't exist.
export async function loadDocument(req, res, next) {
  const { documentId } = req.params;
  if (!isObjectId(documentId)) throw new AppError(404, "Document not found");

  const doc = await Document.findOne({
    _id: documentId,
    workspace: req.workspace._id,
  }).select("workspace title revision updatedAt lastEditedBy");

  if (!doc) throw new AppError(404, "Document not found");

  req.document = doc;
  next();
}