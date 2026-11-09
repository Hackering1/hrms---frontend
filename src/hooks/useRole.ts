import { useAuthStore } from "../store/authStore";

// Central place to ask "what can this user do?"
// NOTE: this portal uses only three roles — SUPER_ADMIN, MANAGER, EMPLOYEE.
export function useRole() {
  const roles = useAuthStore((s) => s.roles) ?? [];

  const has = (...r: string[]) => r.some((x) => roles.includes(x));

  const isSuperAdmin = has("ROLE_SUPER_ADMIN", "SUPER_ADMIN");
  const isHrAdmin = has("ROLE_HR_ADMIN", "HR_ADMIN");
  const isHrExec = has("ROLE_HR_EXECUTIVE", "HR_EXECUTIVE");
  const isManager = has("ROLE_MANAGER", "MANAGER");
  const isEmployee = has("ROLE_EMPLOYEE", "EMPLOYEE");

  // "HR-level" = super admin (HR_ADMIN / HR_EXECUTIVE are unused in this portal,
  // but kept here so any legacy checks still resolve correctly).
  const isHr = isSuperAdmin || isHrAdmin || isHrExec;

  return {
    roles,
    isSuperAdmin,
    isHrAdmin,
    isHrExec,
    isManager,
    isEmployee,
    isHr,
    // Master data (branches, departments, designations, shifts, leave types,
    // employees): Super Admin + Manager (matches backend @PreAuthorize).
    canManage: isSuperAdmin || isManager,
    // Leave approval is MANAGER-ONLY (matches backend on
    // PUT /api/leave-requests/{id}/decision).
    canApprove: isManager,
  };
}
