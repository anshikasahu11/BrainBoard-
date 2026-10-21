"use client";

import TaskDialog from "@/components/tasks/TaskDialog";
import useAuth from "@/hooks/useAuth";
import useMembers from "@/hooks/useMembers";
import useWorkspace from "@/hooks/useWorkspace";

// Opens the task dialog on the dashboard, to create a task (no `task`) or to edit one.
// It's mounted only while open, so the people list loads on demand.
export default function TaskDialogHost({ task, onSaved, onDeleted, onGone, onClose }) {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const people = useMembers(workspace.id);

  return (
    <TaskDialog
      key={task?.id ?? "new"}
      task={task}
      defaultStatus="todo"
      workspaceId={workspace.id}
      members={people.members}
      role={role}
      userId={user.id}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onGone={onGone}
      onClose={onClose}
    />
  );
}