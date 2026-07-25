"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { signInAction } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE, type AuthFormState } from "@/lib/auth/form-state";

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signInAction,
    EMPTY_AUTH_STATE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {redirectTo ? (
        <input type="hidden" name="redirect" value={redirectTo} />
      ) : null}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        pending={pending}
        pendingLabel="Signing in…"
      >
        Sign in
      </Button>
    </form>
  );
}
