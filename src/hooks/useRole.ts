import { useAuthStore } from "../store/authStore";

// Central place to ask "what can this user do?" Accept prefixed and plain roles.
export function useRole() {
  const roles = useAuthStore((s) => s.roles) ?? [];

  const has = (...r: string[]) => r.some((x) => roles.includes(x));

  const isSuperAdmin = has("ROLE_SUPER_ADMIN", "SUPER_ADMIN");
  const isHrAdmin = has("ROLE_HR_ADMIN", "HR_ADMIN");
  const isHrExec = has("ROLE_HR_EXECUTIVE", "HR_EXECUTIVE");
  const isFinance = has("ROLE_FINANCE_ADMIN", "FINANCE_ADMIN");
  const isManager = has("ROLE_MANAGER", "MANAGER") || isFinance;
  const isEmployee = has("ROLE_EMPLOYEE", "EMPLOYEE");

  // Finance Admin is the organization-wide admin; HR roles remain available
  // for scoped HR teams.
  const isHr = isSuperAdmin || isHrAdmin || isHrExec || isFinance;

  return {
    roles,
    isSuperAdmin,
    isHrAdmin,
    isHrExec,
    isManager,
    isEmployee,
    isHr,
    isFinance,
    isPayrollAdmin: isSuperAdmin || isFinance,
    // Organization administration is available to Finance Admin, Super Admin,
    // HR and managers; backend scope checks protect team and employee records.
    canManage: isHr || isManager,
    // Leave approval is MANAGER-ONLY (matches backend on
    // PUT /api/leave-requests/{id}/decision).
    canApprove: isManager,
  };
}
