import { apiClient } from "./apiClient";
import type { ApiResponse, ResourceRecord } from "../utils/types";

export interface InviteEmployeeInput {
  employeeCode?: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  shiftId?: string;
  managerId?: string;
  dateOfJoining: string;
  email: string;
  loginRole: string;
}

// Admin-only endpoints (Super Admin) — mirrors the shape of resourceService but
// targets the dedicated /api/employees/invite* routes rather than a generic
// CRUD resource.
export const inviteService = {
  async send(body: InviteEmployeeInput): Promise<ResourceRecord> {
    const { data } = await apiClient.post<ApiResponse<ResourceRecord>>(
      "/employees/invite",
      body,
    );
    return data.data;
  },

  async list(): Promise<ResourceRecord[]> {
    const { data } = await apiClient.get<ApiResponse<ResourceRecord[]>>(
      "/employees/invitations",
    );
    return data.data;
  },

  async resend(id: string): Promise<ResourceRecord> {
    const { data } = await apiClient.post<ApiResponse<ResourceRecord>>(
      `/employees/invitations/${id}/resend`,
    );
    return data.data;
  },

  async cancel(id: string): Promise<void> {
    await apiClient.delete(`/employees/invitations/${id}`);
  },

  async pendingProfiles(): Promise<ResourceRecord[]> {
    const { data } =
      await apiClient.get<ApiResponse<ResourceRecord[]>>("/employees/pending");
    return data.data;
  },
};
