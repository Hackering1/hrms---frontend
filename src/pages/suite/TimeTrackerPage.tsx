import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Select, Table, Tag } from "antd";
import { Clock3, Play, Square, TimerReset } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../../services/apiClient";
import { resourceService } from "../../services/resourceService";
import type { ApiResponse } from "../../utils/types";

type TimeRecord = { id: string; title: string; category?: string; status: string; startDate?: string; endDate?: string; minutes?: number; createdAt?: string };
const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === "string" ? response.data.message : fallback;
};
const minsLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const startInstant = (record: TimeRecord) => record.createdAt ? new Date(record.createdAt).getTime() : NaN;
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function TimeTrackerPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("PROJECT_WORK");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [now, setNow] = useState(0);
  const qc = useQueryClient();
  const records = useQuery({
    queryKey: ["suite-time-tracking"],
    queryFn: () => resourceService.list("/hr-suite/time-tracking") as Promise<TimeRecord[]>,
    refetchInterval: 30_000,
  });
  const active = records.data?.find((record) => record.status === "RUNNING");
  const activeId = active?.id;
  useEffect(() => {
    if (!activeId) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeId]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["suite-time-tracking"] });
  const start = useMutation({
    mutationFn: async () => (await apiClient.post<ApiResponse<TimeRecord>>("/hr-suite/time-tracking/start", { title: title.trim(), category })).data.data,
    onSuccess: async () => { setTitle(""); toast.success("Timer started"); await refresh(); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not start timer")),
  });
  const stop = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<TimeRecord>>(`/hr-suite/time-tracking/${id}/stop`)).data.data,
    onSuccess: async () => { toast.success("Timer stopped and time saved"); await refresh(); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not stop timer")),
  });
  const all = useMemo(() => records.data ?? [], [records.data]);
  const today = localDateKey(new Date());
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartKey = localDateKey(weekStart);
  const todayRows = all.filter((record) => record.startDate === today && record.status === "STOPPED");
  const weekRows = all.filter((record) => record.startDate && record.startDate >= weekStartKey && record.status === "STOPPED");
  const filtered = useMemo(() => all.filter((record) =>
    (status === "ALL" || record.status === status)
    && (!search.trim() || record.title.toLowerCase().includes(search.trim().toLowerCase()))
  ), [all, search, status]);
  const liveMinutes = active ? Math.max(0, Math.floor((now - startInstant(active)) / 60_000)) : 0;
  const todayMinutes = todayRows.reduce((sum, record) => sum + (record.minutes ?? 0), 0) + (active?.startDate === today ? liveMinutes : 0);
  const weekMinutes = weekRows.reduce((sum, record) => sum + (record.minutes ?? 0), 0) + (active && active.startDate && active.startDate >= weekStartKey ? liveMinutes : 0);

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-100"><Clock3 size={17} /> Personal time tracking</div>
      <h1 className="mt-2 text-2xl font-bold">Time tracker</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-200">Track work sessions against projects or activities. You control when tracking starts and stops; completed sessions can be submitted in your weekly timesheet.</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <Metric title="Today" value={minsLabel(todayMinutes)} hint={`${todayRows.length + (active?.startDate === today ? 1 : 0)} sessions`} />
      <Metric title="This week" value={minsLabel(weekMinutes)} hint={`${weekRows.length} completed sessions`} />
      <Metric title="Timer" value={active ? minsLabel(liveMinutes) : "Stopped"} hint={active ? "Running now" : "Ready when you are"} active={Boolean(active)} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Work session</h2>
      {active ? <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Timer running · {active.startDate ?? "Today"}</div><div className="mt-1 text-lg font-semibold text-slate-900">{active.title}</div><div className="mt-1 font-mono text-2xl tabular-nums text-emerald-900">{minsLabel(liveMinutes)}</div></div>
        <Button danger size="large" icon={<Square size={15} />} loading={stop.isPending} onClick={() => stop.mutate(active.id)}>Stop & save time</Button>
      </div> : <div className="mt-4 flex max-w-2xl flex-wrap gap-2">
        <Input aria-label="Project or activity" value={title} maxLength={180} placeholder="Project or activity" onChange={(event) => setTitle(event.target.value)} onPressEnter={() => title.trim() && start.mutate()} />
        <Select aria-label="Work category" className="min-w-44" value={category} onChange={setCategory} options={[{ value: "PROJECT_WORK", label: "Project work" }, { value: "MEETING", label: "Meeting" }, { value: "TRAINING", label: "Training" }, { value: "ADMIN", label: "Admin work" }]} />
        <Button type="primary" icon={<Play size={15} />} loading={start.isPending} disabled={!title.trim()} onClick={() => start.mutate()}>Start timer</Button>
      </div>}
      <p className="mt-3 text-xs text-slate-500">One timer can run at a time. Time is calculated by the server when you stop the session.</p>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Session history</h2><p className="mt-1 text-sm text-slate-500">Search and review your recorded work before submitting a timesheet.</p></div><div className="flex flex-wrap gap-2"><Input allowClear value={search} placeholder="Search activity" onChange={(event) => setSearch(event.target.value)} className="w-52" /><Select value={status} onChange={setStatus} className="w-36" options={[{ value: "ALL", label: "All statuses" }, { value: "RUNNING", label: "Running" }, { value: "STOPPED", label: "Completed" }]} /></div></div>
      <Table rowKey="id" loading={records.isLoading} dataSource={filtered} pagination={{ pageSize: 10 }} locale={{ emptyText: records.isError ? "Could not load sessions. Refresh and try again." : "No matching work sessions." }} columns={[
        { title: "Project / activity", dataIndex: "title", key: "title" },
        { title: "Category", dataIndex: "category", key: "category", render: (value: string | undefined) => value?.replaceAll("_", " ") ?? "—" },
        { title: "Work date", dataIndex: "startDate", key: "startDate" },
        { title: "Duration", dataIndex: "minutes", key: "minutes", render: (value: number | undefined, row: TimeRecord) => row.status === "RUNNING" ? minsLabel(Math.max(0, Math.floor((now - startInstant(row)) / 60_000))) : value == null ? "—" : minsLabel(value) },
        { title: "Status", dataIndex: "status", key: "status", render: (value: string) => <Tag color={value === "RUNNING" ? "green" : "blue"}>{value === "STOPPED" ? "COMPLETED" : value}</Tag> },
      ]} />
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><TimerReset size={14} /> Completed sessions are available in Timesheets for the matching week.</div>
    </section>
  </div>;
}

function Metric({ title, value, hint, active = false }: { title: string; value: string; hint: string; active?: boolean }) {
  return <article className={`rounded-xl border p-4 ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="text-sm text-slate-500">{title}</div><div className="mt-1 text-2xl font-bold text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></article>;
}

