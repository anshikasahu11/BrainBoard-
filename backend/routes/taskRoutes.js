import { Router } from "express";
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  moveTask,
  deleteTask,
} from "../controllers/taskController.js";
import { validate } from "../middleware/validate.js";
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from "../validators/taskValidators.js";

// mergeParams lets this router see :workspaceId from the parent route.
// By the time a request gets here, loadWorkspace has already confirmed the
// user is a member and attached req.workspace and req.membership.
const router = Router({ mergeParams: true });

router.route("/").get(listTasks).post(validate(createTaskSchema), createTask);

router.patch("/:taskId/move", validate(moveTaskSchema), moveTask);

router
  .route("/:taskId")
  .get(getTask)
  .patch(validate(updateTaskSchema), updateTask)
  .delete(deleteTask);

export default router;