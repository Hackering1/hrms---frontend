import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface OnboardingTask {
  id: number;
  employeeId: string;
  taskName: string;
  category?: string;
  isCompleted: boolean;
  dueDate?: string;
  remarks?: string;
}

export interface Probation {
  id: number;
  employeeId: string;
  probationStart: string;
  probationEnd: string;
  extendedEndDate?: string;
  status: string;
  reviewNotes?: string;
}

export interface Confirmation {
  id: number;
  employeeId: string;
  confirmationDate: string;
  remarks?: string;
  letterGenerated: boolean;
}

export interface ExitRecord {
  id: number;
  employeeId: string;
  resignationDate?: string;
  lastWorkingDate?: string;
  exitType?: string;
  noticePeriodDays?: number;
  noticeWaived: boolean;
  exitInterviewDone: boolean;
  exitRemarks?: string;
}

export const hropsService = {
  // Onboarding
  async onboardingByEmployee(employeeId: string): Promise<OnboardingTask[]> {
    const { data } = await apiClient.get<ApiResponse<OnboardingTask[]>>(
      `/onboarding-tasks/employee/${employeeId}`,
    );
    return data.data;
  },
  async addOnboardingTask(
    body: Partial<OnboardingTask>,
  ): Promise<OnboardingTask> {
    const { data } = await apiClient.post<ApiResponse<OnboardingTask>>(
      "/onboarding-tasks",
      body,
    );
    return data.data;
  },
  async completeTask(id: number, completed: boolean): Promise<OnboardingTask> {
    const { data } = await apiClient.put<ApiResponse<OnboardingTask>>(
      `/onboarding-tasks/${id}/complete`,
      { completed, completedBy: null },
    );
    return data.data;
  },
  async deleteTask(id: number): Promise<void> {
    await apiClient.delete(`/onboarding-tasks/${id}`);
  },

  // Probation
  async probationByEmployee(employeeId: string): Promise<Probation[]> {
    const { data } = await apiClient.get<ApiResponse<Probation[]>>(
      `/probation/employee/${employeeId}`,
    );
    return data.data;
  },
  async addProbation(body: Partial<Probation>): Promise<Probation> {
    const { data } = await apiClient.post<ApiResponse<Probation>>(
      "/probation",
      body,
    );
    return data.data;
  },
  async reviewProbation(
    id: number,
    status: string,
    reviewNotes: string,
  ): Promise<Probation> {
    const { data } = await apiClient.put<ApiResponse<Probation>>(
      `/probation/${id}/review`,
      {
        status,
        reviewNotes,
        reviewedBy: null,
      },
    );
    return data.data;
  },

  // Confirmations
  async confirmationsByEmployee(employeeId: string): Promise<Confirmation[]> {
    const { data } = await apiClient.get<ApiResponse<Confirmation[]>>(
      `/confirmations/employee/${employeeId}`,
    );
    return data.data;
  },
  async addConfirmation(body: Partial<Confirmation>): Promise<Confirmation> {
    const { data } = await apiClient.post<ApiResponse<Confirmation>>(
      "/confirmations",
      body,
    );
    return data.data;
  },

  // Exit
  async exitByEmployee(employeeId: string): Promise<ExitRecord[]> {
    const { data } = await apiClient.get<ApiResponse<ExitRecord[]>>(
      `/exit-records/employee/${employeeId}`,
    );
    return data.data;
  },
  async addExit(body: Partial<ExitRecord>): Promise<ExitRecord> {
    const { data } = await apiClient.post<ApiResponse<ExitRecord>>(
      "/exit-records",
      body,
    );
    return data.data;
  },
};
