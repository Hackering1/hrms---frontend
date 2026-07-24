import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useRole } from "../hooks/useRole";
import { selfService } from "../services/selfService";
import { notificationService } from "../services/notificationService";
import AuthedImage from "./AuthedImage";

export default function AppTopBar({ onMenu }: { onMenu?: () => void }) {
  const email = useAuthStore((s) => s.email) ?? "";
  const roles = useAuthStore((s) => s.roles) ?? [];
  const userId = useAuthStore((s) => s.userId);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // #15: unread notification count for the bell badge. Polls periodically so
  // the count updates as new notifications arrive.
  const notifications = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => notificationService.getMyNotifications(),
    enabled: !!userId,
    refetchInterval: 60000,
  });
  const unreadCount = ((notifications.data ?? []) as any[]).filter(
    (n) => !n.isRead,
  ).length;
  const unreadLabel =
    unreadCount > 99
      ? "99+"
      : unreadCount < 10
        ? "0" + unreadCount
        : String(unreadCount);

  // Same ["me"] query key MyProfilePage uses — shares the cache, so this is
  // usually already loaded and doesn't cause an extra request.
  // #5: A Super Admin is a system/CEO account with no employee profile, so we
  // don't fetch /employees/me for them (it would 404) — they just show initials.
  const { isSuperAdmin } = useRole();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: !isSuperAdmin,
  });
  const photoUrl = me.data?.profilePhotoUrl;
  const photoFileId = photoUrl
    ? photoUrl.split("/").filter(Boolean).pop()
    : undefined;

  const [searchValue, setSearchValue] = useState("");
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigate(`/employees?q=${encodeURIComponent(q)}`);
  };

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
    queryClient.clear(); // prevent the next user from seeing this user's cached data
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
        <form
          onSubmit={submitSearch}
          className="hidden items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-2 text-[13px] text-[var(--text-muted)] sm:flex sm:w-[280px]"
        >
          <Search size={15} className="shrink-0" />
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search people…"
            className="w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/notifications")}
          className="relative rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-none text-white">
              {unreadLabel}
            </span>
          )}
        </button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[var(--surface-2)]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
              {photoFileId ? (
                <AuthedImage
                  fileId={photoFileId}
                  alt={email}
                  className="h-full w-full object-cover"
                  fallback={initials}
                />
              ) : (
                initials
              )}
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
              {!isSuperAdmin && (
                <MenuItem
                  icon={<User size={15} />}
                  label="My Profile"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/my-profile");
                  }}
                />
              )}
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
