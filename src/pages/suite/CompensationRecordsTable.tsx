import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Popconfirm, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Archive, Download, MailCheck, RotateCcw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../../services/apiClient";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { ApiResponse } from "../../utils/types";

type CompensationRecord = {
  id: string;
  title: string;
  employeeLabel?: string;
  period?: string;
  amount?: number;
  status: string;
  details?: string;
  archivedAt?: string | null;
};

const LABELS: Record<string, string> = {
  monthlyGross: "Monthly gross",
  gross: "Gross earnings",
  basic: "Basic pay",
  dearnessAllowance: "Dearness allowance",
  hra: "House rent allowance",
  lta: "Leave travel allowance",
  fixedAllowance: "Special allowance",
  performanceBonus: "Performance bonus",
  employeePf: "Employee PF",
  employeeEsi: "Employee ESI",
  professionalTax: "Professional tax",
  tds: "TDS",
  netPay: "Net pay",
  employerPf: "Employer PF",
  employerEsi: "Employer ESI",
  gratuity: "Gratuity",
  groupMedicalInsurance: "Group medical insurance",
  groupMedicalInsuranceGst: "GMI GST",
  employerCost: "Employer cost",
  paidDays: "Paid days",
  lopDays: "LOP days",
};

const money = (value: unknown) => typeof value === "number"
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value)
  : String(value ?? "—");

const currentPayrollPeriod = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

export default function CompensationRecordsTable({
  endpoint,
  queryKey,
  title,
  payrollActions = false,
}: {
  endpoint: string;
  queryKey: string;
  title: string;
  payrollActions?: boolean;
}) {
  const { isHr, isFinance, isPayrollAdmin } = useRole();
  const [includeArchived, setIncludeArchived] = useState(false);
  const queryEndpoint = payrollActions && includeArchived ? `${endpoint}?includeArchived=true` : endpoint;
  const query = useQuery({
    queryKey: [queryKey, includeArchived],
    queryFn: () => resourceService.list(queryEndpoint) as Promise<CompensationRecord[]>,
  });
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: [queryKey] });
    await qc.invalidateQueries({ queryKey: ["suite-payroll"] });
  };
  const resend = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<CompensationRecord>>(`/hr-suite/payslips/${id}/resend-email`)).data.data,
    onSuccess: async () => { toast.success("Payslip email sent again"); await refresh(); },
    onError: () => toast.error("Could not resend payslip email. Check the payroll status and mail service."),
  });
  const archive = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<CompensationRecord>>(`/hr-suite/payslips/${id}/archive`)).data.data,
    onSuccess: async () => { toast.success("Payroll and payslip archived with audit history"); await refresh(); },
    onError: () => toast.error("Could not archive payroll"),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiResponse<CompensationRecord>>(`/hr-suite/payslips/${id}/restore`)).data.data,
    onSuccess: async () => { toast.success("Payroll and payslip restored"); await refresh(); },
    onError: () => toast.error("Could not restore payroll"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<ApiResponse<void>>(`/hr-suite/payslips/${id}`)).data,
    onSuccess: async () => { toast.success("Payroll and payslip permanently deleted; audit history retained"); await refresh(); },
    onError: () => toast.error("Could not delete payroll"),
  });
  const download = async (row: CompensationRecord) => {
    try {
      const response = await apiClient.get(`/hr-suite/payslips/${row.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const employee = (row.employeeLabel ?? "Employee").replace(/[^A-Za-z0-9_-]/g, "_");
      const link = document.createElement("a");
      link.href = url;
      link.download = `Payslip_${employee}_${row.period ?? "period"}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not download payslip PDF");
    }
  };

  const columns: ColumnsType<CompensationRecord> = [
    ...(isHr || isFinance ? [{ title: "Employee", dataIndex: "employeeLabel", key: "employeeLabel" }] : []),
    { title: "Record", dataIndex: "title", key: "title" },
    { title: "Period", dataIndex: "period", key: "period" },
    { title: "Net pay", dataIndex: "amount", key: "amount", render: (value: number | undefined) => money(value) },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string, row: CompensationRecord) => (
        <div className="flex gap-1">
          <Tag color={value === "CALCULATED" || value === "GENERATED" || value === "PENDING_APPROVAL" ? "blue" : value === "EMAIL_FAILED" ? "red" : "green"}>{value}</Tag>
          {row.archivedAt && <Tag>ARCHIVED</Tag>}
        </div>
      ),
    },
  ];

  if (payrollActions && isPayrollAdmin) {
    columns.push({
      title: "Actions",
      key: "actions",
      render: (_: unknown, row: CompensationRecord) => (
        <div className="flex flex-wrap gap-2">
          {row.archivedAt ? (
            <Button size="small" icon={<RotateCcw size={14} />} loading={restore.isPending && restore.variables === row.id} onClick={() => restore.mutate(row.id)}>
              Restore
            </Button>
          ) : (
            <Button size="small" icon={<Download size={14} />} onClick={() => void download(row)}>
              Download PDF
            </Button>
          )}
          {!row.archivedAt && (
          <Button
            size="small"
            type="primary"
            icon={<MailCheck size={14} />}
            loading={resend.isPending && resend.variables === row.id}
            disabled={!(["PENDING_APPROVAL", "EMAIL_FAILED", "EMAILED", "APPROVED"].includes(row.status))}
            onClick={() => resend.mutate(row.id)}
          >
            {["EMAILED", "APPROVED"].includes(row.status) ? "Resend email" : "Approve & email"}
          </Button>
          )}
          {!row.archivedAt && (
            <Popconfirm
            title="Archive this payroll and payslip?"
            description="Both records will be hidden from active lists and retained in the audit history for restore."
            okText="Archive"
            cancelText="Cancel"
            onConfirm={() => archive.mutate(row.id)}
          >
            <Button size="small" danger disabled={!row.period || row.period >= currentPayrollPeriod()} icon={<Archive size={14} />} loading={archive.isPending && archive.variables === row.id}>
              Archive
            </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Permanently delete this payroll and payslip?"
            description="This removes both records from active and archived history. A deletion audit entry will remain. This cannot be undone."
            okText="Delete permanently"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutate(row.id)}
          >
            <Button size="small" danger disabled={!row.period || row.period >= currentPayrollPeriod()} icon={<Trash2 size={14} />} loading={remove.isPending && remove.variables === row.id}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      ),
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {payrollActions && isPayrollAdmin && (
          <Checkbox checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)}>
            Show archived payroll
          </Checkbox>
        )}
      </div>
      <Table
        rowKey="id"
        loading={query.isLoading}
        dataSource={query.data ?? []}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => {
            let parts: Record<string, unknown>;
            try { parts = JSON.parse(record.details ?? "{}"); }
            catch { return <p className="text-sm text-slate-500">Breakdown unavailable.</p>; }
            return (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(parts).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{LABELS[key] ?? key}</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{money(value)}</div>
                  </div>
                ))}
              </div>
            );
          },
        }}
        columns={columns}
      />
    </section>
  );
}

