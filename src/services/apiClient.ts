import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import type { ApiResponse, AuthResponse } from "../utils/types";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // FIX: Add a default timeout so hung requests don't block the UI forever
  timeout: 30000,
});

// --- Request interceptor: attach the access token to every call ---
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: if a request 401s, try to refresh the token once ---
let isRefreshing = false;
let queue: ((token: string) => void)[] = [];

// FIX: Helper to flush the queue — used in both success and failure paths
function flushQueue(token: string | null) {
  if (token) {
    queue.forEach((cb) => cb(token));
  }
  queue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // FIX: Guard against missing config (can happen with network errors before
    //      the request is sent, e.g. DNS failure) to avoid a TypeError crash.
    if (!original) {
      return Promise.reject(error);
    }

    const store = useAuthStore.getState();

    // Don't try to refresh the refresh/login calls themselves.
    const isAuthCall = original?.url?.includes("/auth/");

    const status = error.response?.status;

    // FIX: Only intercept 401 for token refresh; 403 means the user IS
    //      authenticated but lacks permission — don't try to refresh for 403.
    if (status === 401 && !original._retry && !isAuthCall) {
      if (!store.refreshToken) {
        store.clearAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the in-flight refresh, then retry with the new token.
        return new Promise((resolve, reject) => {
          queue.push((token: string) => {
            if (!token) {
              reject(error);
              return;
            }
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<AuthResponse>>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken: store.refreshToken },
          { timeout: 10000 }, // FIX: separate timeout for token refresh
        );

        // FIX: Guard against malformed refresh response
        if (!data?.data?.accessToken) {
          throw new Error("Invalid refresh response");
        }

        const newAccess = data.data.accessToken;
        store.setAuth({
          userId: data.data.userId,
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
          email: data.data.email,
          roles: data.data.roles,
          mustChangePassword: data.data.mustChangePassword,
        });
        flushQueue(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      } catch (refreshError) {
        flushQueue(null); // FIX: reject all queued requests on failure
        store.clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
