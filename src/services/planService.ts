import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface SubscriptionPlan {
  id: number;
  name: string;
  code: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees?: number | null;
  features?: string | null;
  isActive: boolean;
}

export interface PlanBody {
  name: string;
  code: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees?: number | null;
  features?: string;
  isActive?: boolean;
}

export type BillingCycle = "MONTHLY" | "YEARLY";

export interface CompanySubscription {
  id: number;
  planId: number;
  billingCycle: BillingCycle;
  startDate: string;
  endDate?: string | null;
  status: "ACTIVE" | "CANCELLED" | "REPLACED";
}

export interface CurrentPlan {
  subscription: CompanySubscription | null;
  plan: SubscriptionPlan | null;
  employeeCount: number;
  maxEmployees?: number | null;
  overLimit: boolean;
}

export const planService = {
  async list(): Promise<SubscriptionPlan[]> {
    const { data } =
      await apiClient.get<ApiResponse<SubscriptionPlan[]>>("/plans");
    return data.data;
  },
  async create(body: PlanBody): Promise<SubscriptionPlan> {
    const { data } = await apiClient.post<ApiResponse<SubscriptionPlan>>(
      "/plans",
      body,
    );
    return data.data;
  },
  async update(id: number, body: PlanBody): Promise<SubscriptionPlan> {
    const { data } = await apiClient.put<ApiResponse<SubscriptionPlan>>(
      `/plans/${id}`,
      body,
    );
    return data.data;
  },
  async current(): Promise<CurrentPlan> {
    const { data } =
      await apiClient.get<ApiResponse<CurrentPlan>>("/plans/current");
    return data.data;
  },
  async history(): Promise<CompanySubscription[]> {
    const { data } =
      await apiClient.get<ApiResponse<CompanySubscription[]>>("/plans/history");
    return data.data;
  },
  async subscribe(
    planId: number,
    billingCycle: BillingCycle,
  ): Promise<CurrentPlan> {
    const { data } = await apiClient.post<ApiResponse<CurrentPlan>>(
      "/plans/subscribe",
      {
        planId,
        billingCycle,
      },
    );
    return data.data;
  },
  async cancel(): Promise<CurrentPlan> {
    const { data } =
      await apiClient.post<ApiResponse<CurrentPlan>>("/plans/cancel");
    return data.data;
  },
};
