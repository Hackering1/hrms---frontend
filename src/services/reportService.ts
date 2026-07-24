import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface EmployeeReport {
  totalEmployees: number;
  byStatus: Record<string, number>;
  byDepartment: Record<string, number>;
  byBranch: Record<string, number>;
  byEmploymentType: Record<string, number>;
}

export interface AttendanceReport {
  date: string;
  totalRecords: number;
  byStatus: Record<string, number>;
  checkedIn: number;
  checkedOut: number;
  present: number;
  absent: number;
  regularized: number;
}

export interface LeaveReport {
  totalRequests: number;
  byStatus: Record<string, number>;
  totalDaysRequested: number;
  totalDaysApproved: number;
}

export const reportService = {
  async employees(): Promise<EmployeeReport> {
    const { data } =
      await apiClient.get<ApiResponse<EmployeeReport>>("/reports/employees");
    return data.data;
  },
  async attendance(date: string): Promise<AttendanceReport> {
    const { data } = await apiClient.get<ApiResponse<AttendanceReport>>(
      `/reports/attendance?date=${date}`,
    );
    return data.data;
  },
  async leave(): Promise<LeaveReport> {
    const { data } =
      await apiClient.get<ApiResponse<LeaveReport>>("/reports/leave");
    return data.data;
  },
};
