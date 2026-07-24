// Dependency-free chart components (pure SVG) — no recharts needed.

interface Slice {
  label: string;
  value: number;
  color: string;
}

// Harmonious, designed palette (indigo -> sky -> teal -> amber -> rose -> violet)
const PALETTE = [
  "#4F46E5",
  "#0EA5E9",
  "#14B8A6",
  "#F59E0B",
  "#F43F5E",
  "#8B5CF6",
  "#10B981",
  "#6366F1",
  "#EC4899",
  "#0D9488",
];

export function pickColor(i: number) {
  return PALETTE[i % PALETTE.length];
}

/* Donut chart: shows proportion of values. */
export function DonutChart({
  data,
  size = 180,
}: {
  data: Slice[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2;
  const stroke = size * 0.18;
  const inner = radius - stroke / 2;
  const circ = 2 * Math.PI * inner;

  if (total <= 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400">
        No data to chart.
      </div>
    );
  }

  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circ;
            const seg = (
              <circle
                key={i}
                cx={radius}
                cy={radius}
                r={inner}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text
          x={radius}
          y={radius - 4}
          textAnchor="middle"
          className="fill-slate-800"
          fontSize={size * 0.16}
          fontWeight={700}
        >
          {total}
        </text>
        <text
          x={radius}
          y={radius + 16}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize={size * 0.08}
        >
          total
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: d.color }}
            />
            <span className="text-slate-700">{d.label}</span>
            <span className="text-slate-400">— {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Horizontal bars: compares allocated vs used per leave type. */
export function GroupedBars({
  rows,
}: {
  rows: { label: string; allocated: number; used: number; remaining: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.allocated));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="font-medium">{r.label}</span>
            <span>
              {r.used} used / {r.allocated} allocated · {r.remaining} left
            </span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded bg-slate-100">
            <div
              className="flex h-full"
              style={{ width: `${(r.allocated / max) * 100}%` }}
            >
              <div
                className="h-full bg-rose-400"
                style={{
                  width: `${(r.used / Math.max(1, r.allocated)) * 100}%`,
                }}
                title={`Used: ${r.used}`}
              />
              <div
                className="h-full bg-emerald-400"
                title={`Remaining: ${r.remaining}`}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-rose-400" /> Used
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400" />{" "}
          Remaining
        </span>
      </div>
    </div>
  );
}
