import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Table, Tag } from "antd";
import { Play, Square } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../../services/apiClient";
import { resourceService } from "../../services/resourceService";
import type { ApiResponse } from "../../utils/types";

type TimeRecord = { id: string; title: string; status: string; startDate?: string; endDate?: string; minutes?: number };
const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === "string" ? response.data.message : fallback;
};
export default function TimeTrackerPage() {
  const [title, setTitle] = useState("");
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["suite-time-tracking"], queryFn: () => resourceService.list("/hr-suite/time-tracking") as Promise<TimeRecord[]> });
  const active = records.data?.find((record) => record.status === "RUNNING");
  const refresh = () => qc.invalidateQueries({ queryKey: ["suite-time-tracking"] });
  const start = useMutation({ mutationFn: async () => (await apiClient.post<ApiResponse<TimeRecord>>("/hr-suite/time-tracking/start", { title })).data.data, onSuccess: async () => { setTitle(""); toast.success("Timer started"); await refresh(); }, onError: (error: unknown) => toast.error(errorMessage(error, "Could not start timer")) });
  const stop = useMutation({ mutationFn: async (id: string) => (await apiClient.post<ApiResponse<TimeRecord>>(`/hr-suite/time-tracking/${id}/stop`)).data.data, onSuccess: async () => { toast.success("Timer stopped and time saved"); await refresh(); }, onError: (error: unknown) => toast.error(errorMessage(error, "Could not stop timer")) });
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Time tracker</h1>
      <p className="mt-1 text-sm text-slate-600">Start one work-session timer at a time. The server calculates elapsed minutes when you stop it.</p>
      {active ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Timer running</div><div className="mt-1 font-semibold text-slate-900">{active.title}</div></div>
        <Button danger icon={<Square size={15} />} loading={stop.isPending} onClick={() => stop.mutate(active.id)}>Stop & save time</Button>
      </div> : <div className="mt-5 flex max-w-xl gap-2"><Input value={title} maxLength={180} placeholder="Project or activity" onChange={(event) => setTitle(event.target.value)} onPressEnter={() => title.trim() && start.mutate()} /><Button type="primary" icon={<Play size={15} />} loading={start.isPending} disabled={!title.trim()} onClick={() => start.mutate()}>Start timer</Button></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Recent work sessions</h2><Table rowKey="id" loading={records.isLoading} dataSource={records.data ?? []} pagination={{ pageSize: 10 }} columns={[{ title: "Activity", dataIndex: "title", key: "title" }, { title: "Started", dataIndex: "startDate", key: "startDate" }, { title: "Minutes", dataIndex: "minutes", key: "minutes", render: (value: number | undefined) => value ?? "—" }, { title: "Status", dataIndex: "status", key: "status", render: (value: string) => <Tag color={value === "RUNNING" ? "green" : "default"}>{value}</Tag> }]} /></section>
  </div>;
}
