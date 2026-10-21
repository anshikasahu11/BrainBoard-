"use client";

import { useId, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextField from "@/components/auth/TextField";
import FormAlert from "@/components/auth/FormAlert";
import { PRIORITIES, STATUSES } from "@/lib/tasks";
import { canDeleteTask } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import {
  createTaskRequest,
  deleteTaskRequest,
  updateTaskRequest,
} from "@/services/taskService";

// task: the task being edited, or undefined to create a new one.
// defaultStatus: which column a NEW task starts in.
export default function TaskDialog({
  task,
  defaultStatus,
  workspaceId,
  members,
  role,
  userId,
  onSaved,
  onDeleted,
  onGone,
  onClose,
}) {
  const editing = Boolean(task);
  const baseId = useId();
  const id = (name) => `${baseId}-${name}`;

  // What the form started with. Used to work out what the user actually changed.
  const [initial] = useState(() => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus ?? "todo",
    priority: task?.priority ?? "medium",
    assignee: task?.assignee?.id ?? "",
    dueDate: task?.dueDate ?? "",
  }));

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const mayDelete = editing && canDeleteTask(role, task, userId);

  function change(name) {
    return (event) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [name]: value }));
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
    };
  }

  // The people you can assign. If the current assignee isn't in the list, keep them.
  const options = members.map((member) => ({ id: member.id, name: member.name }));
  if (initial.assignee && !options.some((option) => option.id === initial.assignee)) {
    options.unshift({ id: initial.assignee, name: task.assignee.name });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const title = values.title.trim();
    let request;

    if (editing) {
      // Send ONLY what changed, so a teammate's edit to another field survives.
      const changes = {};
      if (title !== initial.title) changes.title = title;
      if (values.description !== initial.description) changes.description = values.description;
      if (values.status !== initial.status) changes.status = values.status;
      if (values.priority !== initial.priority) changes.priority = values.priority;
      if (values.assignee !== initial.assignee) changes.assignee = values.assignee || null;
      if (values.dueDate !== initial.dueDate) changes.dueDate = values.dueDate || null;

      if (Object.keys(changes).length === 0) {
        onClose(); // nothing changed, nothing to save
        return;
      }
      request = () => updateTaskRequest(workspaceId, task.id, changes);
    } else {
      request = () =>
        createTaskRequest(workspaceId, {
          title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          assignee: values.assignee || null,
          dueDate: values.dueDate || null,
        });
    }

    setBusy(true);
    setErrors({});
    setFormError("");

    try {
      const { task: saved } = await request();
      onSaved(saved, editing ? "updated" : "created");
    } catch (error) {
      if (editing && error.status === 404) {
        onGone(); // someone else deleted it while you were editing
        return;
      }
      if (error.errors) setErrors(error.errors);
      else setFormError(error.message);
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setFormError("");

    try {
      await deleteTaskRequest(workspaceId, task.id);
      onDeleted(task);
    } catch (error) {
      if (error.status === 404) {
        onGone();
        return;
      }
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit task" : "New task"} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormAlert message={formError} />

        <TextField
          label="Title"
          name="title"
          value={values.title}
          onChange={change("title")}
          error={errors.title}
          autoComplete="off"
          disabled={busy}
        />

        <div>
          <label htmlFor={id("description")} className="mb-1.5 block text-[13px] text-fg-2">
            Description
          </label>
          <textarea
            id={id("description")}
            value={values.description}
            onChange={change("description")}
            rows={4}
            maxLength={5000}
            disabled={busy}
            aria-invalid={errors.description ? "true" : undefined}
            aria-describedby={errors.description ? id("description-error") : undefined}
            className="input textarea"
          />
          {errors.description && (
            <p id={id("description-error")} className="mt-1.5 text-[12px] text-danger">
              {errors.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("status")} className="mb-1.5 block text-[13px] text-fg-2">
              Status
            </label>
            <select
              id={id("status")}
              value={values.status}
              onChange={change("status")}
              disabled={busy}
              className="input"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id("priority")} className="mb-1.5 block text-[13px] text-fg-2">
              Priority
            </label>
            <select
              id={id("priority")}
              value={values.priority}
              onChange={change("priority")}
              disabled={busy}
              className="input"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {editing && values.status !== initial.status && (
          <p className="-mt-2 text-[12px] text-fg-muted">
            Changing the status moves the task to the bottom of that column.
          </p>
        )}

        <div>
          <label htmlFor={id("assignee")} className="mb-1.5 block text-[13px] text-fg-2">
            Assignee
          </label>
          <select
            id={id("assignee")}
            value={values.assignee}
            onChange={change("assignee")}
            disabled={busy}
            aria-invalid={errors.assignee ? "true" : undefined}
            aria-describedby={errors.assignee ? id("assignee-error") : undefined}
            className="input"
          >
            <option value="">Unassigned</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {errors.assignee && (
            <p id={id("assignee-error")} className="mt-1.5 text-[12px] text-danger">
              {errors.assignee}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={id("due")} className="mb-1.5 block text-[13px] text-fg-2">
            Due date
          </label>
          <div className="flex items-center gap-3">
            <input
              id={id("due")}
              type="date"
              value={values.dueDate}
              onChange={change("dueDate")}
              disabled={busy}
              aria-invalid={errors.dueDate ? "true" : undefined}
              aria-describedby={errors.dueDate ? id("due-error") : undefined}
              className="input flex-1"
            />
            {values.dueDate && (
              <button
                type="button"
                onClick={() => setValues((current) => ({ ...current, dueDate: "" }))}
                disabled={busy}
                className="shrink-0 text-[13px] text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
              >
                Clear
              </button>
            )}
          </div>
          {errors.dueDate && (
            <p id={id("due-error")} className="mt-1.5 text-[12px] text-danger">
              {errors.dueDate}
            </p>
          )}
        </div>

        {editing && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            Created by {task.createdBy.name} · {formatDate(task.createdAt)}
          </p>
        )}

        {confirmingDelete ? (
          <div className="rounded-card border border-danger/40 bg-scorched/60 p-4">
            <p className="text-[14px]">Delete this task for everyone?</p>
            <p className="mt-1 text-[13px] text-fg-2">This can&apos;t be undone.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="btn-danger inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm"
              >
                {busy && (
                  <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                )}
                {busy ? "Deleting…" : "Delete task"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              {mayDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-control px-3 py-2 text-[13px] text-fg-2 transition-colors hover:bg-white/10 hover:text-danger"
                >
                  <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                  Delete
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary inline-flex items-center gap-2 rounded-control px-5 py-2 text-sm"
              >
                {busy && (
                  <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                )}
                {busy ? "Saving…" : editing ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}