import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Form, Input, InputNumber, Popconfirm, Select, Switch, Table, Tag, Card } from "antd";
import { Archive, Download, MailCheck, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../../services/apiClient";
import { resourceService } from "../../services/resourceService";
import type { ApiResponse } from "../../utils/types";
import type { EmployeeOption } from "./SuiteWorkspacePage";

type Profile = { employeeId: string; gross: number; basic: number; dearnessAllowance: number; hra: number; lta: number; pfRate: number; pfContributionMode: string; esiRate: number; professionalTax: number; tds: number; employerPfRate: number; employerEsiRate: number; gratuity: number; groupMedicalInsurance: number; performanceBonusEnabled: boolean; performanceBonus: number; taxRegime: "NEW" | "OLD"; taxResident: boolean; taxPreviousEmployerIncome: number; taxPreviousEmployerTds: number; taxOtherAnnualIncome: number; taxRentPaidAnnual: number; taxHraMetro: boolean; taxLandlordName?: string; taxLandlordPan?: string; taxLandlordAddress?: string; taxLtaClaimAnnual: number; taxHomeLoanInterestAnnual: number; taxLenderName?: string; taxLenderPan?: string; tax80cAnnual: number; tax80dAnnual: number; taxNpsAnnual: number; policyVersion?: string };
type RunEmployee = { employeeId: string; paidDays: number; lopDays: number };
type PayrollRecord = { id: string; employeeId?: string; employeeLabel?: string; period: string; amount: number; status: string; details?: string; archivedAt?: string | null };
const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value) : String(value ?? "—");
const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  return typeof response?.data?.message === "string" ? response.data.message : fallback;
};
const defaults: Omit<Profile, "employeeId"> = { gross: 0, basic: 0, dearnessAllowance: 0, hra: 0, lta: 0, pfRate: 12, pfContributionMode: "TWELVE_PERCENT", esiRate: 0, professionalTax: 0, tds: 0, employerPfRate: 12, employerEsiRate: 0, gratuity: 0, groupMedicalInsurance: 1250, performanceBonusEnabled: false, performanceBonus: 0, taxRegime: "NEW", taxResident: true, taxPreviousEmployerIncome: 0, taxPreviousEmployerTds: 0, taxOtherAnnualIncome: 0, taxRentPaidAnnual: 0, taxHraMetro: false, taxLtaClaimAnnual: 0, taxHomeLoanInterestAnnual: 0, tax80cAnnual: 0, tax80dAnnual: 0, taxNpsAnnual: 0, policyVersion: "" };
const DAYS_FIELDS = [{ name: "gross", label: "Gross monthly earnings (₹)" }, { name: "basic", label: "Basic (₹)" }, { name: "dearnessAllowance", label: "Dearness allowance (₹)" }, { name: "hra", label: "House rent allowance (₹)" }, { name: "lta", label: "Leave travel allowance (₹)" }, { name: "professionalTax", label: "Professional tax (₹)" }, { name: "gratuity", label: "Gratuity provision (₹)" }, { name: "groupMedicalInsurance", label: "Group medical insurance/month (₹)" }] as const;
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
    profileForm.setFieldsValue({ ...defaults, ...existing, groupMedicalInsurance: existing?.groupMedicalInsurance ?? 1250, dearnessAllowance: existing?.dearnessAllowance ?? 0, pfContributionMode: existing?.pfContributionMode ?? "TWELVE_PERCENT", taxRegime: existing?.taxRegime ?? "NEW", taxResident: existing?.taxResident ?? true, employeeId });
  };
  const configuredOptions = (profiles.data ?? []).map((p) => ({ value: p.employeeId, label: employeeLabels.get(p.employeeId) ?? "Employee" }));
  const calendarDays = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate() : 0;
  const updateRunEmployees = (ids: string[]) => {
    setRunEmployees(ids.map((employeeId) => runEmployees.find((row) => row.employeeId === employeeId) ?? { employeeId, paidDays: calendarDays, lopDays: 0 }));
  };

  return <div className="space-y-5">
    <Alert type="warning" showIcon message="Admin controlled payroll" description="Only Finance Admin and Super Admin can view payroll, employee tax declarations, and payslip records. Employees receive only their own approved payslip by email." />
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Payroll profiles</h1>
      <p className="mt-1 text-sm text-slate-600">Set employee earnings, a visible per-employee bonus switch, PF rule, group medical insurance, and employee tax declarations. Employee ESI is not deducted. TDS is calculated from the tax profile and applies only when projected tax is due. Existing payroll runs are never recalculated.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
        <Select showSearch optionFilterProp="label" placeholder="Select employee to configure" value={selectedEmployee} options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` }))} onChange={onSelectEmployee} loading={employees.isLoading} />
        {selectedEmployee && <Button onClick={() => { setSelectedEmployee(undefined); profileForm.resetFields(); }}>Clear selection</Button>}
      </div>
      {selectedEmployee && <Form form={profileForm} layout="vertical" onValuesChange={(changed, all) => {
        if ("gross" in changed || "dearnessAllowance" in changed) {
          const floorBasic = Math.max(0, Math.round((Number(all.gross ?? 0) / 2 - Number(all.dearnessAllowance ?? 0)) * 100) / 100);
          profileForm.setFieldValue("basic", floorBasic);
        }
        const basic = Number(("gross" in changed || "dearnessAllowance" in changed) ? Math.max(0, Number(all.gross ?? 0) / 2 - Number(all.dearnessAllowance ?? 0)) : (all.basic ?? 0));
        if (basic < 25000) profileForm.setFieldValue("pfContributionMode", "TWELVE_PERCENT");
      }} onFinish={(values) => saveProfile.mutate(values)} className="mt-4">
        <Form.Item name="employeeId" hidden><Input /></Form.Item>
        <Form.Item name="esiRate" hidden><InputNumber /></Form.Item>
        <Form.Item name="tds" hidden><InputNumber /></Form.Item>
        <Form.Item name="employerEsiRate" hidden><InputNumber /></Form.Item>
        <Form.Item name="pfRate" hidden><InputNumber /></Form.Item>
        <Form.Item name="employerPfRate" hidden><InputNumber /></Form.Item>
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS_FIELDS.map(({ name, label }) => <Form.Item key={name} name={name} label={label} rules={[{ required: true }, { type: "number", min: 0 }, ...(name.toLowerCase().includes("rate") ? [{ type: "number" as const, max: 100 }] : [])]}><InputNumber className="w-full" min={0} precision={2} /></Form.Item>)}
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.basic !== current.basic || previous.gross !== current.gross || previous.dearnessAllowance !== current.dearnessAllowance}>
            {({ getFieldValue }) => {
              const gross = Number(getFieldValue("gross") ?? 0);
              const wage = Number(getFieldValue("basic") ?? 0) + Number(getFieldValue("dearnessAllowance") ?? 0);
              return <div className="mb-6 flex items-center"><Tag color={wage >= gross / 2 ? "green" : "red"}>{wage >= gross / 2 ? "Basic + DA meets 50% wage floor" : "Below 50% wage floor"}</Tag></div>;
            }}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.basic !== current.basic}>
            {({ getFieldValue }) => <Form.Item name="pfContributionMode" label="Employee & employer PF rule" rules={[{ required: true }]}>
              <Select disabled={Number(getFieldValue("basic") ?? 0) < 25000} options={Number(getFieldValue("basic") ?? 0) < 25000
                ? [{ value: "TWELVE_PERCENT", label: "12% of Basic (required below ₹25,000)" }]
                : [{ value: "TWELVE_PERCENT", label: "12% of Basic" }, { value: "FLAT_3000", label: "Flat ₹3,000 per month" }]} />
            </Form.Item>}
          </Form.Item>
          <Form.Item name="taxRegime" label="Tax regime" rules={[{ required: true }]}><Select options={[{ value: "NEW", label: "New regime (default)" }, { value: "OLD", label: "Old regime with declarations" }]} /></Form.Item>
          <Form.Item name="taxResident" label="Indian tax resident" valuePropName="checked"><Switch checkedChildren="Yes" unCheckedChildren="No" /></Form.Item>
          <Form.Item name="policyVersion" label="Policy / rule version"><Input maxLength={80} placeholder="Company payroll policy revision" /></Form.Item>
        </div>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.groupMedicalInsurance !== current.groupMedicalInsurance}>
          {({ getFieldValue }) => <p className="-mt-4 mb-4 text-xs text-slate-500">Employer GMI default is ₹1,250/month (₹15,000/year). GST at 18% is calculated and shown separately: {money(Number(getFieldValue("groupMedicalInsurance") ?? 0) * 0.18)} monthly.</p>}
        </Form.Item>
        <Card size="small" className="mb-4 border-blue-200 bg-blue-50/40" title="Performance bonus — per employee">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Turn this on to include the monthly bonus in gross pay and the payslip. Off excludes it from payroll calculations.</p>
            <Form.Item name="performanceBonusEnabled" valuePropName="checked" className="mb-0"><Switch checkedChildren="On" unCheckedChildren="Off" /></Form.Item>
          </div>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.performanceBonusEnabled !== current.performanceBonusEnabled}>
            {({ getFieldValue }) => getFieldValue("performanceBonusEnabled")
              ? <Form.Item className="mb-0 mt-3" name="performanceBonus" label="Monthly performance bonus (₹)" rules={[{ required: true }, { type: "number", min: 0 }]}><InputNumber className="w-full max-w-sm" min={0} precision={2} /></Form.Item>
              : null}
          </Form.Item>
        </Card>
        <Card size="small" className="mb-4" title="Employee tax declaration · Form 124 / Form 12BB reference">
          <p className="mb-3 text-xs text-slate-600">Admin-entered annual claims and evidence particulars used for salary TDS. Form 12BB is retained as the familiar reference; for Tax Year 2026–27, use the current Form 124 declaration. TDS is absent when no tax is due.</p>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {[{ name: "taxPreviousEmployerIncome", label: "Previous employer salary (annual ₹)" }, { name: "taxPreviousEmployerTds", label: "TDS already deducted (annual ₹)" }, { name: "taxOtherAnnualIncome", label: "Other annual income (₹)" }, { name: "taxRentPaidAnnual", label: "Rent paid in tax year (₹)" }, { name: "taxLtaClaimAnnual", label: "LTA claim (annual ₹)" }, { name: "taxHomeLoanInterestAnnual", label: "Home-loan interest (annual ₹)" }, { name: "tax80cAnnual", label: "Section 80C claim (annual ₹)" }, { name: "tax80dAnnual", label: "Section 80D claim (annual ₹)" }, { name: "taxNpsAnnual", label: "NPS claim (annual ₹)" }].map(({ name, label }) => <Form.Item key={name} name={name} label={label}><InputNumber className="w-full" min={0} precision={2} /></Form.Item>)}
            <Form.Item name="taxHraMetro" label="HRA metro rate (50%)" valuePropName="checked"><Switch checkedChildren="Metro" unCheckedChildren="Non-metro" /></Form.Item>
            <Form.Item name="taxLandlordName" label="Landlord name"><Input maxLength={160} /></Form.Item>
            <Form.Item name="taxLandlordPan" label="Landlord PAN"><Input maxLength={10} /></Form.Item>
            <Form.Item name="taxLandlordAddress" label="Landlord address"><Input maxLength={500} /></Form.Item>
            <Form.Item name="taxLenderName" label="Home-loan lender"><Input maxLength={160} /></Form.Item>
            <Form.Item name="taxLenderPan" label="Lender PAN"><Input maxLength={10} /></Form.Item>
          </div>
        </Card>
        <Button type="primary" htmlType="submit" loading={saveProfile.isPending}>Save payroll profile</Button>
      </Form>}
      <Table className="mt-5" rowKey="employeeId" loading={profiles.isLoading} dataSource={profiles.data ?? []} pagination={{ pageSize: 8 }} columns={[{ title: "Employee", key: "employee", render: (_, row: Profile) => employeeLabels.get(row.employeeId) ?? "Employee" }, { title: "Gross / month", dataIndex: "gross", render: money }, { title: "Basic / month", dataIndex: "basic", render: money }, { title: "Performance bonus", key: "bonus", render: (_, row: Profile) => <Tag color={row.performanceBonusEnabled ? "green" : "default"}>{row.performanceBonusEnabled ? `ON · ${money(row.performanceBonus)}` : "OFF"}</Tag> }, { title: "PF rule", dataIndex: "pfContributionMode", render: (value: string) => value === "FLAT_3000" ? "Flat ₹3,000" : "12% of Basic" }, { title: "GMI / month", dataIndex: "groupMedicalInsurance", render: money }, { title: "Tax regime", dataIndex: "taxRegime", render: (value: string) => value ?? "NEW" }, { title: "Rule version", dataIndex: "policyVersion", render: (value: string) => value || "—" }, { title: "Action", key: "action", render: (_, row: Profile) => <Button type="link" onClick={() => onSelectEmployee(row.employeeId)}>Edit</Button> }]} />
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

