"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/auth/TextField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormAlert from "@/components/auth/FormAlert";
import { createWorkspaceRequest } from "@/services/workspaceService";

export default function CreateWorkspaceForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldError("");
    setFormError("");

    try {
      const { workspace } = await createWorkspaceRequest({ name });
      // Go straight into the new workspace. We leave "submitting" on so the
      // button doesn't flicker during the navigation.
      router.push(`/workspaces/${workspace.id}`);
    } catch (error) {
      if (error.errors?.name) setFieldError(error.errors.name);
      else setFormError(error.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />

      <TextField
        label="Workspace name"
        name="name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (fieldError) setFieldError("");
        }}
        error={fieldError}
        placeholder="e.g. Acme Dev"
        autoComplete="off"
        disabled={submitting}
      />

      <SubmitButton loading={submitting} loadingText="Creating…">
        Create workspace
      </SubmitButton>
    </form>
  );
}