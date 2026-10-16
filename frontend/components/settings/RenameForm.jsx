"use client";

import { useState } from "react";
import TextField from "@/components/auth/TextField";
import FormAlert from "@/components/auth/FormAlert";
import useWorkspace from "@/hooks/useWorkspace";
import { renameWorkspaceRequest } from "@/services/workspaceService";
import { canRename } from "@/lib/permissions";

export default function RenameForm() {
  const { workspace, role, patchWorkspace } = useWorkspace();

  const [name, setName] = useState(workspace.name);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Members can see the name but not change it.
  if (!canRename(role)) {
    return (
      <div>
        <p className="mb-1.5 text-[13px] text-fg-2">Workspace name</p>
        <p className="text-[15px]">{workspace.name}</p>
        <p className="mt-2 text-[12px] text-fg-muted">
          Only the owner and admins can rename the workspace.
        </p>
      </div>
    );
  }

  const unchanged = name.trim() === workspace.name;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || unchanged) return;

    setSubmitting(true);
    setFieldError("");
    setFormError("");
    setSaved(false);

    try {
      const { workspace: updated } = await renameWorkspaceRequest(workspace.id, { name });
      // The sidebar and the switcher update immediately, with no refetch.
      patchWorkspace({ name: updated.name, updatedAt: updated.updatedAt });
      setName(updated.name);
      setSaved(true);
    } catch (error) {
      if (error.errors?.name) setFieldError(error.errors.name);
      else setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />

      <TextField
        label="Workspace name"
        name="name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
          if (fieldError) setFieldError("");
        }}
        error={fieldError}
        autoComplete="off"
        disabled={submitting}
      />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={unchanged || submitting}
          className="btn-primary inline-flex h-10 items-center rounded-control px-5 text-sm"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <p role="status" aria-live="polite" className="text-[13px] text-success">
          {saved ? "Saved" : ""}
        </p>
      </div>
    </form>
  );
}