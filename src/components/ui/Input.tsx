import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  ...rest
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[var(--fs-base)] font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <input
        className={`min-h-[38px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fs-base)] text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-ring)] ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
