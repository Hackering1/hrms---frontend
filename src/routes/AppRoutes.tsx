import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import MainLayout from "../layouts/MainLayout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import EmployeesPage from "../pages/employee/EmployeesPage";
import AttendancePage from "../pages/attendance/AttendancePage";
import DocumentCategoriesPage from "../pages/documents/DocumentCategoriesPage";
import EmployeeDocumentsPage from "../pages/documents/EmployeeDocumentsPage";
import LeaveTypesPage from "../pages/leave/LeaveTypesPage";
import LeaveManagementPage from "../pages/leave/LeaveManagementPage";
import HrOperationsPage from "../pages/hrops/HrOperationsPage";
import LetterTemplatesPage from "../pages/letters/LetterTemplatesPage";
import GeneratedLettersPage from "../pages/letters/GeneratedLettersPage";
import FormattedLetterPage from "../pages/letters/FormattedLetterPage";
import NotificationsPage from "../pages/notifications/NotificationsPage";
import MyProfilePage from "../pages/self-service/MyProfilePage";
import ManagerPortalPage from "../pages/manager/ManagerPortalPage";
import RegularizationPage from "../pages/regularization/RegularizationPage";
import ReportsPage from "../pages/reports/ReportsPage";
import BranchesPage from "../pages/organization/BranchesPage";
import DepartmentsPage from "../pages/organization/DepartmentsPage";
import DesignationsPage from "../pages/organization/DesignationsPage";
import ShiftsPage from "../pages/organization/ShiftsPage";
import HolidaysPage from "../pages/organization/HolidaysPage";
import CompanyCalendarPage from "../pages/organization/CompanyCalendarPage";
import SettingsPage from "../pages/settings/SettingsPage";
import TicketsPage from "../pages/tickets/TicketsPage";
import MyOrganizationPage from "../pages/self-org/MyOrganizationPage";
import InviteEmployeePage from "../pages/employee/InviteEmployeePage";
import InvitationsPage from "../pages/employee/InvitationsPage";
import PendingProfilesPage from "../pages/employee/PendingProfilesPage";
import EmployeeOnboardingPage from "../pages/onboarding/EmployeeOnboardingPage";
import { useAuthStore } from "../store/authStore";

/**
 * Role groups — kept in lock-step with utils/modules.ts (the sidebar), so a
 * route requires exactly the roles its menu entry is shown to. Only three roles
 * are actually issued today (SUPER_ADMIN, MANAGER, EMPLOYEE); the HR_* names are
 * kept for forward-compat and simply match nobody until those logins exist.
 */
const HR = ["SUPER_ADMIN", "HR_ADMIN", "HR_EXECUTIVE"]; // effectively Super Admin today
const MANAGER_PLUS = [...HR, "MANAGER"];
const EMPLOYEE_ONLY = ["EMPLOYEE"];
const SUPER_ADMIN_ONLY = ["SUPER_ADMIN"];

export default function AppRoutes() {
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* PUBLIC — no login required. The candidate reaches this via the emailed
          invite link and has no account yet; the onboarding token in the URL
          query string is the only credential involved (validated server-side
          on every call). Deliberately a sibling of /login, NOT nested under
          ProtectedRoute. */}
      <Route path="/employee/onboarding" element={<EmployeeOnboardingPage />} />

      {/* Everything below requires authentication */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          {/* ---- Available to every signed-in user (Employee, Manager, Admin) ---- */}
          <Route
            path="/dashboard"
            element={
              // If mustChangePassword is set, force the user to /my-profile first.
              mustChangePassword ? (
                <Navigate to="/my-profile" replace />
              ) : (
                <DashboardPage />
              )
            }
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/my-profile" element={<MyProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leave" element={<LeaveManagementPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          {/* #5: My Documents must be reachable by employees too. The page
              self-scopes an employee to their own documents internally. */}
          <Route
            path="/documents/employee"
            element={<EmployeeDocumentsPage />}
          />
          <Route path="/organization/holidays" element={<HolidaysPage />} />
          <Route
            path="/organization/calendar"
            element={<CompanyCalendarPage />}
          />

          {/* ---- Employee self-service only (removed from the Manager Portal) ---- */}
          <Route element={<RoleRoute allow={EMPLOYEE_ONLY} />}>
            <Route path="/my-organization" element={<MyOrganizationPage />} />
          </Route>

          {/* ---- Manager + HR/Super Admin ---- */}
          <Route element={<RoleRoute allow={MANAGER_PLUS} />}>
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/manager" element={<ManagerPortalPage />} />
            <Route path="/regularization" element={<RegularizationPage />} />
            <Route path="/leave/types" element={<LeaveTypesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/documents/categories"
              element={<DocumentCategoriesPage />}
            />
            <Route
              path="/letters/generate"
              element={<GeneratedLettersPage />}
            />
            <Route
              path="/letters/formatted"
              element={<FormattedLetterPage />}
            />
            <Route
              path="/letters/templates"
              element={<LetterTemplatesPage />}
            />
            <Route path="/organization/branches" element={<BranchesPage />} />
            <Route
              path="/organization/departments"
              element={<DepartmentsPage />}
            />
            <Route
              path="/organization/designations"
              element={<DesignationsPage />}
            />
            <Route path="/organization/shifts" element={<ShiftsPage />} />
            {/* Mgr #6: HR Operations is manager-capable (picker scopes to their team). */}
            <Route path="/hr-operations" element={<HrOperationsPage />} />
          </Route>

          {/* ---- HR / Super Admin only ---- */}
          <Route element={<RoleRoute allow={HR} />}>
            <Route path="/tickets" element={<TicketsPage />} />
          </Route>

          {/* ---- Super Admin only — Invite Employee flow. Managers and
              Employees must never reach these, even by typing the URL
              directly (RoleRoute enforces this; the backend @PreAuthorize
              on EmployeeInviteController is the real security boundary). ---- */}
          <Route element={<RoleRoute allow={SUPER_ADMIN_ONLY} />}>
            <Route path="/employees/invite" element={<InviteEmployeePage />} />
            <Route
              path="/employees/invitations"
              element={<InvitationsPage />}
            />
            <Route
              path="/employees/pending"
              element={<PendingProfilesPage />}
            />
          </Route>
        </Route>
      </Route>

      {/* Root + unknown URLs -> dashboard (which enforces the mustChange redirect) */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
