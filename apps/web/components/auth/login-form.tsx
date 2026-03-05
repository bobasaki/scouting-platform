"use client";

import { useActionState } from "react";
import {
  LOGIN_INITIAL_STATE,
  signInWithCredentials,
  type LoginActionState
} from "../../app/login/actions";
import { resolveLoginUiState } from "../../lib/auth-flow";

const EMPTY_FORM_STATE: LoginActionState = LOGIN_INITIAL_STATE;

export function LoginForm() {
  const [actionState, formAction, isSubmitting] = useActionState(
    signInWithCredentials,
    EMPTY_FORM_STATE
  );
  const uiState = resolveLoginUiState(isSubmitting, actionState);

  return (
    <form action={formAction} className="login-form" noValidate>
      <label className="login-form__field">
        <span>Email</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label className="login-form__field">
        <span>Password</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <p
        aria-live="polite"
        className={`login-form__status login-form__status--${uiState.status}`}
        role={uiState.status === "error" ? "alert" : undefined}
      >
        {uiState.message}
      </p>
      <button className="login-form__submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
