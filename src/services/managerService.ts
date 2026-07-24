import { apiClient } from "./apiClient";
import type { ApiResponse, Employee } from "../utils/types";

export interface ManagerAssignment {
  id: number;
  employeeId: string;
  managerId: string;
  isPrimary?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface ManagerTeamSize {
  managerId: string;
  managerName: string;
  employeeCode: string;
  teamSize: number;
}

export const managerService = {
  async team(managerId: string): Promise<Employee[]> {
    const { data } = await apiClient.get<ApiResponse<Employee[]>>(
      `/manager/${managerId}/team`,
    );
    return data.data;
  },

  async teamIds(managerId: string): Promise<string[]> {
    const { data } = await apiClient.get<ApiResponse<string[]>>(
      `/manager/${managerId}/team-ids`,
    );
    return data.data;
  },

  async managers(employeeId: string): Promise<Employee[]> {
    const { data } = await apiClient.get<ApiResponse<Employee[]>>(
      `/manager/employee/${employeeId}/managers`,
    );
    return data.data;
  },

  // Managers who already have reports.
  async allManagers(): Promise<Employee[]> {
    const { data } =
      await apiClient.get<ApiResponse<Employee[]>>("/manager/all");
    return data.data;
  },

  // Everyone eligible to be a manager (has a MANAGER/HR login role).
  async assignableManagers(): Promise<Employee[]> {
    const { data } = await apiClient.get<ApiResponse<Employee[]>>(
      "/manager/assignable",
    );
    return data.data;
  },

  // All assignment rows (for display + removal by id).
  async allAssignments(): Promise<ManagerAssignment[]> {
    const { data } = await apiClient.get<ApiResponse<ManagerAssignment[]>>(
      "/manager/assignments",
    );
    return data.data;
  },

  // NEW: employees-per-manager breakdown (Super Admin analytics chart).
  async teamSizes(): Promise<ManagerTeamSize[]> {
    const { data } = await apiClient.get<ApiResponse<ManagerTeamSize[]>>(
      "/manager/team-sizes",
    );
    return data.data;
  },

  async assign(body: {
    employeeId: string;
    managerId: string;
    isPrimary?: boolean;
    effectiveFrom?: string;
  }): Promise<ManagerAssignment> {
    const { data } = await apiClient.post<ApiResponse<ManagerAssignment>>(
      "/manager/assign",
      body,
    );
    return data.data;
  },

  async unassign(id: number): Promise<void> {
    await apiClient.delete(`/manager/assign/${id}`);
  },
};
