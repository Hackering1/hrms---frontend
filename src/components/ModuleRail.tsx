import { NavLink, useLocation } from "react-router-dom";
import { visibleModules, moduleForPath } from "../utils/modules";
import { useAuthStore } from "../store/authStore";
import logo from "../assets/logo.jpg";

/**
 * Vertical module rail (dark). Shows top-level MODULES. Clicking a module
 * navigates to its first (landing) page. The active module is highlighted based
 * on the current path, so it stays lit while you move between its sub-pages.
 */
export default function ModuleRail({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const roles = useAuthStore((s) => s.roles) ?? [];
  const { pathname } = useLocation();
  const mods = visibleModules(roles);
  const active = moduleForPath(pathname, roles);

  return (
    <aside
      className="flex h-full w-[210px] shrink-0 flex-col text-[var(--nav-text)]"
      style={{ background: "var(--nav-bg)" }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img
            src={logo}
            alt="TechNext"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white">TechNext</div>
          <div className="text-[10px] text-[var(--nav-muted)]">HRMS Portal</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        <div className="px-2 pb-1 pt-2 text-[10px] font-medium tracking-wider text-[var(--nav-muted)]">
          MODULES
        </div>
        {mods.map((m) => {
          const Icon = m.icon;
          const isActive = active?.key === m.key;
          const to = m.pages[0].path;
          return (
            <NavLink
              key={m.key}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-[var(--nav-text)] hover:bg-white/5 hover:text-white"
              }`}
              style={{
                ...(isActive ? { background: "var(--nav-active-bg)" } : {}),
                borderLeft: isActive
                  ? "3px solid var(--accent)"
                  : "3px solid transparent",
              }}
            >
              <Icon
                size={17}
                style={isActive ? { color: "var(--accent)" } : undefined}
              />
              {m.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
