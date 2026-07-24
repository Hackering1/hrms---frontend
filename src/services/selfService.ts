import { apiClient } from "./apiClient";
import type { ApiResponse, Employee } from "../utils/types";
import { fileService } from "./fileService";

export const selfService = {
  // The logged-in user's own employee record (backend reads the JWT).
  async me(): Promise<Employee> {
    const { data } =
      await apiClient.get<ApiResponse<Employee>>("/employees/me");
    return data.data;
  },

  // Link an employee record to a user account (admin action; used for setup/testing).
  async linkUser(employeeId: string, userId: string): Promise<Employee> {
    const { data } = await apiClient.put<ApiResponse<Employee>>(
      `/employees/${employeeId}/link-user/${userId}`,
      {},
    );
    return data.data;
  },

  // Self-service: upload a new profile photo and save it to my own record.
  // Uploads the image to /api/files first, then stores its url on my employee.
  async updatePhoto(file: File): Promise<Employee> {
    const uploaded = await fileService.upload(file); // { id, url, ... }
    const { data } = await apiClient.put<ApiResponse<Employee>>(
      "/employees/me/photo",
      { photoUrl: uploaded.url },
    );
    return data.data;
  },
};
