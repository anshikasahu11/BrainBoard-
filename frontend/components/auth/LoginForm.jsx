"use client";

import { useState } from "react";
import useAuth from "@/hooks/useAuth";
import TextField from "@/components/auth/TextField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormAlert from "@/components/auth/FormAlert";

export default function LoginForm() {
  const { login } = useAuth();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({}); // per-field messages from the backend
  const [formError, setFormError] = useState(""); // wrong password, server down...
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    // Clear a field's error as soon as the user starts fixing it.
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrors({});
    setFormError("");

    try {
      await login(values);
      // Success: GuestRoute notices we're signed in and redirects.
      // We deliberately leave "submitting" on so the button doesn't flicker.
    } catch (error) {
      if (error.errors) setErrors(error.errors);
      else setFormError(error.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />

      <TextField
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange}
        error={errors.email}
        autoComplete="email"
        autoFocus
        disabled={submitting}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        value={values.password}
        onChange={handleChange}
        error={errors.password}
        autoComplete="current-password"
        disabled={submitting}
      />

      <SubmitButton loading={submitting} loadingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}