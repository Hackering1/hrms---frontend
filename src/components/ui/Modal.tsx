import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/**
 * Accessible modal: Escape to close, click-outside to close, scroll-locked body.
 * Uses design tokens; responsive width (full on mobile, capped on desktop).
 */
export default function Modal({ open, title, onClose, children, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-up"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} flex-col rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h3 className="font-display text-[var(--fs-md)] font-semibold text-[var(--text)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
