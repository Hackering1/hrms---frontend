const MAP: Record<string, string> = {
  // success (green)
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  // warning (amber)
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  PROBATION: "bg-amber-50 text-amber-700 ring-amber-200",
  ON_LEAVE: "bg-amber-50 text-amber-700 ring-amber-200",
  // danger (rose)
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  INACTIVE: "bg-rose-50 text-rose-700 ring-rose-200",
  ABSENT: "bg-rose-50 text-rose-700 ring-rose-200",
  EXITED: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
  // info (teal — matches app accent)
  DRAFT: "bg-teal-50 text-teal-700 ring-teal-200",
  SUBMITTED: "bg-teal-50 text-teal-700 ring-teal-200",
  IN_PROGRESS: "bg-teal-50 text-teal-700 ring-teal-200",
};

export default function StatusBadge({ value }: { value: string }) {
  const key = String(value).toUpperCase().replace(/\s+/g, "_");
  const cls = MAP[key] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {String(value).replace(/_/g, " ")}
    </span>
  );
}
