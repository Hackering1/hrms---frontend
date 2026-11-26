import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Input, Modal, Select, Table, Tag } from "antd";
import { Download, Check, X, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import ResourcePage from "../../components/ResourcePage";
import { resourceService } from "../../services/resourceService";
import { apiClient } from "../../services/apiClient";
import { useRole } from "../../hooks/useRole";
import type { ApiResponse, FieldConfig, ResourceConfig } from "../../utils/types";
import type { ResourceRecord } from "../../utils/types";

type SuiteModule = "payroll" | "payslips" | "statutory" | "time-tracking" | "tasks" | "timesheets" | "performance" | "assets" | "monitoring";
export type EmployeeOption = { id: string; employeeCode: string; displayName: string };

const STATUS_OPTIONS = ["DRAFT", "SUBMITTED", "PENDING", "APPROVED", "PAID", "GENERATED", "CALCULATED", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ACTIVE", "INACTIVE", "RETURNED", "CONSENT_WITHDRAWN"].map((x) => ({ value: x, label: x.replaceAll("_", " ") }));
const moduleStatuses = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll("_", " ") }));

const MODULE_CONFIG: Record<SuiteModule, Omit<ResourceConfig, "fields"> & { fields: FieldConfig[]; employeeField?: boolean }> = {
  payroll: { title: "Payroll", endpoint: "/hr-suite/payroll", queryKey: "suite-payroll", adminOnly: true, readOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Payroll run" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Pay period" }, { key: "amount", label: "Net pay (₹)" }, { key: "status", label: "Status" }], fields: [] },
  payslips: { title: "Payslips", endpoint: "/hr-suite/payslips", queryKey: "suite-payslips", adminOnly: true, readOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Payslip" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Pay period" }, { key: "amount", label: "Net pay (₹)" }, { key: "status", label: "Status" }], fields: [] },
  statutory: { title: "PF, ESI & Professional Tax", endpoint: "/hr-suite/statutory", queryKey: "suite-statutory", payrollAdminOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Contribution / tax" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Period" }, { key: "amount", label: "Amount (₹)" }, { key: "startDate", label: "Filing due" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Contribution / tax type", type: "select", required: true, options: moduleStatuses(["PF", "ESI", "PT"]) }, { name: "employeeId", label: "Employee", type: "select", required: true }, { name: "period", label: "Period (YYYY-MM)", type: "text", required: true, placeholder: "2026-11" }, { name: "amount", label: "Contribution / tax amount (₹)", type: "number", required: true }, { name: "startDate", label: "Filing due date", type: "date" }, { name: "endDate", label: "Filed / paid date", type: "date" }, { name: "status", label: "Filing status", type: "select", options: moduleStatuses(["DRAFT", "READY_TO_FILE", "FILED", "PAID", "OVERDUE"]) }, { name: "details", label: "Challan / filing reference and notes", type: "textarea" }] },
  "time-tracking": { title: "Time Tracker", endpoint: "/hr-suite/time-tracking", queryKey: "suite-time-tracking", allowSelfService: true, disableDelete: true, columns: [{ key: "title", label: "Project / activity" }, { key: "startDate", label: "Work date" }, { key: "minutes", label: "Minutes" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Project / activity", type: "text", required: true }, { name: "startDate", label: "Work date", type: "date", required: true }, { name: "minutes", label: "Duration (minutes)", type: "number", required: true }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Notes", type: "textarea" }] },
  tasks: { title: "Tasks", endpoint: "/hr-suite/tasks", queryKey: "suite-tasks", allowSelfService: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Task" }, { key: "employeeLabel", label: "Assignee" }, { key: "category", label: "Project / category" }, { key: "priority", label: "Priority" }, { key: "startDate", label: "Due date" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Task", type: "text", required: true }, { name: "employeeId", label: "Assignee", type: "select" }, { name: "category", label: "Project / category", type: "text" }, { name: "priority", label: "Priority", type: "select", options: moduleStatuses(["LOW", "MEDIUM", "HIGH", "URGENT"]) }, { name: "startDate", label: "Due date", type: "date" }, { name: "status", label: "Progress", type: "select", options: moduleStatuses(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]) }, { name: "details", label: "Description and progress updates", type: "textarea" }] },
  timesheets: { title: "Timesheets", endpoint: "/hr-suite/timesheets", queryKey: "suite-timesheets", allowSelfService: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Timesheet" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Period" }, { key: "minutes", label: "Total time" }, { key: "status", label: "Approval" }], fields: [{ name: "title", label: "Timesheet", type: "text", required: true }, { name: "employeeId", label: "Employee", type: "select" }, { name: "period", label: "ISO week", type: "text", required: true, placeholder: "2026-W46" }, { name: "minutes", label: "Total minutes", type: "number", required: true }, { name: "status", label: "Approval status", type: "select", options: moduleStatuses(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]) }, { name: "details", label: "Daily entries / reviewer notes", type: "textarea" }] },
  performance: { title: "Performance", endpoint: "/hr-suite/performance", queryKey: "suite-performance", disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Review" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Review period" }, { key: "amount", label: "Score" }, { key: "status", label: "Review stage" }], fields: [{ name: "title", label: "Review / goal", type: "text", required: true }, { name: "employeeId", label: "Employee", type: "select", required: true }, { name: "period", label: "Review cycle", type: "text", required: true, placeholder: "FY 2026 / Q4" }, { name: "amount", label: "Score (0–5)", type: "number" }, { name: "status", label: "Review stage", type: "select", options: moduleStatuses(["DRAFT", "SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATION", "ACKNOWLEDGED", "DONE"]) }, { name: "details", label: "Goals, measurable outcomes, feedback, and development plan", type: "textarea" }] },
  assets: { title: "Asset Management", endpoint: "/hr-suite/assets", queryKey: "suite-assets", adminOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Asset / serial" }, { key: "employeeLabel", label: "Assigned employee" }, { key: "status", label: "Lifecycle" }, { key: "startDate", label: "Issued" }, { key: "endDate", label: "Return due" }], fields: [{ name: "title", label: "Asset type and serial number", type: "text", required: true }, { name: "employeeId", label: "Assigned employee (leave blank for stock)", type: "select" }, { name: "status", label: "Lifecycle status", type: "select", options: moduleStatuses(["AVAILABLE", "ASSIGNED", "IN_REPAIR", "RETURNED", "RETIRED"]) }, { name: "startDate", label: "Issue date", type: "date" }, { name: "endDate", label: "Expected return date", type: "date" }, { name: "details", label: "Location, make/model, condition, warranty, and handover notes", type: "textarea" }] },
  monitoring: { title: "Computer Use & Work Sessions", endpoint: "/hr-suite/monitoring", queryKey: "suite-monitoring", allowSelfService: true, selfServiceOnly: true, disableDelete: true, columns: [{ key: "title", label: "Session / consent record" }, { key: "startDate", label: "Date" }, { key: "minutes", label: "Minutes" }, { key: "consent", label: "Consent recorded" }], fields: [{ name: "title", label: "Session / consent record", type: "text", required: true }, { name: "startDate", label: "Date", type: "date" }, { name: "minutes", label: "Duration (minutes)", type: "number" }, { name: "consent", label: "I consent to transparent work-session tracking", type: "checkbox", required: true }, { name: "details", label: "Purpose / policy version", type: "textarea" }] },
};

export default function SuiteWorkspacePage({ module }: { module: SuiteModule }) {
  const { isHr, isManager, isEmployee, isSuperAdmin } = useRole();
  const queryClient = useQueryClient();
  const [timesheetPeriod, setTimesheetPeriod] = useState(currentIsoWeek());
  const [timesheetEmployeeId, setTimesheetEmployeeId] = useState<string>();
  const [timesheetDecision, setTimesheetDecision] = useState<{ record: ResourceRecord; nextStatus: "APPROVED" | "REJECTED" } | null>(null);
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const definition = MODULE_CONFIG[module];
  const canChooseEmployee = isHr || isManager;
  const moduleRecords = useQuery({
    queryKey: [definition.queryKey],
    queryFn: () => resourceService.list(definition.endpoint),
  });
  const records = moduleRecords.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const completed = records.filter((record) => ["DONE", "APPROVED", "PAID", "RETURNED", "FILED", "CANCELLED"].includes(String(record.status).toUpperCase())).length;
  const overdue = records.filter((record) => {
    const due = module === "assets" ? record.endDate : record.startDate;
    return due && due < today && !["DONE", "APPROVED", "PAID", "RETURNED", "FILED", "CANCELLED"].includes(String(record.status).toUpperCase());
  }).length;
  const minutes = records.reduce((sum, record) => sum + (Number(record.minutes) || 0), 0);
  const amount = records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const metrics = [
    { label: "Total records", value: records.length },
    { label: module === "assets" ? "Assigned / in progress" : module === "performance" ? "Open reviews" : "Open / pending", value: records.length - completed },
    ...(module === "tasks" || module === "assets" ? [{ label: "Overdue", value: overdue }] : []),
    ...(module === "timesheets" || module === "time-tracking" ? [{ label: "Recorded time", value: `${Math.floor(minutes / 60)}h ${minutes % 60}m` }] : []),
    ...(module === "statutory" ? [{ label: "Register total", value: `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` }] : []),
  ];
  const employees = useQuery({
    queryKey: ["suite-employee-options"],
    queryFn: () => resourceService.get<EmployeeOption[]>("/hr-suite/employee-options"),
    enabled: canChooseEmployee && definition.employeeField === true,
  });
  const config = useMemo<ResourceConfig>(() => {
    const fields = definition.fields.map((field) => {
      if (field.name !== "employeeId" || !field.options) return field;
      return { ...field, options: employees.data?.map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` })) ?? [] };
    });
    // Employee selectors are populated from a backend projection that excludes
    // Aadhaar, PAN, bank and other profile fields.
    if (definition.employeeField && canChooseEmployee) {
      const index = fields.findIndex((f) => f.name === "employeeId");
      if (index >= 0) fields[index] = { ...fields[index], type: "select", options: employees.data?.map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` })) ?? [] };
    }
    return { ...definition, fields };
  }, [definition, employees.data, canChooseEmployee]);

  const generateTimesheet = useMutation({
    mutationFn: async () => (await apiClient.post<ApiResponse<unknown>>(
      "/hr-suite/timesheets/generate",
      { period: timesheetPeriod, ...(canChooseEmployee ? { employeeId: timesheetEmployeeId } : {}) },
    )).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["suite-timesheets"] });
      toast.success("Timesheet submitted from completed timer sessions.");
    },
  });
  const decideTimesheet = useMutation({
    mutationFn: async ({ record, nextStatus, remarks }: { record: ResourceRecord; nextStatus: "APPROVED" | "REJECTED"; remarks?: string }) => {
      const body = { status: nextStatus, remarks };
      return (await apiClient.post<ApiResponse<ResourceRecord>>(`/hr-suite/timesheets/${record.id}/decision`, body)).data.data;
    },
    onSuccess: async (_record, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["suite-timesheets"] });
      toast.success(`Timesheet ${variables.nextStatus.toLowerCase()}.`);
      setTimesheetDecision(null);
      setReviewerRemarks("");
    },
    onError: () => toast.error("Could not update timesheet. Check team access and try again."),
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-xl font-semibold text-slate-900">{definition.title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-600">{MODULE_GUIDANCE[module]}</p></div>
          {records.length > 0 && module !== "monitoring" && <Button icon={<Download size={15} />} onClick={() => exportRecords(module, records)}>Export CSV</Button>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => <div key={metric.label} className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</div><div className="mt-1 text-xl font-semibold text-slate-900">{moduleRecords.isLoading ? "—" : moduleRecords.isError ? "Unavailable" : metric.value}</div></div>)}
        </div>
        {moduleRecords.isError && <p role="alert" className="mt-3 text-sm text-rose-700">Could not load module summary. Refresh the page; the record list will show its own error state.</p>}
      </section>
      {module === "timesheets" && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Generate from time tracker</h2>
            <p className="mt-1 text-sm text-slate-600">Build a weekly submission from stopped timer sessions. Running timers are excluded, and each employee can submit one timesheet per week.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-slate-700">ISO week
                <input className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" type="week" value={timesheetPeriod} onChange={(event) => setTimesheetPeriod(event.target.value)} />
              </label>
              {canChooseEmployee && <label className="min-w-64 text-sm font-medium text-slate-700">Employee
                <Select className="mt-1 block w-full" showSearch optionFilterProp="label" placeholder="Select employee" value={timesheetEmployeeId} options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` }))} onChange={setTimesheetEmployeeId} loading={employees.isLoading} />
              </label>}
              <Button type="primary" loading={generateTimesheet.isPending} disabled={!/^\d{4}-W\d{2}$/.test(timesheetPeriod) || (canChooseEmployee && !timesheetEmployeeId)} onClick={() => generateTimesheet.mutate()}>
                Generate & submit
              </Button>
            </div>
            {generateTimesheet.isError && <p role="alert" className="mt-2 text-sm text-rose-700">No timesheet was generated. Check that completed sessions exist for this week and that a timesheet has not already been submitted.</p>}
          </section>
          {(isManager || isSuperAdmin) && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Team approval queue</h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">Approve or reject submitted timesheets for your accessible team. Decisions are enforced by the backend team-access rules.</p>
            <Table rowKey="id" size="small" loading={moduleRecords.isLoading} dataSource={records.filter((record) => ["SUBMITTED", "PENDING"].includes(String(record.status).toUpperCase()))} pagination={{ pageSize: 6 }} locale={{ emptyText: moduleRecords.isError ? "Could not load the approval queue." : "No timesheets are awaiting review." }} columns={[
              { title: "Employee", dataIndex: "employeeLabel", key: "employeeLabel", render: (value: string | undefined) => value ?? "—" },
              { title: "Period", dataIndex: "period", key: "period" },
              { title: "Total time", dataIndex: "minutes", key: "minutes", render: (value: number | undefined) => value == null ? "—" : `${Math.floor(value / 60)}h ${value % 60}m` },
              { title: "Status", dataIndex: "status", key: "status", render: (value: string) => <Tag color="blue">{value}</Tag> },
              { title: "Decision", key: "decision", render: (_: unknown, record: ResourceRecord) => <div className="flex gap-2"><Button size="small" type="primary" icon={<Check size={14} />} onClick={() => { setReviewerRemarks(""); setTimesheetDecision({ record, nextStatus: "APPROVED" }); }}>Approve</Button><Button size="small" danger icon={<X size={14} />} onClick={() => { setReviewerRemarks(""); setTimesheetDecision({ record, nextStatus: "REJECTED" }); }}>Reject</Button></div> },
            ]} />
          </section>}
          <Modal open={Boolean(timesheetDecision)} title={timesheetDecision?.nextStatus === "REJECTED" ? "Reject timesheet" : "Approve timesheet"} onCancel={() => setTimesheetDecision(null)} okText={timesheetDecision?.nextStatus === "REJECTED" ? "Reject" : "Approve"} okButtonProps={{ danger: timesheetDecision?.nextStatus === "REJECTED" }} confirmLoading={decideTimesheet.isPending} onOk={() => {
            if (!timesheetDecision) return;
            if (timesheetDecision.nextStatus === "REJECTED" && !reviewerRemarks.trim()) { toast.error("Add a reason before rejecting this timesheet."); return; }
            decideTimesheet.mutate({ record: timesheetDecision.record, nextStatus: timesheetDecision.nextStatus, remarks: reviewerRemarks.trim() });
          }}>
            <p className="mb-2 text-sm text-slate-600">{timesheetDecision?.record.employeeLabel} · {timesheetDecision?.record.period}</p>
            <Input.TextArea rows={4} maxLength={2000} showCount value={reviewerRemarks} onChange={(event) => setReviewerRemarks(event.target.value)} placeholder={timesheetDecision?.nextStatus === "REJECTED" ? "Reason for rejection (required)" : "Reviewer note (optional)"} />
          </Modal>
        </>
      )}
      {module === "monitoring" && <ComputerUseWorkspace />}
      {module === "statutory" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          PF, ESI and professional-tax amounts require HR-configured, location-specific rules and review. This register does not calculate legal contributions automatically.
        </div>
      )}
      {isEmployee && module === "payslips" && <p className="text-sm text-slate-500">Your payslips are private to your account.</p>}
      {module !== "monitoring" && <ResourcePage config={config} />}
    </div>
  );
}

const MODULE_GUIDANCE: Record<SuiteModule, string> = {
  payroll: "Review payroll runs and payslip delivery status. Payroll inputs and employee salary details remain restricted to Finance and Super Admin.",
  payslips: "Manage secure payslip delivery and payroll history. Employees receive approved payslips by email and cannot browse payroll data here.",
  statutory: "Maintain the monthly PF, ESI, and Professional Tax filing register, amounts, challan or filing references, and completion status. Verify current statutory rules before filing; this page does not calculate legal contributions automatically.",
  "time-tracking": "Start and stop your work sessions in Time Tracker. Completed sessions are available for weekly timesheet submission.",
  tasks: "Assign work, track due dates, update progress, and review overdue items. Keep task descriptions clear and record status changes as work moves forward.",
  timesheets: "Submit weekly timesheets from completed timer sessions, then review and record approval status for the period.",
  performance: "Manage review-cycle records, scores, feedback, and development notes. Keep feedback specific, job-related, and reviewable by the employee.",
  assets: "Maintain the assigned-device register, issue and expected return dates, condition notes, and return status.",
  monitoring: "View your own consent-based work-session records. Tracking remains employee-controlled and this module does not collect screen, keystroke, browser, or application content.",
};

function exportRecords(module: SuiteModule, records: ResourceRecord[]) {
  const columns = ["title", "employeeLabel", "period", "status", "amount", "minutes", "startDate", "endDate"];
  const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [columns.join(","), ...records.map((record) => columns.map((key) => csvCell(record[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${module}-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type ComputerUseSession = ResourceRecord & { id: string; title: string; status: string; startDate?: string; minutes?: number; createdAt?: string; category?: string };

function ComputerUseWorkspace() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("FOCUS_WORK");
  const [consent, setConsent] = useState(false);
  const [now, setNow] = useState(0);
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ["suite-monitoring"],
    queryFn: () => resourceService.get<ComputerUseSession[]>("/hr-suite/monitoring/my-sessions"),
    refetchInterval: 30_000,
  });
  const rows = sessions.data ?? [];
  const active = rows.find((session) => session.status === "RUNNING");
  const activeId = active?.id;
  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeId]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["suite-monitoring"] });
  const start = useMutation({
    mutationFn: async () => (await apiClient.post<ApiResponse<ComputerUseSession>>("/hr-suite/monitoring/start", { title: title.trim(), category, consent })).data.data,
    onSuccess: async () => { setTitle(""); setConsent(false); toast.success("Consent-based session started"); await invalidate(); },
    onError: () => toast.error("Could not start the session. Confirm consent and try again."),
  });
  const stop = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<ComputerUseSession>>(`/hr-suite/monitoring/${id}/stop`)).data.data,
    onSuccess: async () => { toast.success("Session stopped"); await invalidate(); },
    onError: () => toast.error("Could not stop this session."),
  });
  const withdraw = useMutation({
    mutationFn: async () => (await apiClient.post<ApiResponse<number>>("/hr-suite/monitoring/consent/withdraw")).data.data,
    onSuccess: async () => { toast.success("Consent withdrawn; active sessions stopped"); await invalidate(); },
    onError: () => toast.error("Could not update consent."),
  });
  const activeMinutes = active?.createdAt ? Math.max(0, Math.floor((now - new Date(active.createdAt).getTime()) / 60_000)) : 0;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div><h2 className="font-semibold">Transparent, employee-controlled sessions</h2><p className="mt-1 text-sm">This page records the activity label, category, start/end time, and duration you choose to track. It does not capture screenshots, keystrokes, browsing history, or application content. Consent is requested for every session.</p></div></div>
    {active ? <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div><div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Session running</div><div className="mt-1 text-lg font-semibold text-slate-900">{active.title}</div><div className="mt-1 font-mono text-2xl tabular-nums text-emerald-900">{Math.floor(activeMinutes / 60)}h {activeMinutes % 60}m</div></div><div className="flex gap-2"><Button danger onClick={() => stop.mutate(active.id)} loading={stop.isPending}>Stop session</Button><Button onClick={() => withdraw.mutate()} loading={withdraw.isPending}>Withdraw consent</Button></div></div> : <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2"><Input className="min-w-56 flex-1" aria-label="Activity label" maxLength={180} value={title} placeholder="Activity label (for example, project work)" onChange={(event) => setTitle(event.target.value)} /><Select className="w-48" value={category} onChange={setCategory} options={[{ value: "FOCUS_WORK", label: "Focus work" }, { value: "MEETING", label: "Meeting" }, { value: "TRAINING", label: "Training" }, { value: "ADMIN", label: "Admin work" }]} /></div><Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)}>I consent to record this work session under the stated policy.</Checkbox><div><Button type="primary" disabled={!title.trim() || !consent} loading={start.isPending} onClick={() => start.mutate()}>Start consent-based session</Button></div></div>}
    <div className="mt-5"><h3 className="mb-3 font-semibold text-slate-900">My session history</h3><Table rowKey="id" size="small" loading={sessions.isLoading} dataSource={rows} pagination={{ pageSize: 8 }} locale={{ emptyText: sessions.isError ? "Session history could not be loaded." : "No work sessions recorded." }} columns={[{ title: "Activity", dataIndex: "title", key: "title" }, { title: "Category", dataIndex: "category", key: "category" }, { title: "Date", dataIndex: "startDate", key: "startDate" }, { title: "Duration", dataIndex: "minutes", key: "minutes", render: (value: number | undefined, record: ComputerUseSession) => record.status === "RUNNING" ? `${Math.floor(activeMinutes / 60)}h ${activeMinutes % 60}m` : value == null ? "—" : `${Math.floor(value / 60)}h ${value % 60}m` }, { title: "Status", dataIndex: "status", key: "status", render: (value: string) => <Tag color={value === "RUNNING" ? "green" : value === "CONSENT_WITHDRAWN" ? "orange" : "default"}>{value.replaceAll("_", " ")}</Tag> }]} /></div>
  </section>;
}

function currentIsoWeek() {
  const now = new Date();
  const thursday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

