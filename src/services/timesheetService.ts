import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface TimesheetProject {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ProjectBody {
  name: string;
  code: string;
  isActive?: boolean;
}

export interface TimesheetEntry {
  id?: number;
  projectId: number;
  workDate: string; // yyyy-MM-dd
  hours: number;
  description?: string;
}

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface Timesheet {
  id: number | null; // null = week not saved yet
  employeeId: string;
  weekStart: string; // Monday, yyyy-MM-dd
  status: TimesheetStatus;
  totalHours: number;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewerRemarks?: string | null;
  entries: TimesheetEntry[];
}

export interface TimesheetDecisionBody {
  status: "APPROVED" | "REJECTED";
  remarks?: string;
}

export const timesheetService = {
  async activeProjects(): Promise<TimesheetProject[]> {
    const { data } = await apiClient.get<ApiResponse<TimesheetProject[]>>(
      "/timesheets/projects",
    );
    return data.data;
  },
  async allProjects(): Promise<TimesheetProject[]> {
    const { data } = await apiClient.get<ApiResponse<TimesheetProject[]>>(
      "/timesheets/projects/all",
    );
    return data.data;
  },
  async createProject(body: ProjectBody): Promise<TimesheetProject> {
    const { data } = await apiClient.post<ApiResponse<TimesheetProject>>(
      "/timesheets/projects",
      body,
    );
    return data.data;
  },
  async updateProject(
    id: number,
    body: ProjectBody,
  ): Promise<TimesheetProject> {
    const { data } = await apiClient.put<ApiResponse<TimesheetProject>>(
      `/timesheets/projects/${id}`,
      body,
    );
    return data.data;
  },

  async myHistory(): Promise<Timesheet[]> {
    const { data } =
      await apiClient.get<ApiResponse<Timesheet[]>>("/timesheets/me");
    return data.data;
  },
  async myWeek(weekStart: string): Promise<Timesheet> {
    const { data } = await apiClient.get<ApiResponse<Timesheet>>(
      `/timesheets/me/week/${weekStart}`,
    );
    return data.data;
  },
  async saveMyWeek(
    weekStart: string,
    entries: TimesheetEntry[],
  ): Promise<Timesheet> {
    const { data } = await apiClient.put<ApiResponse<Timesheet>>(
      `/timesheets/me/week/${weekStart}`,
      { entries },
    );
    return data.data;
  },
  async submitMyWeek(weekStart: string): Promise<Timesheet> {
    const { data } = await apiClient.post<ApiResponse<Timesheet>>(
      `/timesheets/me/week/${weekStart}/submit`,
    );
    return data.data;
  },

  async pending(): Promise<Timesheet[]> {
    const { data } = await apiClient.get<ApiResponse<Timesheet[]>>(
      "/timesheets/pending",
    );
    return data.data;
  },
  async decide(id: number, body: TimesheetDecisionBody): Promise<Timesheet> {
    const { data } = await apiClient.put<ApiResponse<Timesheet>>(
      `/timesheets/${id}/decision`,
      body,
    );
    return data.data;
  },
};
