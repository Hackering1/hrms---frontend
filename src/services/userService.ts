import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface PortalUser {
  id: string;
  email: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: string;
}

export const userService = {
  async listActive(): Promise<PortalUser[]> {
    const { data } = await apiClient.get<ApiResponse<PortalUser[]>>("/users");
    return data.data;
  },
  async listDeleted(): Promise<PortalUser[]> {
    const { data } =
      await apiClient.get<ApiResponse<PortalUser[]>>("/users/deleted");
    return data.data;
  },
  // PERMANENT (hard) delete
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
  // Soft deactivate (optional)
  async deactivate(id: string): Promise<void> {
    await apiClient.post(`/users/${id}/deactivate`);
  },
  async restore(id: string): Promise<void> {
    await apiClient.post(`/users/${id}/restore`);
  },
  // Change a user's role (e.g. EMPLOYEE -> MANAGER). Super admin only.
  async changeRole(id: string, roleName: string): Promise<void> {
    await apiClient.put(`/users/${id}/role`, { roleName });
  },
};
