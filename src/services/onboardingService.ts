import axios from "axios";
import type { ApiResponse } from "../utils/types";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

// A separate, bare axios instance — no auth interceptor, no token refresh,
// no dependency on authStore. The candidate filling this out has no account
// yet; the onboarding token in the URL is the only credential involved.
const publicClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

export interface OnboardingInfo {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentName: string | null;
  designationName: string | null;
  managerName: string | null;
  dateOfJoining: string | null;
  loginRole: string;
  minutesRemaining: number;
}

export interface InvalidInviteInfo {
  reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" | "CANCELLED";
  message: string;
}

export const onboardingService = {
  async getInfo(token: string): Promise<OnboardingInfo> {
    const { data } = await publicClient.get<ApiResponse<OnboardingInfo>>(
      `/public/onboarding/${encodeURIComponent(token)}`,
    );
    return data.data;
  },

  async uploadDocument(
    token: string,
    file: File,
  ): Promise<{ url: string; fileName: string }> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await publicClient.post<
      ApiResponse<{ url: string; fileName: string }>
    >(`/public/onboarding/${encodeURIComponent(token)}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async complete(token: string, body: Record<string, unknown>): Promise<void> {
    await publicClient.post(
      `/public/onboarding/${encodeURIComponent(token)}/complete`,
      body,
    );
  },
};

// Reads the typed {reason, message} out of an Axios error thrown by the calls
// above, for the "Invalid / Expired / Already Used" screen.
export function extractInviteError(err: unknown): InvalidInviteInfo {
  if (axios.isAxiosError(err) && err.response?.data) {
    const body = err.response.data as ApiResponse<{ reason?: string }>;
    const reason = (body.data?.reason ??
      "NOT_FOUND") as InvalidInviteInfo["reason"];
    return { reason, message: body.message ?? "This invitation is not valid." };
  }
  return { reason: "NOT_FOUND", message: "This invitation is not valid." };
}
