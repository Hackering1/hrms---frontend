import type { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

function crumbs(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      seg.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    );
}

/**
 * Consistent page header used across every page: breadcrumb + title + optional
 * subtitle + optional action button (top-right). Responsive: on small screens
 * the action drops below the title.
 */
export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { pathname } = useLocation();
  const parts = crumbs(pathname);

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div>
        <nav className="mb-1.5 flex items-center gap-1 text-xs text-[var(--text-faint)]">
          <Link to="/dashboard" className="hover:text-[var(--text-secondary)]">
            Home
          </Link>
          {parts.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={12} />
              <span
                className={
                  i === parts.length - 1
                    ? "font-medium text-[var(--text-secondary)]"
                    : ""
                }
              >
                {p}
              </span>
            </span>
          ))}
        </nav>
        <h1 className="font-display text-[var(--fs-xl)] font-bold text-[var(--text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[var(--fs-base)] text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
