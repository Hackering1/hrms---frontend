import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../utils/navigation";
import { useAuthStore } from "../store/authStore";
import { roleAccent } from "../utils/roleAccent";
import logo from "../assets/logo.jpg";

// Group headers + which paths belong to each. Any allowed item whose path is
// NOT listed here automatically falls into the "More" group, so nothing is ever
// silently dropped when a new menu item is added.
const GROUPS: { heading: string; paths: string[] }[] = [
  { heading: "", paths: ["/dashboard"] },
  {
    heading: "Workspace",
    paths: ["/notifications", "/my-profile", "/manager", "/reports"],
  },
  {
    heading: "People",
    paths: ["/employees", "/attendance", "/leave"],
  },
  {
    heading: "Records",
    paths: [
      "/documents/employee",
      "/documents/categories",
      "/hr-operations",
      "/letters/generate",
      "/letters/formatted",
      "/letters/templates",
    ],
  },
  {
    heading: "Organization",
    paths: [
      "/organization/branches",
      "/organization/departments",
      "/organization/designations",
      "/organization/shifts",
      "/organization/holidays",
      "/organization/calendar",
    ],
  },
  {
    heading: "",
    paths: ["/settings"],
  },
];

export default function Sidebar() {
  const roles = useAuthStore((s) => s.roles) ?? [];
  const accent = roleAccent(roles);

  const allowed = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
  );

  const grouped = GROUPS.map((g) => ({
    heading: g.heading,
    items: g.paths
      .map((p) => allowed.find((i) => i.path === p))
      .filter(Boolean) as typeof allowed,
  }));

  // catch-all: any allowed item not placed in a group above
  const placedPaths = new Set(GROUPS.flatMap((g) => g.paths));
  const leftovers = allowed.filter((i) => !placedPaths.has(i.path));
  if (leftovers.length > 0) {
    grouped.push({ heading: "More", items: leftovers });
  }

  return (
    <aside
      className="flex h-screen w-60 flex-col border-r border-white/10 text-slate-300"
      style={{ background: "linear-gradient(180deg,#0B1220,#0F172A)" }}
    >
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img
            src={logo}
            alt="TechNext"
            className="h-full w-full object-contain"
          />
        </div>
        <span className="truncate text-[15px] font-bold tracking-tight text-white">
          TechNext HRMS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {grouped.map((group, gi) => {
          if (group.items.length === 0) return null;
          return (
            <div key={gi} className="space-y-1">
              {group.heading && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.heading}
                </p>
              )}
              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg py-2 pl-3.5 pr-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white/[0.07] text-white"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active accent bar — flush to the item's left edge */}
                      {isActive && (
                        <span
                          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full"
                          style={{ background: accent.color }}
                        />
                      )}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon
                          size={18}
                          style={isActive ? { color: accent.color } : undefined}
                        />
                      </span>
                      <span className="flex-1 truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
