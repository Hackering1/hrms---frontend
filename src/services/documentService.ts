import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface EmployeeDocument {
  id: number;
  employeeId: string;
  categoryId?: number;
  documentName: string;
  fileUrl: string;
  fileType?: string;
  fileSizeKb?: number;
  expiryDate?: string;
  createdAt: string;
}

export interface DocumentCreate {
  employeeId: string;
  categoryId?: number;
  documentName: string;
  fileUrl: string;
  fileType?: string;
  expiryDate?: string;
  uploadedBy: string | null;
}

export const documentService = {
  async byEmployee(employeeId: string): Promise<EmployeeDocument[]> {
    const { data } = await apiClient.get<ApiResponse<EmployeeDocument[]>>(
      `/employee-documents/employee/${employeeId}`,
    );
    return data.data;
  },
  async add(body: DocumentCreate): Promise<EmployeeDocument> {
    const { data } = await apiClient.post<ApiResponse<EmployeeDocument>>(
      "/employee-documents",
      body,
    );
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete(`/employee-documents/${id}`);
  },
};
