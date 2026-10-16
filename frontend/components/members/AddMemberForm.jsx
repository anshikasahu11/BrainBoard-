"use client";

import { useId, useState } from "react";
import TextField from "@/components/auth/TextField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormAlert from "@/components/auth/FormAlert";
import { addMemberRequest } from "@/services/memberService";
import { ROLE_LABELS } from "@/lib/permissions";

// roles: which roles YOU may give (owner: member or admin, admin: member only).
export default function AddMemberForm({ workspaceId, roles, onAdded }) {
  const selectId = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]);
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setEmailError("");
    setFormError("");

    try {
      const { member } = await addMemberRequest(workspaceId, { email, role });
      onAdded(member);
      setEmail("");
    } catch (error) {
      if (error.errors?.email) {
        setEmailError(error.errors.email);
      } else if (error.status === 404 || error.status === 409) {
        // "No account uses that email" and "already a member" are about the email.
        setEmailError(error.message);
      } else {
        setFormError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />

      <TextField
        label="Email address"
        name="email"
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError("");
        }}
        error={emailError}
        hint="They need a BrainBoard account first."
        placeholder="teammate@company.com"
        autoComplete="off"
        disabled={submitting}
      />

      {roles.length > 1 && (
        <div>
          <label htmlFor={selectId} className="mb-1.5 block text-[13px] text-fg-2">
            Role
          </label>
          <select
            id={selectId}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={submitting}
            className="input input-sm"
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}

      <SubmitButton loading={submitting} loadingText="Adding…">
        Add member
      </SubmitButton>
    </form>
  );
}