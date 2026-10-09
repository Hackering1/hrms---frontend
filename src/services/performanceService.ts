import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface PerformanceCycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
}

export interface CycleBody {
  name: string;
  startDate: string;
  endDate: string;
}

export interface PerformanceGoal {
  id: number;
  cycleId: number;
  employeeId: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
  progress: number;
}

export interface GoalBody {
  employeeId?: string;
  cycleId?: number;
  title: string;
  description?: string;
  targetDate?: string | null;
  progress?: number;
}

export type ReviewStatus = "NOT_STARTED" | "SELF_SUBMITTED" | "COMPLETED";

export interface PerformanceReview {
  id: number | null; // null = no self review submitted yet
  cycleId: number;
  employeeId: string;
  status: ReviewStatus;
  selfRating?: number | null;
  selfComments?: string | null;
  selfSubmittedAt?: string | null;
  managerRating?: number | null;
  managerComments?: string | null;
  reviewerId?: string | null;
  completedAt?: string | null;
}

export const performanceService = {
  async cycles(): Promise<PerformanceCycle[]> {
    const { data } = await apiClient.get<ApiResponse<PerformanceCycle[]>>(
      "/performance/cycles",
    );
    return data.data;
  },
  async createCycle(body: CycleBody): Promise<PerformanceCycle> {
    const { data } = await apiClient.post<ApiResponse<PerformanceCycle>>(
      "/performance/cycles",
      body,
    );
    return data.data;
  },
  async updateCycle(id: number, body: CycleBody): Promise<PerformanceCycle> {
    const { data } = await apiClient.put<ApiResponse<PerformanceCycle>>(
      `/performance/cycles/${id}`,
      body,
    );
    return data.data;
  },
  async setCycleStatus(
    id: number,
    status: "OPEN" | "CLOSED",
  ): Promise<PerformanceCycle> {
    const { data } = await apiClient.put<ApiResponse<PerformanceCycle>>(
      `/performance/cycles/${id}/status`,
      { status },
    );
    return data.data;
  },

  async myGoals(cycleId: number): Promise<PerformanceGoal[]> {
    const { data } = await apiClient.get<ApiResponse<PerformanceGoal[]>>(
      "/performance/goals/me",
      { params: { cycleId } },
    );
    return data.data;
  },
  async employeeGoals(
    employeeId: string,
    cycleId: number,
  ): Promise<PerformanceGoal[]> {
    const { data } = await apiClient.get<ApiResponse<PerformanceGoal[]>>(
      `/performance/goals/employee/${employeeId}`,
      { params: { cycleId } },
    );
    return data.data;
  },
  async createGoal(body: GoalBody): Promise<PerformanceGoal> {
    const { data } = await apiClient.post<ApiResponse<PerformanceGoal>>(
      "/performance/goals",
      body,
    );
    return data.data;
  },
  async updateGoal(id: number, body: GoalBody): Promise<PerformanceGoal> {
    const { data } = await apiClient.put<ApiResponse<PerformanceGoal>>(
      `/performance/goals/${id}`,
      body,
    );
    return data.data;
  },
  async deleteGoal(id: number): Promise<void> {
    await apiClient.delete(`/performance/goals/${id}`);
  },

  async myReview(cycleId: number): Promise<PerformanceReview> {
    const { data } = await apiClient.get<ApiResponse<PerformanceReview>>(
      "/performance/reviews/me",
      { params: { cycleId } },
    );
    return data.data;
  },
  async submitSelfReview(body: {
    cycleId: number;
    rating: number;
    comments: string;
  }): Promise<PerformanceReview> {
    const { data } = await apiClient.post<ApiResponse<PerformanceReview>>(
      "/performance/reviews/me",
      body,
    );
    return data.data;
  },
  async teamReviews(cycleId: number): Promise<PerformanceReview[]> {
    const { data } = await apiClient.get<ApiResponse<PerformanceReview[]>>(
      "/performance/reviews/team",
      { params: { cycleId } },
    );
    return data.data;
  },
  async completeReview(
    id: number,
    body: { rating: number; comments: string },
  ): Promise<PerformanceReview> {
    const { data } = await apiClient.put<ApiResponse<PerformanceReview>>(
      `/performance/reviews/${id}/manager`,
      body,
    );
    return data.data;
  },
};
