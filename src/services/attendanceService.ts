import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface Attendance {
  id: number;
  employeeId: string;
  attendanceDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  workingHours?: number;
  isRegularized: boolean;
  remarks?: string;
  // NEW — populated by self-service check-in
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInPhotoId?: string;
  // NEW — populated by self-service check-out
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutPhotoId?: string;
}

export interface Regularization {
  id: number;
  employeeId: string;
  attendanceDate: string;
  requestedIn?: string;
  requestedOut?: string;
  reason: string;
  status: string;
  reviewedBy?: string;
  reviewerRemarks?: string;
  createdAt: string;
}

export const attendanceService = {
  /**
   * DEPRECATED for self-service: kept only for any internal/admin callers that
   * don't need location + photo. Self-service check-in must use checkInWithProof.
   * The backend now REQUIRES latitude/longitude/checkInPhotoId, so calling this
   * without them will 400.
   */
  async checkIn(employeeId: string): Promise<Attendance> {
    const { data } = await apiClient.post<ApiResponse<Attendance>>(
      "/attendance/check-in",
      { employeeId, ipAddress: "", deviceInfo: navigator.userAgent },
    );
    return data.data;
  },

  /**
   * NEW: Self-service check-in with required proof.
   * 1) Uploads the selfie to /api/files (multipart) -> gets a file id.
   * 2) POSTs /attendance/check-in with employeeId + latitude + longitude + checkInPhotoId.
   */
  async checkInWithProof(
    employeeId: string,
    latitude: number,
    longitude: number,
    photo: File,
  ): Promise<Attendance> {
    // Step 1: upload the photo (reuses the existing FileController.upload endpoint)
    const form = new FormData();
    form.append("file", photo);
    const uploadRes = await apiClient.post<ApiResponse<{ id: string }>>(
      "/files",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    const checkInPhotoId = uploadRes.data.data.id;

    // Step 2: check in with geo + photo id
    const { data } = await apiClient.post<ApiResponse<Attendance>>(
      "/attendance/check-in",
      {
        employeeId,
        ipAddress: "",
        deviceInfo: navigator.userAgent,
        latitude,
        longitude,
        checkInPhotoId,
      },
    );
    return data.data;
  },

  /**
   * DEPRECATED for self-service: kept only for any internal/admin callers that
   * don't need location + photo. Self-service check-out must use
   * checkOutWithProof. The backend now REQUIRES checkOutLatitude/
   * checkOutLongitude/checkOutPhotoId, so calling this without them will 400.
   */
  async checkOut(employeeId: string): Promise<Attendance> {
    const { data } = await apiClient.post<ApiResponse<Attendance>>(
      "/attendance/check-out",
      { employeeId, ipAddress: "", deviceInfo: navigator.userAgent },
    );
    return data.data;
  },

  /**
   * NEW: Self-service check-out with required proof (mirrors checkInWithProof).
   * 1) Uploads the selfie to /api/files (multipart) -> gets a file id.
   * 2) POSTs /attendance/check-out with employeeId + checkOutLatitude +
   *    checkOutLongitude + checkOutPhotoId.
   */
  async checkOutWithProof(
    employeeId: string,
    latitude: number,
    longitude: number,
    photo: File,
  ): Promise<Attendance> {
    const form = new FormData();
    form.append("file", photo);
    const uploadRes = await apiClient.post<ApiResponse<{ id: string }>>(
      "/files",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    const checkOutPhotoId = uploadRes.data.data.id;

    const { data } = await apiClient.post<ApiResponse<Attendance>>(
      "/attendance/check-out",
      {
        employeeId,
        ipAddress: "",
        deviceInfo: navigator.userAgent,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutPhotoId,
      },
    );
    return data.data;
  },

  async history(employeeId: string): Promise<Attendance[]> {
    const { data } = await apiClient.get<ApiResponse<Attendance[]>>(
      "/attendance/employee/" + employeeId,
    );
    return data.data;
  },

  async listRegularizations(): Promise<Regularization[]> {
    const { data } = await apiClient.get<ApiResponse<Regularization[]>>(
      "/attendance-regularizations",
    );
    return data.data;
  },

  /**
   * #4: the logged-in employee's OWN regularization requests (with status),
   * so they can see whether each was approved/rejected. Backed by
   * GET /attendance-regularizations/employee/{employeeId}.
   */
  async myRegularizations(employeeId: string): Promise<Regularization[]> {
    const { data } = await apiClient.get<ApiResponse<Regularization[]>>(
      "/attendance-regularizations/employee/" + employeeId,
    );
    return data.data;
  },

  async raiseRegularization(body: {
    employeeId: string;
    attendanceDate: string;
    requestedIn?: string | null;
    requestedOut?: string | null;
    reason: string;
  }): Promise<Regularization> {
    const { data } = await apiClient.post<ApiResponse<Regularization>>(
      "/attendance-regularizations",
      body,
    );
    return data.data;
  },

  async decideRegularization(
    id: number,
    status: "APPROVED" | "REJECTED",
    reviewerRemarks?: string,
  ): Promise<Regularization> {
    const { data } = await apiClient.put<ApiResponse<Regularization>>(
      "/attendance-regularizations/" + id + "/decision",
      { status, reviewerRemarks: reviewerRemarks ?? null },
    );
    return data.data;
  },

  async cancelRegularization(id: number): Promise<void> {
    await apiClient.delete("/attendance-regularizations/" + id + "/cancel");
  },

  // HR/Admin only — permanently removes the row (any status), unlike
  // cancelRegularization above which just flips PENDING -> CANCELLED.
  async deleteRegularizationPermanent(id: number): Promise<void> {
    await apiClient.delete("/attendance-regularizations/" + id);
  },

  async bulkMark(
    date: string,
    status: string,
    remarks: string,
    employeeIds: string[],
  ): Promise<number> {
    const { data } = await apiClient.post<ApiResponse<number>>(
      "/attendance/bulk",
      { date, status, remarks, employeeIds },
    );
    return data.data;
  },
};
