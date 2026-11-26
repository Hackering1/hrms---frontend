import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowRight, BadgeIndianRupee, BriefcaseBusiness, CalendarCheck2, ClipboardList, Laptop, Sparkles, Target } from "lucide-react";
import { resourceService } from "../../services/resourceService";

type RecordItem = { title: string; status: string; startDate?: string; endDate?: string; amount?: number; minutes?: number; createdAt?: string };
const feeds = ["payroll", "statutory", "tasks", "timesheets", "assets", "performance"] as const;
const doneStatuses = new Set(["APPROVED", "FILED", "PAID", "DONE", "RETURNED", "CANCELLED", "REJECTED"]);

export default function HRInsightsPage() {
  const queries = useQueries({ queries: feeds.map((module) => ({
    queryKey: ["hr-insights", module],
    queryFn: () => resourceService.list(`/hr-suite/${module}`) as Promise<RecordItem[]>,
    staleTime: 60_000,
  })) });
  const rows = Object.fromEntries(feeds.map((module, index) => [module, queries[index].data ?? []])) as Record<(typeof feeds)[number], RecordItem[]>;
  const today = dayjs().format("YYYY-MM-DD");
  const count = (module: (typeof feeds)[number]) => queries[feeds.indexOf(module)].isError ? null : rows[module].length;
  const followUps = [
    { title: "Payroll review", detail: `${rows.payroll.filter((r) => !["PAID", "APPROVED", "EMAIL_SENDING"].includes(r.status)).length} payroll records need review.`, href: "/payroll", action: "Review payroll", Icon: BadgeIndianRupee, color: "text-emerald-700 bg-emerald-50", module: "payroll" as const },
    { title: "Statutory filing register", detail: `${rows.statutory.filter((r) => !doneStatuses.has(r.status)).length} PF / ESI / PT records are not marked filed or complete.`, href: "/statutory", action: "Open filing register", Icon: CalendarCheck2, color: "text-blue-700 bg-blue-50", module: "statutory" as const },
    { title: "Overdue tasks", detail: `${rows.tasks.filter((r) => r.startDate && r.startDate < today && !["DONE", "CANCELLED"].includes(r.status)).length} tasks have passed their due date.`, href: "/tasks", action: "Review tasks", Icon: ClipboardList, color: "text-rose-700 bg-rose-50", module: "tasks" as const },
    { title: "Timesheet approvals", detail: `${rows.timesheets.filter((r) => !["APPROVED", "PAID", "REJECTED"].includes(r.status)).length} timesheets are awaiting a decision.`, href: "/timesheets", action: "Review timesheets", Icon: CalendarCheck2, color: "text-violet-700 bg-violet-50", module: "timesheets" as const },
    { title: "Asset returns", detail: `${rows.assets.filter((r) => r.endDate && r.endDate < today && !["RETURNED", "CANCELLED"].includes(r.status)).length} assets are past their planned return date.`, href: "/assets", action: "Open asset register", Icon: Laptop, color: "text-amber-700 bg-amber-50", module: "assets" as const },
    { title: "Performance reviews", detail: `${rows.performance.filter((r) => !["DONE", "APPROVED"].includes(r.status)).length} review records remain open.`, href: "/performance", action: "Open reviews", Icon: Target, color: "text-indigo-700 bg-indigo-50", module: "performance" as const },
  ];
  const metrics = [
    { label: "Payroll records", value: count("payroll"), Icon: BadgeIndianRupee },
    { label: "Statutory records", value: count("statutory"), Icon: CalendarCheck2 },
    { label: "Active tasks", value: queries[2].isError ? null : rows.tasks.filter((r) => !["DONE", "CANCELLED"].includes(r.status)).length, Icon: ClipboardList },
    { label: "Timesheets", value: count("timesheets"), Icon: BriefcaseBusiness },
    { label: "Assets tracked", value: count("assets"), Icon: Laptop },
    { label: "Review records", value: count("performance"), Icon: Target },
  ];

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-2xl bg-gradient-to-r from-indigo-800 to-violet-800 p-6 text-white shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-100"><Sparkles size={17} /> HR insights</div>
      <h1 className="mt-2 text-2xl font-bold">Operations overview</h1>
      <p className="mt-2 max-w-3xl text-sm text-indigo-100">A live view of follow-ups across payroll, statutory records, tasks, timesheets, assets, and performance reviews. Signals are transparent counts from HRMS records; they do not make employment decisions.</p>
      <p className="mt-3 text-xs text-indigo-200">Updated {dayjs().format("DD MMM YYYY, h:mm A")}</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, Icon }) => <article key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="rounded-lg bg-slate-100 p-3 text-slate-700"><Icon size={19} /></div><div><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-900">{value ?? "—"}</div></div></article>)}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4"><h2 className="font-semibold text-slate-900">Recommended follow-ups</h2><p className="mt-1 text-sm text-slate-500">Open a module to review and action the underlying records.</p></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {followUps.map(({ title, detail, href, action, Icon, color, module }) => {
          const query = queries[feeds.indexOf(module)];
          return <article key={title} className="rounded-xl border border-slate-200 p-4">
            <div className="flex gap-3"><div className={`h-fit rounded-lg p-2 ${color}`}><Icon size={18} /></div><div className="min-w-0"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{query.isLoading ? "Loading current records…" : query.isError ? "This module could not be loaded. Other insights remain available." : detail}</p><Link to={href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">{action}<ArrowRight size={15} /></Link></div></div>
          </article>;
        })}
      </div>
    </section>
  </div>;
}

