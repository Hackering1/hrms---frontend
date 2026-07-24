import { NavLink, useLocation } from "react-router-dom";
import { moduleForPath } from "../utils/modules";
import { useAuthStore } from "../store/authStore";

/**
 * Horizontal sub-navigation. Shows the pages of the currently active module.
 * Hidden when the active module has only one page (nothing to switch between).
 */
export default function SubNav() {
  const roles = useAuthStore((s) => s.roles) ?? [];
  const { pathname } = useLocation();
  const mod = moduleForPath(pathname, roles);

  if (!mod || mod.pages.length <= 1) return null;

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <span className="mr-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        {mod.label} ·
      </span>
      {mod.pages.map((p) => (
        <NavLink
          key={p.path}
          to={p.path}
          className={({ isActive }) =>
            `shrink-0 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
              isActive
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`
          }
          end
        >
          {p.label}
        </NavLink>
      ))}
    </div>
  );
}
