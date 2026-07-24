import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: ReactNode;
}

const styles: Record<string, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-accent)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)]",
  secondary:
    "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-2)]",
  danger: "bg-rose-600 text-white shadow-[var(--shadow-sm)] hover:bg-rose-700",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
};

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-[var(--fs-base)] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
