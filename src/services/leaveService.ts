import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  daysPerYear: number;
  isCarryForward?: boolean;
  maxCarryForward?: number;
  isPaid?: boolean;
  applicableGender?: string;
  requiresDocument?: boolean;
  minDaysNotice?: number;
  isActive?: boolean;
}

export interface LeaveBalance {
  id: number;
  employeeId: string;
  leaveTypeId: number;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  carriedDays: number;
  balanceDays: number;
}

export interface LeaveRequest {
  id: number;
  employeeId: string;
  leaveTypeId: number;
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  dayType: string;
  reason: string;
  documentUrl?: string;
  status: string;
  approverRemarks?: string;
  createdAt: string;
}

export interface LeaveApplyBody {
  employeeId: string;
  leaveTypeId: number;
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  dayType: string;
  reason: string;
  documentUrl?: string;
}

export interface LeaveDecisionBody {
  approvedBy: string | null;
  status: "APPROVED" | "REJECTED";
  approverRemarks?: string;
}

// HR leave regularization — edit an existing leave.
export interface LeaveRegularizeBody {
  leaveTypeId?: number;
  fromDate: string;
  toDate: string;
  dayType?: string;
  reason?: string;
}

export const leaveService = {
  async listTypes(): Promise<LeaveType[]> {
    const { data } =
      await apiClient.get<ApiResponse<LeaveType[]>>("/leave-types");
    return data.data;
  },
  async balances(employeeId: string, year: number): Promise<LeaveBalance[]> {
    const { data } = await apiClient.get<ApiResponse<LeaveBalance[]>>(
      `/leave-balances/employee/${employeeId}/year/${year}`,
    );
    return data.data;
  },
  async listAll(): Promise<LeaveRequest[]> {
    const { data } =
      await apiClient.get<ApiResponse<LeaveRequest[]>>("/leave-requests");
    return data.data;
  },
  async pending(): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<ApiResponse<LeaveRequest[]>>(
      "/leave-requests/pending",
    );
    return data.data;
  },
  async byEmployee(employeeId: string): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<ApiResponse<LeaveRequest[]>>(
      `/leave-requests/employee/${employeeId}`,
    );
    return data.data;
  },
  async apply(body: LeaveApplyBody): Promise<LeaveRequest> {
    const { data } = await apiClient.post<ApiResponse<LeaveRequest>>(
      "/leave-requests",
      body,
    );
    return data.data;
  },
  async decide(id: number, body: LeaveDecisionBody): Promise<LeaveRequest> {
    const { data } = await apiClient.put<ApiResponse<LeaveRequest>>(
      `/leave-requests/${id}/decision`,
      body,
    );
    return data.data;
  },

  // HR leave regularization: edit an existing leave (dates/type/day-type).
  async regularize(
    id: number,
    body: LeaveRegularizeBody,
  ): Promise<LeaveRequest> {
    const { data } = await apiClient.put<ApiResponse<LeaveRequest>>(
      `/leave-requests/${id}`,
      body,
    );
    return data.data;
  },

  // HR leave regularization: cancel a leave (returns days to balance).
  async cancel(id: number): Promise<LeaveRequest> {
    const { data } = await apiClient.delete<ApiResponse<LeaveRequest>>(
      `/leave-requests/${id}`,
    );
    return data.data;
  },

  // HR/Admin only — permanently removes the row (any status), unlike
  // cancel() above which just flips the status to CANCELLED.
  async deletePermanent(id: number): Promise<void> {
    await apiClient.delete(`/leave-requests/${id}/permanent`);
  },
};
