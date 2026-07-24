import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface Notification {
  id: number;
  userId: string | null; // null = broadcast (visible to all privileged users)
  title: string;
  message: string;
  type?: string;
  module?: string;
  referenceId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const notificationService = {
  /**
   * FIX: Use /my endpoints — backend scopes to caller automatically.
   *      Privileged users (managers/HR/admin) also receive broadcast notifications.
   *      Previously used /user/:userId path which exposed other users' data.
   */
  async getMyNotifications(): Promise<Notification[]> {
    const { data } =
      await apiClient.get<ApiResponse<Notification[]>>("/notifications/my");
    return data.data ?? [];
  },

  async getMyUnread(): Promise<Notification[]> {
    const { data } = await apiClient.get<ApiResponse<Notification[]>>(
      "/notifications/my/unread",
    );
    return data.data ?? [];
  },

  async getMyUnreadCount(): Promise<number> {
    const { data } = await apiClient.get<ApiResponse<{ count: number }>>(
      "/notifications/my/unread-count",
    );
    return data.data?.count ?? 0;
  },

  async markRead(id: number): Promise<Notification> {
    const { data } = await apiClient.put<ApiResponse<Notification>>(
      `/notifications/${id}/read`,
    );
    return data.data;
  },

  async markAllRead(): Promise<number> {
    const { data } = await apiClient.put<ApiResponse<{ updated: number }>>(
      "/notifications/my/read-all",
    );
    return data.data?.updated ?? 0;
  },

  async deleteNotification(id: number): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
