import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/**
 * Role-based route guard (defense in depth).
 *
 * The sidebar already HIDES modules a role shouldn't see (see utils/modules.ts),
 * but hiding a menu item is not access control: a user could still type the URL
 * directly. This guard blocks that — if the logged-in user holds none of the
 * `allow` roles, they're bounced back to the dashboard instead of rendering a
 * page they aren't meant to reach.
 *
 * Note: this is the CLIENT-side half. The real security boundary is the backend
 * @PreAuthorize / CurrentUserService scoping — this just keeps the UI honest and
 * gives a clean redirect instead of a wall of 403s.
 *
 * Usage (in AppRoutes):
 *   <Route element={<RoleRoute allow={MANAGER_PLUS} />}>
 *     <Route path="/employees" element={<EmployeesPage />} />
 *   </Route>
 */
export default function RoleRoute({ allow }: { allow: string[] }) {
  const roles = useAuthStore((s) => s.roles) ?? [];
  const permitted = roles.some((r) => allow.includes(r));
  return permitted ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
