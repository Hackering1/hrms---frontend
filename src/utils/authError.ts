import type { AxiosError } from "axios";

export type AuthErrorKind =
  | "credentials"
  | "server_waking"
  | "deactivated"
  | "unknown";

export interface ClassifiedAuthError {
  kind: AuthErrorKind;
  message: string;
  /** True when it's worth auto-retrying (server asleep / unreachable / gateway). */
  retryable: boolean;
}

/**
 * Turn an axios error from the login call into a user-meaningful classification.
 *
 * The whole point: a sleeping backend (Render free tier spins down after ~15 min
 * idle) produces a timeout or a 502/503/504 while it boots — which is NOT a wrong
 * password. Showing "invalid credentials" in that case is misleading and trains
 * users to retype correct passwords. We separate the two so the UI can say
 * "waking up, retrying…" and auto-retry, versus "invalid email or password".
 */
export function classifyAuthError(error: unknown): ClassifiedAuthError {
  const err = error as AxiosError<any>;

  // No HTTP response at all → network error / DNS / connection refused / CORS / timeout.
  const noResponse = !err?.response;
  const isTimeout = err?.code === "ECONNABORTED";
  const isNetwork = err?.code === "ERR_NETWORK";

  const status = err?.response?.status;
  const backendMessage: string | undefined = err?.response?.data?.message;

  // Gateway / unavailable statuses Render returns while a service is spinning up.
  const isGatewayCold = status === 502 || status === 503 || status === 504;

  if (noResponse || isTimeout || isNetwork || isGatewayCold) {
    return {
      kind: "server_waking",
      message:
        "The server is waking up (this can take up to a minute on the free tier). Retrying…",
      retryable: true,
    };
  }

  // Deactivated account — backend returns a specific 400 message.
  if (status === 400 && backendMessage && /deactivat/i.test(backendMessage)) {
    return { kind: "deactivated", message: backendMessage, retryable: false };
  }

  // Real credential failure (our AuthService returns 400 "Invalid email or password.").
  if (status === 400 || status === 401) {
    return {
      kind: "credentials",
      message: backendMessage ?? "Invalid email or password.",
      retryable: false,
    };
  }

  // Anything else (500, etc.) — surface backend message if present.
  return {
    kind: "unknown",
    message:
      backendMessage ?? "Something went wrong signing in. Please try again.",
    retryable: false,
  };
}
