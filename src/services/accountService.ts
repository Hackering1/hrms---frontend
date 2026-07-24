import { apiClient } from "./apiClient";
import type { ApiResponse, Employee } from "../utils/types";

export const accountService = {
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await apiClient.post<ApiResponse<void>>("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },
  async getProfile(): Promise<Employee> {
    const { data } =
      await apiClient.get<ApiResponse<Employee>>("/employees/me");
    return data.data;
  },
  async updateProfile(body: Partial<Employee>): Promise<Employee> {
    const { data } = await apiClient.put<ApiResponse<Employee>>(
      "/employees/me",
      body,
    );
    return data.data;
  },
};
