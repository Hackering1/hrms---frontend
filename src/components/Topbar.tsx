import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function TopBar({ onMenu }: { onMenu?: () => void }) {
  const email = useAuthStore((s) => s.email) ?? "";
  const roles = useAuthStore((s) => s.roles) ?? [];
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = email.slice(0, 2).toUpperCase();
  const roleLabel = roles[0]?.replace(/_/g, " ").toLowerCase() ?? "";

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-2 text-[13px] text-[var(--text-muted)] sm:flex sm:w-[280px]">
          <Search size={15} />
          <span>Search people, tasks, reports…</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent)]" />
        </button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[var(--surface-2)]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
              {initials}
            </div>
            <ChevronDown size={14} className="text-[var(--text-muted)]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow)]">
              <div className="border-b border-[var(--border)] px-4 py-2.5">
                <div className="truncate text-[13px] font-medium text-[var(--text)]">
                  {email}
                </div>
                <div className="text-[11px] capitalize text-[var(--text-muted)]">
                  {roleLabel}
                </div>
              </div>
              <MenuItem
                icon={<User size={15} />}
                label="My Profile"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/my-profile");
                }}
              />
              <MenuItem
                icon={<Settings size={15} />}
                label="Settings"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
              />
              <div className="my-1 border-t border-[var(--border)]" />
              <MenuItem
                icon={<LogOut size={15} />}
                label="Log out"
                onClick={logout}
                danger
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] ${danger ? "text-rose-600" : "text-[var(--text-secondary)]"}`}
    >
      {icon}
      {label}
    </button>
  );
}
