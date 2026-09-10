import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRole } from "../../hooks/useRole";
import {
  payrollService,
  type Payslip,
  type PayrollRun,
  type PayoutBatch,
} from "../../services/payrollService";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PROCESSED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

function PayslipRow({ p, onView }: { p: Payslip; onView: () => void }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5">
        {p.employeeCode} — {p.employeeName}
      </td>
      <td className="py-1.5 text-right">
        {p.paidDays}/{p.workingDays}
      </td>
      <td className="py-1.5 text-right">{money(p.grossEarnings)}</td>
      <td className="py-1.5 text-right">{money(p.totalDeductions)}</td>
      <td className="py-1.5 text-right font-medium">{money(p.netPay)}</td>
      <td className="py-1.5 text-right">
        <button
          onClick={onView}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          View
        </button>
      </td>
    </tr>
  );
}

function PayslipDetailModal({
  payslip,
  onClose,
}: {
  payslip: Payslip;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {payslip.employeeName}
            </h3>
            <p className="text-sm text-slate-500">
              {MONTH_NAMES[payslip.month - 1]} {payslip.year} ·{" "}
              {payslip.employeeCode}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                payrollService.downloadPayslipPdf(
                  payslip.id,
                  `Payslip_${payslip.employeeName?.replace(/\s+/g, "_")}_${MONTH_NAMES[payslip.month - 1]}_${payslip.year}.pdf`,
                )
              }
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Download PDF
            </button>
            <button
              onClick={async () => {
                try {
                  await payrollService.resendPayslipEmail(payslip.id);
                  toast.success("Payslip email queued for resend");
                } catch (e: any) {
                  toast.error(
                    e?.response?.data?.message ?? "Couldn't resend the email",
                  );
                }
              }}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Resend Email
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">Working Days</div>
            <div className="font-medium">{payslip.workingDays}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-400">Paid Days</div>
            <div className="font-medium">{payslip.paidDays}</div>
          </div>
          <div className="rounded-lg bg-rose-50 p-3">
            <div className="text-rose-500">LOP Days</div>
            <div className="font-medium text-rose-700">{payslip.lopDays}</div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-1">
            Earnings
          </h4>
          <table className="w-full text-sm">
            <tbody>
              {payslip.earnings.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1">{l.name}</td>
                  <td className="py-1 text-right">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-medium">
                <td className="py-1">Gross Earnings</td>
                <td className="py-1 text-right">
                  {money(payslip.grossEarnings)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-1">
            Deductions
          </h4>
          <table className="w-full text-sm">
            <tbody>
              {payslip.deductions.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1">{l.name}</td>
                  <td className="py-1 text-right">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-medium">
                <td className="py-1">Total Deductions</td>
                <td className="py-1 text-right">
                  {money(payslip.totalDeductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 flex items-center justify-between">
          <span className="font-semibold text-emerald-800">Net Pay</span>
          <span className="text-lg font-bold text-emerald-800">
            {money(payslip.netPay)}
          </span>
        </div>

        {payslip.employerContributions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-1">
              Employer Contributions (not deducted)
            </h4>
            <table className="w-full text-sm text-slate-500">
              <tbody>
                {payslip.employerContributions.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{l.name}</td>
                    <td className="py-1 text-right">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const payoutStatusColor: Record<string, string> = {
  INITIATED: "bg-slate-100 text-slate-600",
  RECEIVED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  PARTIALLY_FAILED: "bg-orange-100 text-orange-700",
  FAILED: "bg-rose-100 text-rose-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  REVERSED: "bg-rose-100 text-rose-700",
};

function PayoutConfirmModal({
  run,
  onConfirm,
  onClose,
  isPending,
}: {
  run: PayrollRun;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-rose-700">
          Confirm Bank Payout
        </h3>
        <p className="text-sm text-slate-600">
          This will initiate a real bank transfer via Cashfree Payouts for{" "}
          <strong>
            {MONTH_NAMES[run.month - 1]} {run.year}
          </strong>{" "}
          — approximately <strong>{money(run.totalNet)}</strong> across{" "}
          <strong>{run.employeeCount}</strong> employee(s). This cannot be
          undone once Cashfree processes the transfers.
        </p>
        <p className="text-xs text-slate-500">
          Type <strong>PAY</strong> below to confirm.
        </p>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type PAY to confirm"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmText !== "PAY" || isPending}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {isPending ? "Initiating…" : "Confirm & Pay"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutStatusPanel({
  runId,
  onRefresh,
}: {
  runId: number;
  onRefresh: () => void;
}) {
  const payout = useQuery({
    queryKey: ["payroll-payout", runId],
    queryFn: () => payrollService.getPayoutStatus(runId),
    retry: false,
  });

  if (payout.isLoading)
    return <div className="text-sm text-slate-400">Loading payout status…</div>;
  if (payout.isError || !payout.data) return null;

  const batch: PayoutBatch = payout.data;

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-slate-700">
            Bank Payout
          </span>{" "}
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${payoutStatusColor[batch.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {batch.status}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            ({batch.environment} environment)
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
        >
          Refresh Status
        </button>
      </div>
      <div className="text-xs text-slate-500">
        Batch {batch.batchTransferId} · {batch.employeeCount} employee(s) ·{" "}
        {money(batch.totalAmount)} total
      </div>

      {batch.skipped.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ {batch.skipped.length} employee(s) skipped:{" "}
          {batch.skipped
            .map((s) => `${s.employeeCode ?? s.employeeId} (${s.reason})`)
            .join("; ")}
        </div>
      )}

      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">Employee</th>
            <th className="py-1 text-right">Amount</th>
            <th className="py-1">Status</th>
            <th className="py-1">UTR</th>
          </tr>
        </thead>
        <tbody>
          {batch.transactions.map((t) => (
            <tr key={t.transferId} className="border-t border-slate-100">
              <td className="py-1">
                {t.employeeCode} — {t.employeeName}
              </td>
              <td className="py-1 text-right">{money(t.amount)}</td>
              <td className="py-1">
                <span
                  className={`rounded-full px-2 py-0.5 ${payoutStatusColor[t.status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {t.status}
                </span>
              </td>
              <td className="py-1">{t.utr ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PayrollRunsPage() {
  const { canManagePayroll } = useRole();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null);
  const [showCompliance, setShowCompliance] = useState(false);
  const [showPayoutConfirm, setShowPayoutConfirm] = useState(false);

  const runs = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: payrollService.listRuns,
  });
  const payslips = useQuery({
    queryKey: ["payroll-payslips", selectedRun?.id],
    queryFn: () => payrollService.payslipsForRun(selectedRun!.id),
    enabled: !!selectedRun,
  });
  const compliance = useQuery({
    queryKey: ["payroll-compliance", selectedRun?.id],
    queryFn: () => payrollService.complianceReport(selectedRun!.id),
    enabled: !!selectedRun && showCompliance,
  });

  const process = useMutation({
    mutationFn: () => payrollService.processRun(month, year),
    onSuccess: (run) => {
      toast.success(`Payroll processed for ${MONTH_NAMES[month - 1]} ${year}`);
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setSelectedRun(run);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't process payroll"),
  });

  const approve = useMutation({
    mutationFn: (id: number) => payrollService.approveRun(id),
    onSuccess: (run) => {
      toast.success("Payroll run approved");
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setSelectedRun(run);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't approve"),
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => payrollService.markRunPaid(id),
    onSuccess: (run) => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setSelectedRun(run);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't mark as paid"),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => payrollService.cancelRun(id),
    onSuccess: () => {
      toast.success("Payroll run cancelled");
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setSelectedRun(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't cancel"),
  });

  const initiatePayout = useMutation({
    mutationFn: (id: number) => payrollService.initiatePayout(id),
    onSuccess: () => {
      toast.success("Payout initiated via Cashfree");
      qc.invalidateQueries({ queryKey: ["payroll-payout", selectedRun?.id] });
      setShowPayoutConfirm(false);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? "Couldn't initiate payout");
      setShowPayoutConfirm(false);
    },
  });

  const refreshPayout = useMutation({
    mutationFn: (id: number) => payrollService.refreshPayoutStatus(id),
    onSuccess: () => {
      toast.success("Payout status refreshed");
      qc.invalidateQueries({ queryKey: ["payroll-payout", selectedRun?.id] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't refresh status"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Payroll Runs</h2>
        <p className="text-sm text-slate-500">
          Process, approve, and pay monthly payroll. DRAFT → PROCESSED →
          APPROVED → PAID. Marking a run PAID emails every employee their
          payslip PDF automatically.
        </p>
      </div>

      {canManagePayroll && (
        <div className="flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Month</span>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Year</span>
            <input
              type="number"
              className="w-24 rounded-lg border border-slate-200 px-3 py-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() => process.mutate()}
            disabled={process.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {process.isPending ? "Processing…" : "Process Payroll"}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Employees</th>
              <th className="px-4 py-2 text-right">Gross</th>
              <th className="px-4 py-2 text-right">Net</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((r) => (
              <tr
                key={r.id}
                className={`border-t border-slate-100 cursor-pointer ${selectedRun?.id === r.id ? "bg-indigo-50/50" : ""}`}
                onClick={() => {
                  setSelectedRun(r);
                  setShowCompliance(false);
                }}
              >
                <td className="px-4 py-2 font-medium text-slate-800">
                  {MONTH_NAMES[r.month - 1]} {r.year}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{r.employeeCount}</td>
                <td className="px-4 py-2 text-right">{money(r.totalGross)}</td>
                <td className="px-4 py-2 text-right">{money(r.totalNet)}</td>
                <td className="px-4 py-2 text-right text-xs text-indigo-600">
                  View →
                </td>
              </tr>
            ))}
            {runs.data?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No payroll runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRun && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              {MONTH_NAMES[selectedRun.month - 1]} {selectedRun.year} — Payslips
            </h3>
            <div className="flex gap-2">
              {canManagePayroll && selectedRun.status === "PROCESSED" && (
                <button
                  onClick={() => approve.mutate(selectedRun.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Approve
                </button>
              )}
              {canManagePayroll && selectedRun.status === "APPROVED" && (
                <button
                  onClick={() => setShowPayoutConfirm(true)}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Pay via Cashfree
                </button>
              )}
              {canManagePayroll && selectedRun.status === "APPROVED" && (
                <button
                  onClick={() => markPaid.mutate(selectedRun.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Mark Paid
                </button>
              )}
              {canManagePayroll &&
                ["DRAFT", "PROCESSED"].includes(selectedRun.status) && (
                  <button
                    onClick={() => cancel.mutate(selectedRun.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600"
                  >
                    Cancel Run
                  </button>
                )}
              <button
                onClick={() =>
                  payrollService.downloadRunExcel(
                    selectedRun.id,
                    `Salary_Register_${MONTH_NAMES[selectedRun.month - 1]}_${selectedRun.year}.xlsx`,
                  )
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                Export Excel
              </button>
              <button
                onClick={() => setShowCompliance((v) => !v)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {showCompliance ? "Hide" : "Show"} Compliance Report
              </button>
            </div>
          </div>

          {selectedRun.remarks && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ {selectedRun.remarks}
            </div>
          )}

          {["APPROVED", "PAID"].includes(selectedRun.status) && (
            <PayoutStatusPanel
              runId={selectedRun.id}
              onRefresh={() => refreshPayout.mutate(selectedRun.id)}
            />
          )}

          {showCompliance && compliance.data && (
            <div className="rounded-lg bg-slate-50 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">
                Compliance Totals
              </h4>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-slate-400">PF (Employee)</div>
                  <div className="font-medium">
                    {money(compliance.data.totalPfEmployee)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">PF (Employer)</div>
                  <div className="font-medium">
                    {money(compliance.data.totalPfEmployer)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Professional Tax</div>
                  <div className="font-medium">
                    {money(compliance.data.totalPt)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">TDS</div>
                  <div className="font-medium">
                    {money(compliance.data.totalTds)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Employee</th>
                <th className="py-1 text-right">Paid/Working Days</th>
                <th className="py-1 text-right">Gross</th>
                <th className="py-1 text-right">Deductions</th>
                <th className="py-1 text-right">Net Pay</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {(payslips.data ?? []).map((p) => (
                <PayslipRow
                  key={p.id}
                  p={p}
                  onView={() => setViewingPayslip(p)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingPayslip && (
        <PayslipDetailModal
          payslip={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}

      {showPayoutConfirm && selectedRun && (
        <PayoutConfirmModal
          run={selectedRun}
          isPending={initiatePayout.isPending}
          onConfirm={() => initiatePayout.mutate(selectedRun.id)}
          onClose={() => setShowPayoutConfirm(false)}
        />
      )}
    </div>
  );
}
