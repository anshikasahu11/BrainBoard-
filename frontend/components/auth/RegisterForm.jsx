"use client";

import { useState } from "react";
import useAuth from "@/hooks/useAuth";
import TextField from "@/components/auth/TextField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormAlert from "@/components/auth/FormAlert";

export default function RegisterForm() {
  const { register } = useAuth();

  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrors({});
    setFormError("");

    try {
      await register(values);
      // Success: GuestRoute redirects to the dashboard.
    } catch (error) {
      if (error.errors) {
        setErrors(error.errors);
      } else if (error.status === 409) {
        // "An account with this email already exists" belongs on the email field.
        setErrors({ email: error.message });
      } else {
        setFormError(error.message);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />

      <TextField
        label="Name"
        name="name"
        value={values.name}
        onChange={handleChange}
        error={errors.name}
        autoComplete="name"
        autoFocus
        disabled={submitting}
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange}
        error={errors.email}
        autoComplete="email"
        disabled={submitting}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        value={values.password}
        onChange={handleChange}
        error={errors.password}
        hint="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        disabled={submitting}
      />

      <SubmitButton loading={submitting} loadingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}