import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/**
 * Blocks access to app pages unless the user is logged in.
 * Everyone who isn't logged in gets sent to /login, and after logging in
 * lands on Home — by design, we don't return them to whichever page they
 * originally tried to open (see LoginPage).
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
