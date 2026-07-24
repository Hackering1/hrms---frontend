import { apiClient } from "./apiClient";
import type { ApiResponse, ResourceRecord } from "../utils/types";

// Generic CRUD service used by every resource (branches, employees, ...).
export const resourceService = {
  async list(endpoint: string): Promise<ResourceRecord[]> {
    const { data } =
      await apiClient.get<ApiResponse<ResourceRecord[]>>(endpoint);
    return data.data;
  },

  // GET a single object/value from an exact path (e.g. /employees/new-defaults).
  async get<T = unknown>(path: string): Promise<T> {
    const { data } = await apiClient.get<ApiResponse<T>>(path);
    return data.data;
  },

  async create(
    endpoint: string,
    body: ResourceRecord,
  ): Promise<ResourceRecord> {
    const { data } = await apiClient.post<ApiResponse<ResourceRecord>>(
      endpoint,
      body,
    );
    return data.data;
  },

  async update(
    endpoint: string,
    id: number | string,
    body: ResourceRecord,
  ): Promise<ResourceRecord> {
    const { data } = await apiClient.put<ApiResponse<ResourceRecord>>(
      `${endpoint}/${id}`,
      body,
    );
    return data.data;
  },

  // PUT to an exact path with a custom body (e.g. /users/{id}/role).
  async updateRaw(path: string, body: unknown): Promise<unknown> {
    const { data } = await apiClient.put<ApiResponse<unknown>>(path, body);
    return data.data;
  },

  async remove(endpoint: string, id: number | string): Promise<void> {
    await apiClient.delete(`${endpoint}/${id}`);
  },
};
