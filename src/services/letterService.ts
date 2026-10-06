import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface GeneratedLetter {
  id: number;
  employeeId: string;
  templateId?: number;
  letterType: string;
  letterDate: string;
  fileUrl?: string;
}

export interface LetterPreview {
  letterType: string;
  content: string;
}

// Portal manager as offered in the Generate Letter "Reporting Manager" dropdown.
export interface ReportingManagerOption {
  id: string;
  name: string;
  employeeCode?: string;
  designation?: string;
}

export const letterService = {
  async byEmployee(employeeId: string): Promise<GeneratedLetter[]> {
    const { data } = await apiClient.get<ApiResponse<GeneratedLetter[]>>(
      `/generated-letters/employee/${employeeId}`,
    );
    return data.data;
  },
  async preview(
    templateId: number,
    employeeId: string,
  ): Promise<LetterPreview> {
    const { data } = await apiClient.get<ApiResponse<LetterPreview>>(
      `/generated-letters/preview?templateId=${templateId}&employeeId=${employeeId}`,
    );
    return data.data;
  },
  async generate(
    employeeId: string,
    templateId: number,
    letterDate: string,
  ): Promise<GeneratedLetter> {
    const { data } = await apiClient.post<ApiResponse<GeneratedLetter>>(
      "/generated-letters",
      {
        employeeId,
        templateId,
        letterDate,
        generatedBy: null,
      },
    );
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete(`/generated-letters/${id}`);
  },
  // Generate a formatted Offer/Appointment PDF (server-side) and return the blob.
  async generatePdf(payload: Record<string, unknown>): Promise<Blob> {
    const res = await apiClient.post("/letter-pdf", payload, {
      responseType: "blob",
    });
    return res.data as Blob;
  },
  // Portal managers for the Internship Offer Letter's Reporting Manager
  // dropdown — served from the existing manager source, never hardcoded.
  async reportingManagers(): Promise<ReportingManagerOption[]> {
    const { data } = await apiClient.get<ApiResponse<ReportingManagerOption[]>>(
      "/letter-pdf/reporting-managers",
    );
    return data.data;
  },
  // NEW — generate the same letter PDF server-side and email it, instead of
  // downloading it. Reuses the exact same payload shape as generatePdf().
  async sendEmail(
    payload: Record<string, unknown>,
    recipientEmail: string,
  ): Promise<string> {
    const { data } = await apiClient.post<ApiResponse<string>>(
      "/letter-pdf/send-email",
      { letter: payload, recipientEmail },
    );
    return data.message;
  },
};
