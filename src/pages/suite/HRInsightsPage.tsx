import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { resourceService } from "../../services/resourceService";

type RecordItem = { title: string; status: string; startDate?: string; endDate?: string; amount?: number; minutes?: number };
const feeds = ["payroll", "tasks", "timesheets", "assets", "performance"] as const;

export default function HRInsightsPage() {
  const queries = useQueries({ queries: feeds.map((module) => ({
    queryKey: ["suite", module],
    queryFn: () => resourceService.list(`/hr-suite/${module}`) as Promise<RecordItem[]>,
  })) });
  const records = Object.fromEntries(feeds.map((module, index) => [module, queries[index].data ?? []])) as Record<(typeof feeds)[number], RecordItem[]>;
  const busy = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);
  const signals = [
    { title: "Payroll review", detail: `${records.payroll.filter((r) => !["PAID", "APPROVED"].includes(r.status)).length} payroll records need review.`, href: "/payroll", action: "Open payroll" },
    { title: "Overdue tasks", detail: `${records.tasks.filter((r) => r.startDate && r.startDate < new Date().toISOString().slice(0, 10) && !["DONE", "CANCELLED"].includes(r.status)).length} tasks are past their due date.`, href: "/tasks", action: "Review tasks" },
    { title: "Timesheet approvals", detail: `${records.timesheets.filter((r) => !["APPROVED", "PAID"].includes(r.status)).length} timesheets are not approved.`, href: "/timesheets", action: "Review timesheets" },
    { title: "Asset return dates", detail: `${records.assets.filter((r) => r.endDate && r.endDate < new Date().toISOString().slice(0, 10) && !["RETURNED", "CANCELLED"].includes(r.status)).length} assets have passed their planned return date.`, href: "/assets", action: "Open assets" },
    { title: "Performance reviews", detail: `${records.performance.filter((r) => !["DONE", "APPROVED"].includes(r.status)).length} review records remain open.`, href: "/performance", action: "Open reviews" },
  ];

  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-6 text-white">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-100"><Sparkles size={17} /> HR insights</div>
      <h1 className="mt-2 text-2xl font-bold">Automated workflow signals</h1>
      <p className="mt-2 max-w-2xl text-sm text-indigo-100">Highlights calculated from your HRMS records to surface follow-ups. These are transparent rule-based signals; no employee decisions are made automatically.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2">
    {failed && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Some HR data could not be loaded. Counts below are unavailable until every source responds.</div>}
    {signals.map((item) => <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">{item.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{busy ? "Loading current records…" : failed ? "Data unavailable" : item.detail}</p>
        <Link to={item.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">{item.action}<ArrowRight size={15} /></Link>
      </article>)}
    </section>
  </div>;
}
