import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Form, Input, InputNumber, Popconfirm, Select, Switch, Table, Tag } from "antd";
import { Archive, Download, MailCheck, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../../services/apiClient";
import { resourceService } from "../../services/resourceService";
import type { ApiResponse } from "../../utils/types";
import type { EmployeeOption } from "./SuiteWorkspacePage";

type Profile = { employeeId: string; gross: number; basic: number; hra: number; lta: number; pfRate: number; esiRate: number; professionalTax: number; tds: number; employerPfRate: number; employerEsiRate: number; gratuity: number; performanceBonusEnabled: boolean; performanceBonus: number; policyVersion?: string };
type RunEmployee = { employeeId: string; paidDays: number; lopDays: number };
type PayrollRecord = { id: string; employeeId?: string; employeeLabel?: string; period: string; amount: number; status: string; details?: string; archivedAt?: string | null };
const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value) : String(value ?? "—");
const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === "string" ? response.data.message : fallback;
};
const defaults: Omit<Profile, "employeeId"> = { gross: 0, basic: 0, hra: 0, lta: 0, pfRate: 12, esiRate: 0, professionalTax: 0, tds: 0, employerPfRate: 12, employerEsiRate: 0, gratuity: 0, performanceBonusEnabled: false, performanceBonus: 0, policyVersion: "" };
const DAYS_FIELDS = [{ name: "gross", label: "Gross monthly earnings (₹)" }, { name: "basic", label: "Basic (₹)" }, { name: "hra", label: "House rent allowance (₹)" }, { name: "lta", label: "Leave travel allowance (₹)" }, { name: "pfRate", label: "Employee PF rate (%)" }, { name: "professionalTax", label: "Professional tax (₹)" }, { name: "employerPfRate", label: "Employer PF rate (%)" }, { name: "gratuity", label: "Gratuity provision (₹)" }] as const;
const currentPayrollPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function PayrollPage() {
  const [profileForm] = Form.useForm<Profile>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>();
  const [period, setPeriod] = useState(currentPayrollPeriod);
  const [runEmployees, setRunEmployees] = useState<RunEmployee[]>([]);
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["suite-payroll-profiles"], queryFn: () => resourceService.get<Profile[]>("/hr-suite/payroll/profiles") });
  const employees = useQuery({ queryKey: ["suite-employee-options"], queryFn: () => resourceService.get<EmployeeOption[]>("/hr-suite/employee-options") });
  const employeeLabels = useMemo(() => new Map((employees.data ?? []).map((e) => [e.id, `${e.employeeCode} · ${e.displayName}`])), [employees.data]);
  const saveProfile = useMutation({
    mutationFn: async (values: Profile) => (await apiClient.post<ApiResponse<Profile>>("/hr-suite/payroll/profiles", values)).data.data,
    onSuccess: async () => { toast.success("Payroll profile saved"); await qc.invalidateQueries({ queryKey: ["suite-payroll-profiles"] }); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not save payroll profile")),
  });
  const runPayroll = useMutation({
    mutationFn: async () => (await apiClient.post<ApiResponse<PayrollRecord[]>>("/hr-suite/payroll/run", { period, employees: runEmployees })).data.data,
    onSuccess: async (rows) => { toast.success(`Payroll calculated for ${rows.length} employee(s)`); setRunEmployees([]); await qc.invalidateQueries({ queryKey: ["suite-payroll"] }); await qc.invalidateQueries({ queryKey: ["suite-payslips"] }); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Payroll run failed")),
  });
  const onSelectEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    const existing = profiles.data?.find((p) => p.employeeId === employeeId);
    profileForm.setFieldsValue({ ...defaults, ...existing, employeeId });
  };
  const configuredOptions = (profiles.data ?? []).map((p) => ({ value: p.employeeId, label: employeeLabels.get(p.employeeId) ?? "Employee" }));
  const calendarDays = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate() : 0;
  const updateRunEmployees = (ids: string[]) => {
    setRunEmployees(ids.map((employeeId) => runEmployees.find((row) => row.employeeId === employeeId) ?? { employeeId, paidDays: calendarDays, lopDays: 0 }));
  };

  return <div className="space-y-5">
    <Alert type="warning" showIcon message="Finance controlled payroll" description="Only the Finance Admin and Super Admin can view payroll records. Employees receive only their own approved payslip as a PDF email; they cannot view payroll or payslip records in the portal." />
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Payroll profiles</h1>
      <p className="mt-1 text-sm text-slate-600">Configure recurring monthly earnings, PF and professional tax, plus an optional performance bonus. ESI and TDS are not deducted by this payroll calculation. Past payroll runs remain unchanged. Basic, HRA and LTA must fit within gross earnings; the remainder is treated as special allowance.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
        <Select showSearch optionFilterProp="label" placeholder="Select employee to configure" value={selectedEmployee} options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` }))} onChange={onSelectEmployee} loading={employees.isLoading} />
        {selectedEmployee && <Button onClick={() => { setSelectedEmployee(undefined); profileForm.resetFields(); }}>Clear selection</Button>}
      </div>
      {selectedEmployee && <Form form={profileForm} layout="vertical" onFinish={(values) => saveProfile.mutate(values)} className="mt-4">
        <Form.Item name="employeeId" hidden><Input /></Form.Item>
        <Form.Item name="esiRate" hidden><InputNumber /></Form.Item>
        <Form.Item name="tds" hidden><InputNumber /></Form.Item>
        <Form.Item name="employerEsiRate" hidden><InputNumber /></Form.Item>
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS_FIELDS.map(({ name, label }) => <Form.Item key={name} name={name} label={label} rules={[{ required: true }, { type: "number", min: 0 }, ...(name.toLowerCase().includes("rate") ? [{ type: "number" as const, max: 100 }] : [])]}><InputNumber className="w-full" min={0} precision={2} /></Form.Item>)}
          <Form.Item name="performanceBonusEnabled" label="Performance bonus" valuePropName="checked"><Switch checkedChildren="On" unCheckedChildren="Off" /></Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.performanceBonusEnabled !== current.performanceBonusEnabled}>
            {({ getFieldValue }) => getFieldValue("performanceBonusEnabled")
              ? <Form.Item name="performanceBonus" label="Monthly performance bonus (₹)" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber className="w-full" min={0} precision={2} /></Form.Item>
              : null}
          </Form.Item>
          <Form.Item name="policyVersion" label="Policy / rule version"><Input maxLength={80} placeholder="Company payroll policy revision" /></Form.Item>
        </div>
        <Button type="primary" htmlType="submit" loading={saveProfile.isPending}>Save payroll profile</Button>
      </Form>}
      <Table className="mt-5" rowKey="employeeId" loading={profiles.isLoading} dataSource={profiles.data ?? []} pagination={{ pageSize: 8 }} columns={[{ title: "Employee", key: "employee", render: (_, row: Profile) => employeeLabels.get(row.employeeId) ?? "Employee" }, { title: "Gross / month", dataIndex: "gross", render: money }, { title: "Basic / month", dataIndex: "basic", render: money }, { title: "Rule version", dataIndex: "policyVersion", render: (value: string) => value || "—" }, { title: "Action", key: "action", render: (_, row: Profile) => <Button type="link" onClick={() => onSelectEmployee(row.employeeId)}>Edit</Button> }]} />
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Calculate payroll</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">Enter paid and LOP days for each employee. Earnings and percentage-based deductions are prorated by paid days for the month. Review local statutory rules before calculating.</p>
      <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
        <label className="text-sm font-medium text-slate-700">Payroll month
          <Input className="mt-1" type="month" value={period} onChange={(e) => { const next = e.target.value; setPeriod(next); const days = /^\d{4}-(0[1-9]|1[0-2])$/.test(next) ? new Date(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0).getDate() : 0; setRunEmployees((rows) => rows.map((row) => ({ ...row, paidDays: days, lopDays: 0 }))); }} />
        </label>
        <label className="text-sm font-medium text-slate-700">Employees
          <Select className="mt-1 w-full" mode="multiple" showSearch optionFilterProp="label" placeholder="Choose configured employees" value={runEmployees.map((r) => r.employeeId)} options={configuredOptions} onChange={updateRunEmployees} loading={profiles.isLoading || employees.isLoading} />
        </label>
      </div>
      {runEmployees.length > 0 && <Table className="mt-4" rowKey="employeeId" pagination={false} dataSource={runEmployees} columns={[{ title: "Employee", key: "employee", render: (_, row: RunEmployee) => employeeLabels.get(row.employeeId) ?? "Employee" }, { title: "Paid days", key: "paidDays", render: (_, row: RunEmployee) => <InputNumber min={0} max={calendarDays} value={row.paidDays} onChange={(value) => setRunEmployees((current) => current.map((r) => r.employeeId === row.employeeId ? { ...r, paidDays: value ?? 0 } : r))} /> }, { title: "LOP days", key: "lopDays", render: (_, row: RunEmployee) => <InputNumber min={0} max={calendarDays} value={row.lopDays} onChange={(value) => setRunEmployees((current) => current.map((r) => r.employeeId === row.employeeId ? { ...r, lopDays: value ?? 0 } : r))} /> }]} />}
      <Button className="mt-4" type="primary" loading={runPayroll.isPending} disabled={!calendarDays || !runEmployees.length || runEmployees.some((row) => row.paidDays + row.lopDays > calendarDays)} onClick={() => runPayroll.mutate()}>Calculate payroll</Button>
    </section>
    <PayrollHistory employeeLabels={employeeLabels} />
  </div>;
}

function PayrollHistory({ employeeLabels }: { employeeLabels: Map<string, string> }) {
  const qc = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useQuery({ queryKey: ["suite-payroll", includeArchived], queryFn: () => resourceService.list(`/hr-suite/payroll${includeArchived ? "?includeArchived=true" : ""}`) as Promise<PayrollRecord[]> });
  const send = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<PayrollRecord>>(`/hr-suite/payroll/${id}/approve-and-email`)).data.data,
    onSuccess: async () => { toast.success("Payslip email sent"); await qc.invalidateQueries({ queryKey: ["suite-payroll"] }); await qc.invalidateQueries({ queryKey: ["suite-payslips"] }); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Payslip email failed; retry after checking employee email and mail service")),
  });
  const archive = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<PayrollRecord>>(`/hr-suite/payroll/${id}/archive`)).data.data,
    onSuccess: async () => { toast.success("Payroll and payslip archived; audit records are retained"); await qc.invalidateQueries({ queryKey: ["suite-payroll"] }); await qc.invalidateQueries({ queryKey: ["suite-payslips"] }); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not archive payroll")),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<PayrollRecord>>(`/hr-suite/payroll/${id}/restore`)).data.data,
    onSuccess: async () => { toast.success("Payroll and payslip restored"); await qc.invalidateQueries({ queryKey: ["suite-payroll"] }); await qc.invalidateQueries({ queryKey: ["suite-payslips"] }); },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not restore payroll")),
  });
  const download = async (row: PayrollRecord) => {
    try {
      const response = await apiClient.get(`/hr-suite/payroll/${row.id}/payslip.pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a"); link.href = url; link.download = `Payslip_${(row.employeeLabel ?? "Employee").replace(/[^A-Za-z0-9_-]/g, "_")}_${row.period}.pdf`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("Could not download payslip PDF"); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Payroll history and payslip delivery</h2><Checkbox checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)}>Show archived payroll</Checkbox></div>
    <Alert className="mb-4" type="info" showIcon message="Payroll archive is reversible" description="Archiving hides payroll and its payslip from active lists while retaining both records and the admin audit details. Restore them from this history at any time." />
    <Table rowKey="id" loading={query.isLoading} dataSource={query.data ?? []} pagination={{ pageSize: 10 }} expandable={{ expandedRowRender: (row) => {
      let values: Record<string, unknown>; try { values = JSON.parse(row.details ?? "{}"); } catch { return <p>Breakdown unavailable.</p>; }
      return <div className="grid gap-2 sm:grid-cols-3">{Object.entries(values).filter(([key]) => !key.toLowerCase().includes("rate") && key !== "policyVersion").map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs text-slate-500">{key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase())}</div><div className="mt-1 text-sm font-medium">{typeof value === "number" && !key.toLowerCase().includes("days") ? money(value) : String(value)}</div></div>)}</div>;
    } }} columns={[{ title: "Employee", dataIndex: "employeeLabel", key: "employee", render: (value: string, row: PayrollRecord) => value ?? employeeLabels.get(row.employeeId ?? "") ?? "Employee" }, { title: "Period", dataIndex: "period", key: "period" }, { title: "Net pay", dataIndex: "amount", key: "amount", render: money }, { title: "Status", dataIndex: "status", key: "status", render: (value: string, row: PayrollRecord) => <div className="flex flex-wrap gap-1"><Tag color={value === "APPROVED" ? "green" : value === "EMAIL_FAILED" ? "red" : value === "EMAIL_SENDING" ? "orange" : "blue"}>{value.replaceAll("_", " ")}</Tag>{row.archivedAt && <Tag color="default">ARCHIVED</Tag>}</div> }, { title: "Actions", key: "actions", render: (_, row: PayrollRecord) => <div className="flex flex-wrap gap-2">{row.archivedAt ? <Button size="small" icon={<RotateCcw size={14} />} loading={restore.isPending && restore.variables === row.id} onClick={() => restore.mutate(row.id)}>Restore</Button> : <><Button size="small" icon={<Download size={14} />} onClick={() => void download(row)}>{row.status === "APPROVED" ? "Download PDF" : "PDF"}</Button>{["CALCULATED", "EMAIL_FAILED", "APPROVED"].includes(row.status) && <Button size="small" type="primary" icon={<MailCheck size={14} />} loading={send.isPending && send.variables === row.id} onClick={() => send.mutate(row.id)}>{row.status === "APPROVED" ? "Resend email" : "Approve & email"}</Button>}<Popconfirm title="Archive this payroll record?" description="Its payslip will be archived with it. Both records remain in the audit history and can be restored." okText="Archive" cancelText="Cancel" onConfirm={() => archive.mutate(row.id)}><Button size="small" danger disabled={row.period >= currentPayrollPeriod()} icon={<Archive size={14} />} loading={archive.isPending && archive.variables === row.id}>Archive</Button></Popconfirm></>}</div> }]} />
  </section>;
}

