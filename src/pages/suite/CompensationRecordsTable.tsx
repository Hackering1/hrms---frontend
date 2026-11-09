import { useQuery } from "@tanstack/react-query";
import { Table, Tag } from "antd";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";

type CompensationRecord = { id: string; title: string; employeeLabel?: string; period?: string; amount?: number; status: string; details?: string };
const LABELS: Record<string, string> = {
  monthlyGross: "Monthly gross", gross: "Gross earnings", basic: "Basic pay", hra: "House rent allowance",
  lta: "Leave travel allowance", fixedAllowance: "Fixed allowance", employeePf: "Employee PF", employeeEsi: "Employee ESI",
  professionalTax: "Professional tax", tds: "TDS", netPay: "Net pay", employerPf: "Employer PF",
  employerEsi: "Employer ESI", gratuity: "Gratuity", employerCost: "Employer cost", paidDays: "Paid days", lopDays: "LOP days",
};
const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value) : String(value ?? "—");

export default function CompensationRecordsTable({ endpoint, queryKey, title }: { endpoint: string; queryKey: string; title: string }) {
  const { isHr, isFinance } = useRole();
  const query = useQuery({ queryKey: [queryKey], queryFn: () => resourceService.list(endpoint) as Promise<CompensationRecord[]> });
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 font-semibold text-slate-900">{title}</h2>
    <Table rowKey="id" loading={query.isLoading} dataSource={query.data ?? []} pagination={{ pageSize: 10 }} expandable={{ expandedRowRender: (record) => {
      let parts: Record<string, unknown>;
      try { parts = JSON.parse(record.details ?? "{}"); } catch { return <p className="text-sm text-slate-500">Breakdown unavailable.</p>; }
      return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(parts).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs text-slate-500">{LABELS[key] ?? key}</div><div className="mt-1 text-sm font-medium text-slate-900">{money(value)}</div></div>)}</div>;
    } }} columns={[...(isHr || isFinance ? [{ title: "Employee", dataIndex: "employeeLabel", key: "employeeLabel" }] : []), { title: "Record", dataIndex: "title", key: "title" }, { title: "Period", dataIndex: "period", key: "period" }, { title: "Net pay", dataIndex: "amount", key: "amount", render: (value: number | undefined) => money(value) }, { title: "Status", dataIndex: "status", key: "status", render: (value: string) => <Tag color={value === "CALCULATED" || value === "GENERATED" || value === "PENDING_APPROVAL" ? "blue" : value === "EMAIL_FAILED" ? "red" : "green"}>{value}</Tag> }]} />
  </section>;
}
