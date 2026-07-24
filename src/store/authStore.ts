import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  roles: string[];
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  setAuth: (data: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    roles: string[];
    mustChangePassword?: boolean;
  }) => void;
  setAccessToken: (token: string) => void;
  clearMustChange: () => void;
  clearAuth: () => void;
}

// Zustand store, persisted to localStorage so a page refresh keeps you logged in.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      accessToken: null,
      refreshToken: null,
      email: null,
      roles: [],
      isAuthenticated: false,
      mustChangePassword: false,
      setAuth: (data) =>
        set({
          userId: data.userId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          email: data.email,
          roles: data.roles,
          isAuthenticated: true,
          mustChangePassword: !!data.mustChangePassword,
        }),
      setAccessToken: (token) => set({ accessToken: token }),
      clearMustChange: () => set({ mustChangePassword: false }),
      clearAuth: () =>
        set({
          userId: null,
          accessToken: null,
          refreshToken: null,
          email: null,
          roles: [],
          isAuthenticated: false,
          mustChangePassword: false,
        }),
    }),
    { name: "hrms-auth" },
  ),
);
