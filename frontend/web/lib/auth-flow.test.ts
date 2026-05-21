import { describe, expect, it } from "vitest";
import {
  getAuthErrorMessage,
  LOGIN_CREDENTIALS_ERROR_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  LOGIN_IDLE_MESSAGE,
  LOGIN_INITIAL_STATE,
  LOGIN_SUBMITTING_MESSAGE,
  resolveLoginUiState,
} from "./auth-flow";

describe("auth flow scaffold helpers", () => {
  it("resolves idle, submitting, and error login UI states", () => {
    expect(resolveLoginUiState(false, LOGIN_INITIAL_STATE)).toEqual({
      status: "idle",
      message: LOGIN_IDLE_MESSAGE
    });

    expect(resolveLoginUiState(true, LOGIN_INITIAL_STATE)).toEqual({
      status: "submitting",
      message: LOGIN_SUBMITTING_MESSAGE
    });

    expect(
      resolveLoginUiState(false, {
        status: "error",
        message: LOGIN_CREDENTIALS_ERROR_MESSAGE
      })
    ).toEqual({
      status: "error",
      message: LOGIN_CREDENTIALS_ERROR_MESSAGE
    });
  });

  it("maps Auth.js error types to UI-safe text", () => {
    expect(getAuthErrorMessage("CredentialsSignin")).toBe(LOGIN_CREDENTIALS_ERROR_MESSAGE);
    expect(getAuthErrorMessage("CallbackRouteError")).toBe(LOGIN_GENERIC_ERROR_MESSAGE);
  });
});
