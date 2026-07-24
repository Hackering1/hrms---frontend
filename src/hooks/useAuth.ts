import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { classifyAuthError } from "../utils/authError";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),

    // NEW: Auto-retry ONLY when the failure looks like the backend is asleep /
    // unreachable (timeout, network error, 502/503/504). Never retry a real
    // credential error — retrying a wrong password is pointless and annoying.
    // Up to 3 retries; combined with the 60s login timeout in authService this
    // comfortably covers a Render free-tier cold start (~30–50s).
    retry: (failureCount, error) => {
      const { retryable } = classifyAuthError(error);
      return retryable && failureCount < 3;
    },
    // Wait 5s between wake-up retries (server is booting; hammering doesn't help).
    retryDelay: 5000,

    onSuccess: (data) => {
      // Guard against missing fields in the auth response to prevent a crash
      // in setAuth when the backend returns an unexpected shape.
      if (!data?.accessToken) {
        console.error("Login response missing accessToken", data);
        return;
      }
      // Wipe any cached data from a previous session BEFORE storing the new
      // identity — otherwise the last user's profile photo, "me", dashboard,
      // etc. bleed into the new login (e.g. logging in as a second super admin
      // showed the first admin's details).
      queryClient.clear();
      setAuth({
        userId: data.userId ?? "",
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? "",
        email: data.email ?? "",
        roles: Array.isArray(data.roles) ? data.roles : [],
        mustChangePassword: !!data.mustChangePassword,
      });
      navigate("/dashboard");
    },
  });
}

export function useLogout() {
  const { refreshToken, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // ignore network errors on logout — always clear local state
    } finally {
      clearAuth();
      queryClient.clear(); // drop all cached data so the next user starts clean
      navigate("/login", { replace: true });
    }
  };
}
