import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarCheck,
  FileText,
  Building2,
  UsersRound,
  BarChart3,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export const HR = ["SUPER_ADMIN", "HR_ADMIN", "HR_EXECUTIVE"];
export const MANAGER_PLUS = [...HR, "MANAGER"];
export const ALL: string[] | undefined = undefined;
export const SUPER_ADMIN_ONLY = ["SUPER_ADMIN"];

export interface SubPage {
  label: string;
  path: string;
  roles?: string[];
}
export interface Module {
  key: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  pages: SubPage[];
}

/**
 * Two-level nav map. Personal items (My Profile, Settings, Notifications) live in
 * the TopBar profile menu — NOT here — so the sidebar stays role-appropriate.
 *
 * Visibility by role:
 *  - Employee: Home, Time & Attendance, Leave, Documents, Reports
 *  - Manager: + Regularization, My Team
 *  - HR/Super Admin: + People, Letters, Organization, Admin
 */
export const MODULES: Module[] = [
  {
    key: "home",
    label: "Home",
    icon: LayoutDashboard,
    pages: [{ label: "Dashboard", path: "/dashboard" }],
  },
  {
    key: "people",
    label: "People",
    icon: Users,
    roles: MANAGER_PLUS,
    pages: [
      { label: "All Employees", path: "/employees", roles: MANAGER_PLUS },
      {
        label: "Invite Employee",
        path: "/employees/invite",
        roles: SUPER_ADMIN_ONLY,
      },
      {
        label: "Invitations",
        path: "/employees/invitations",
        roles: SUPER_ADMIN_ONLY,
      },
      {
        label: "Pending Profiles",
        path: "/employees/pending",
        roles: SUPER_ADMIN_ONLY,
      },
      { label: "Documents", path: "/documents/employee" },
      {
        label: "Categories",
        path: "/documents/categories",
        roles: MANAGER_PLUS,
      },
    ],
  },
  {
    key: "attendance",
    label: "Time & Attendance",
    icon: CalendarClock,
    pages: [
      { label: "Attendance", path: "/attendance" },
      { label: "Holidays", path: "/organization/holidays" },
      { label: "Calendar", path: "/organization/calendar" },
      { label: "Shifts", path: "/organization/shifts", roles: MANAGER_PLUS },
    ],
  },
  {
    key: "leave",
    label: "Leave",
    icon: CalendarCheck,
    pages: [
      { label: "Leave", path: "/leave" },
      { label: "Types", path: "/leave/types", roles: MANAGER_PLUS },
    ],
  },
  {
    key: "regularization",
    label: "Regularization",
    icon: CalendarClock,
    roles: MANAGER_PLUS,
    pages: [
      { label: "Regularization", path: "/regularization", roles: MANAGER_PLUS },
    ],
  },
  {
    key: "team",
    label: "My Team",
    icon: UsersRound,
    roles: ["MANAGER"], // managers only; admins use People + Admin instead
    pages: [
      { label: "Manager Portal", path: "/manager", roles: ["MANAGER"] },
      // Mgr #6: managers run HR operations (onboarding/probation/exit) for their team.
      { label: "HR Operations", path: "/hr-operations", roles: ["MANAGER"] },
    ],
  },
  {
    key: "letters",
    label: "Letters",
    icon: FileText,
    roles: MANAGER_PLUS,
    pages: [
      // Primary: the official letterhead-PDF generator (Offer/Appointment/Relieving/Experience).
      {
        label: "Generate Letter",
        path: "/letters/formatted",
        roles: MANAGER_PLUS,
      },
      // Secondary: ad-hoc text templates (warning, confirmation, etc.).
      { label: "Templates", path: "/letters/templates", roles: MANAGER_PLUS },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    icon: Building2,
    roles: MANAGER_PLUS,
    pages: [
      {
        label: "Branches",
        path: "/organization/branches",
        roles: MANAGER_PLUS,
      },
      {
        label: "Departments",
        path: "/organization/departments",
        roles: MANAGER_PLUS,
      },
      {
        label: "Designations",
        path: "/organization/designations",
        roles: MANAGER_PLUS,
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    pages: [{ label: "Reports", path: "/reports" }],
  },
  {
    key: "admin",
    label: "Admin",
    icon: Settings2,
    roles: HR, // HR / Super Admin only — NOT managers, NOT employees
    pages: [
      { label: "Manager Portal", path: "/manager", roles: HR },
      { label: "HR Operations", path: "/hr-operations", roles: HR },
      { label: "Tickets", path: "/tickets", roles: HR },
    ],
  },
];

const canSee = (roles: string[] | undefined, userRoles: string[]) =>
  !roles || roles.some((r) => userRoles.includes(r));

export function visibleModules(userRoles: string[]): Module[] {
  return MODULES.filter((m) => canSee(m.roles, userRoles))
    .map((m) => ({
      ...m,
      pages: m.pages.filter((p) => canSee(p.roles, userRoles)),
    }))
    .filter((m) => m.pages.length > 0);
}

export function moduleForPath(
  path: string,
  userRoles: string[],
): Module | undefined {
  const mods = visibleModules(userRoles);
  let best: { mod: Module; len: number } | undefined;
  for (const m of mods) {
    for (const p of m.pages) {
      if (path === p.path || path.startsWith(p.path + "/")) {
        if (!best || p.path.length > best.len)
          best = { mod: m, len: p.path.length };
      }
    }
  }
  return best?.mod;
}
