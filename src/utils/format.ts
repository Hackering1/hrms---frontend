const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // ISO date "2026-01-26" or full timestamp → "26 Jan 2026"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
  }

  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
