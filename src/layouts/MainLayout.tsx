import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import ModuleRail from "../components/ModuleRail";
import SubNav from "../components/SubNav";
import AppTopBar from "../components/AppTopBar";
import { useAuthStore } from "../store/authStore";

/**
 * App shell: vertical module rail + top bar + contextual sub-nav + page outlet.
 * Responsive: on < lg the rail becomes a slide-in drawer opened from the TopBar.
 */
export default function MainLayout() {
  const mustChange = useAuthStore((s) => s.mustChangePassword);
  const dismiss = useAuthStore((s) => s.clearMustChange);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Desktop rail */}
      <div className="hidden lg:block">
        <ModuleRail />
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <ModuleRail onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopBar onMenu={() => setDrawer(true)} />
        <SubNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {mustChange && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="flex items-center gap-2">
                <AlertTriangle size={18} />
                You're using a default password. Please change it in{" "}
                <Link to="/settings" className="font-semibold underline">
                  Settings
                </Link>
                .
              </span>
              <button
                onClick={dismiss}
                title="Dismiss"
                className="rounded p-1 text-amber-600 hover:bg-amber-100"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="animate-fade-up mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
