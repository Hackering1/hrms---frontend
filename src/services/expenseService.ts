import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface ExpenseCategory {
  id: number;
  name: string;
  maxAmount?: number | null;
  requiresReceipt: boolean;
  isActive: boolean;
}

export interface ExpenseCategoryBody {
  name: string;
  maxAmount?: number | null;
  requiresReceipt?: boolean;
  isActive?: boolean;
}

export type ExpenseStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED";

export interface ExpenseClaim {
  id: number;
  employeeId: string;
  categoryId: number;
  expenseDate: string;
  amount: number;
  description: string;
  receiptFileId?: string | null;
  receiptUrl?: string | null; // "/api/files/{uuid}" — open with fileService.openFile
  status: ExpenseStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewerRemarks?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
}

export interface ExpenseClaimBody {
  categoryId: number;
  expenseDate: string;
  amount: number;
  description: string;
  receiptFileId?: string | null;
}

export const expenseService = {
  async activeCategories(): Promise<ExpenseCategory[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseCategory[]>>(
      "/expenses/categories",
    );
    return data.data;
  },
  async allCategories(): Promise<ExpenseCategory[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseCategory[]>>(
      "/expenses/categories/all",
    );
    return data.data;
  },
  async createCategory(body: ExpenseCategoryBody): Promise<ExpenseCategory> {
    const { data } = await apiClient.post<ApiResponse<ExpenseCategory>>(
      "/expenses/categories",
      body,
    );
    return data.data;
  },
  async updateCategory(
    id: number,
    body: ExpenseCategoryBody,
  ): Promise<ExpenseCategory> {
    const { data } = await apiClient.put<ApiResponse<ExpenseCategory>>(
      `/expenses/categories/${id}`,
      body,
    );
    return data.data;
  },

  async myClaims(): Promise<ExpenseClaim[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseClaim[]>>(
      "/expenses/claims/me",
    );
    return data.data;
  },
  async submit(body: ExpenseClaimBody): Promise<ExpenseClaim> {
    const { data } = await apiClient.post<ApiResponse<ExpenseClaim>>(
      "/expenses/claims",
      body,
    );
    return data.data;
  },
  async cancel(id: number): Promise<ExpenseClaim> {
    const { data } = await apiClient.put<ApiResponse<ExpenseClaim>>(
      `/expenses/claims/${id}/cancel`,
    );
    return data.data;
  },

  async pending(): Promise<ExpenseClaim[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseClaim[]>>(
      "/expenses/claims/pending",
    );
    return data.data;
  },
  async decide(
    id: number,
    body: { status: "APPROVED" | "REJECTED"; remarks?: string },
  ): Promise<ExpenseClaim> {
    const { data } = await apiClient.put<ApiResponse<ExpenseClaim>>(
      `/expenses/claims/${id}/decision`,
      body,
    );
    return data.data;
  },

  async payable(): Promise<ExpenseClaim[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseClaim[]>>(
      "/expenses/claims/payable",
    );
    return data.data;
  },
  async markPaid(id: number, reference?: string): Promise<ExpenseClaim> {
    const { data } = await apiClient.put<ApiResponse<ExpenseClaim>>(
      `/expenses/claims/${id}/pay`,
      { reference },
    );
    return data.data;
  },
};
