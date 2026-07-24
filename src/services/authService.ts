import { apiClient } from "./apiClient";
import type { ApiResponse, AuthResponse } from "../utils/types";

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
      "/auth/login",
      { email, password },
      // NEW: Longer timeout for login specifically. The default apiClient timeout
      // (30s) can expire mid-cold-start on Render's free tier; 60s lets a single
      // request ride out the spin-up instead of failing. Combined with the retry
      // logic in useLogin, this makes cold starts recover on their own.
      { timeout: 60000 },
    );
    return data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post("/auth/logout", { refreshToken });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await apiClient.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },

  async adminResetPassword(email: string, newPassword: string): Promise<void> {
    await apiClient.post("/auth/admin/reset-password", { email, newPassword });
  },

  async register(
    email: string,
    password: string,
    roleName: string,
  ): Promise<void> {
    await apiClient.post("/auth/register", { email, password, roleName });
  },
};
