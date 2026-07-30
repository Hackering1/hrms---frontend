import {
  LayoutDashboard,
  Bell,
  UserCircle,
  UsersRound,
  BarChart3,
  Users,
  CalendarClock,
  CalendarCheck,
  FileText,
  FolderTree,
  UserCog,
  FileSignature,
  Files,
  Building2,
  Network,
  BriefcaseBusiness,
  Clock,
  CalendarDays,
  Settings,
  Ticket,
  UserPlus,
  MailCheck,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

// Role groups
export const HR = ["SUPER_ADMIN", "HR_ADMIN", "HR_EXECUTIVE"];
export const MANAGER_PLUS = [...HR, "MANAGER"]; // manager + all HR
export const ALL = undefined; // everyone signed in
export const EMPLOYEE_ONLY = ["EMPLOYEE"]; // employees only (hidden from managers/admins)
export const SUPER_ADMIN_ONLY = ["SUPER_ADMIN"]; // super admin only

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: string[]; // who can see it; undefined = everyone
}

export const NAV_ITEMS: NavItem[] = [
  // Everyone (employee, manager, HR)
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ALL },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ALL },
  { label: "My Profile", path: "/my-profile", icon: UserCircle, roles: ALL },
  {
    label: "My Organization",
    path: "/my-organization",
    icon: Building2,
    roles: EMPLOYEE_ONLY,
  },
  {
    label: "Leave Management",
    path: "/leave",
    icon: CalendarCheck,
    roles: ALL,
  },
  {
    label: "Regularization",
    path: "/regularization",
    icon: CalendarClock,
    roles: MANAGER_PLUS,
  },
  {
    label: "Employee Documents",
    path: "/documents/employee",
    icon: FileText,
    roles: ALL,
  },
  {
    label: "Holidays",
    path: "/organization/holidays",
    icon: CalendarDays,
    roles: ALL,
  },
  {
    label: "Company Calendar",
    path: "/organization/calendar",
    icon: CalendarDays,
    roles: ALL,
  },

  // Reports — everyone (employees see their own leave charts;
  // managers/HR see the company-wide report). Page handles the split.
  { label: "Reports", path: "/reports", icon: BarChart3, roles: ALL },

  // Manager + HR — the Manager Portal also handles assigning employees to a
  // manager (via "Add Team Member"), so a separate Team Assignment page is no
  // longer needed.
  {
    label: "Manager Portal",
    path: "/manager",
    icon: UsersRound,
    roles: MANAGER_PLUS,
  },
  // Everyone (employees check in/out; managers/HR also manage)
  { label: "Attendance", path: "/attendance", icon: CalendarClock, roles: ALL },
  {
    label: "Document Categories",
    path: "/documents/categories",
    icon: FolderTree,
    roles: MANAGER_PLUS,
  },
  {
    label: "HR Operations",
    path: "/hr-operations",
    icon: UserCog,
    roles: MANAGER_PLUS,
  },
  {
    label: "Generate Letters",
    path: "/letters/generate",
    icon: FileSignature,
    roles: MANAGER_PLUS,
  },
  {
    label: "Formatted Letters (PDF)",
    path: "/letters/formatted",
    icon: FileSignature,
    roles: MANAGER_PLUS,
  },
  {
    label: "Letter Templates",
    path: "/letters/templates",
    icon: Files,
    roles: MANAGER_PLUS,
  },
  {
    label: "Branches",
    path: "/organization/branches",
    icon: Building2,
    roles: MANAGER_PLUS,
  },
  {
    label: "Departments",
    path: "/organization/departments",
    icon: Network,
    roles: MANAGER_PLUS,
  },
  {
    label: "Designations",
    path: "/organization/designations",
    icon: BriefcaseBusiness,
    roles: MANAGER_PLUS,
  },
  {
    label: "Shifts",
    path: "/organization/shifts",
    icon: Clock,
    roles: MANAGER_PLUS,
  },

  // HR / admin / manager (managers can view and edit employees)
  { label: "Employees", path: "/employees", icon: Users, roles: MANAGER_PLUS },

  // Super Admin only — Managers and Employees must never see these (spec:
  // only the Super Admin may onboard new employees).
  {
    label: "Invite Employee",
    path: "/employees/invite",
    icon: UserPlus,
    roles: SUPER_ADMIN_ONLY,
  },
  {
    label: "Invitations",
    path: "/employees/invitations",
    icon: MailCheck,
    roles: SUPER_ADMIN_ONLY,
  },
  {
    label: "Pending Profiles",
    path: "/employees/pending",
    icon: Hourglass,
    roles: SUPER_ADMIN_ONLY,
  },

  // Everyone (admins also get Users management inside)
  { label: "Tickets", path: "/tickets", icon: Ticket, roles: ALL },
  { label: "Settings", path: "/settings", icon: Settings, roles: ALL },
];

// Filter nav items by the user's roles
export function visibleNavItems(userRoles: string[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => userRoles.includes(r)),
  );
}
