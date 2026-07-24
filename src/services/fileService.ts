import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

export interface UploadedFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string; // e.g. "/api/files/{uuid}"
}

export const fileService = {
  // Upload a file into the database-backed storage. Returns its id + url.
  async upload(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<ApiResponse<UploadedFile>>(
      "/files",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return data.data;
  },

  // Build an absolute URL to a stored file. NOTE: opening this URL directly in the
  // browser will FAIL with 401, because a plain navigation doesn't send the JWT
  // Authorization header. Use openFile() below to view/download instead. Kept only
  // for display/reference.
  absoluteUrl(url?: string): string {
    if (!url) return "";
    const base = apiClient.defaults.baseURL ?? "";
    const root = base.replace(/\/api\/?$/, "");
    return url.startsWith("http") ? url : root + url;
  },

  /**
   * Open a protected file in a new tab WITH authentication.
   *
   * The file endpoint (/api/files/{id}) requires the JWT. A normal <a href> or
   * window.open sends no Authorization header, so the backend returns
   * "Unauthorized: Full authentication is required". This fetches the bytes
   * through the authenticated axios client, turns them into an object URL, and
   * opens THAT — which the browser can display without needing the header.
   *
   * @param fileUrl the stored url like "/api/files/{uuid}" (from d.fileUrl)
   */
  async openFile(fileUrl?: string): Promise<void> {
    if (!fileUrl) return;
    // Turn "/api/files/{id}" into the path apiClient expects ("/files/{id}"),
    // since apiClient.baseURL already ends with "/api".
    const path = fileUrl.replace(/^\/?api/, "");
    const res = await apiClient.get(path, { responseType: "blob" });
    const blob = res.data as Blob;
    const objectUrl = URL.createObjectURL(blob);
    // Open in a new tab. Revoke after a delay so the tab has time to load it.
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },
};
