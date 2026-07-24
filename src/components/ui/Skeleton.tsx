export function SkeletonTable({
  cols = 4,
  rows = 5,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 animate-pulse rounded bg-slate-100"
                style={{ animationDelay: `${(r * cols + c) * 40}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}
