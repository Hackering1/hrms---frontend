import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "CLOSED";
  raisedById: string;
  raisedByEmail?: string;
  resolvedById?: string;
  createdAt: string;
  updatedAt: string;
}

export const ticketService = {
  async list(): Promise<Ticket[]> {
    const { data } = await apiClient.get<ApiResponse<Ticket[]>>("/tickets");
    return data.data;
  },
  async counts(): Promise<Record<string, number>> {
    const { data } =
      await apiClient.get<ApiResponse<Record<string, number>>>(
        "/tickets/counts",
      );
    return data.data;
  },
  async raise(body: {
    subject: string;
    description: string;
    priority: string;
    raisedById: string;
    raisedByEmail?: string;
  }): Promise<Ticket> {
    const { data } = await apiClient.post<ApiResponse<Ticket>>(
      "/tickets",
      body,
    );
    return data.data;
  },
  async updateStatus(
    id: number,
    status: string,
    resolvedById: string,
  ): Promise<Ticket> {
    const { data } = await apiClient.put<ApiResponse<Ticket>>(
      `/tickets/${id}/status`,
      { status, resolvedById },
    );
    return data.data;
  },
};
