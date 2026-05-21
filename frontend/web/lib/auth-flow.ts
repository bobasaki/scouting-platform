export const LOGIN_IDLE_MESSAGE = "Use your assigned work email and password.";
export const LOGIN_SUBMITTING_MESSAGE = "Submitting credentials...";
export const LOGIN_CREDENTIALS_ERROR_MESSAGE = "Invalid email or password.";
export const LOGIN_GENERIC_ERROR_MESSAGE = "Unable to sign in right now. Please try again.";

export type LoginActionState = Readonly<{
  status: "idle" | "error";
  message: string | null;
}>;

export type LoginUiState = Readonly<{
  status: "idle" | "submitting" | "error";
  message: string;
}>;

export const LOGIN_INITIAL_STATE: LoginActionState = {
  status: "idle",
  message: null
};

export function resolveLoginUiState(
  isSubmitting: boolean,
  actionState: LoginActionState
): LoginUiState {
  if (isSubmitting) {
    return {
      status: "submitting",
      message: LOGIN_SUBMITTING_MESSAGE
    };
  }

  if (actionState.status === "error") {
    return {
      status: "error",
      message: actionState.message ?? LOGIN_GENERIC_ERROR_MESSAGE
    };
  }

  return {
    status: "idle",
    message: LOGIN_IDLE_MESSAGE
  };
}

export function getAuthErrorMessage(errorType: string): string {
  if (errorType === "CredentialsSignin") {
    return LOGIN_CREDENTIALS_ERROR_MESSAGE;
  }

  return LOGIN_GENERIC_ERROR_MESSAGE;
}
