import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { selfService } from "../../services/selfService";
import { payrollService, type Payslip } from "../../services/payrollService";

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

export default function MyPayslipsPage() {
  const [viewing, setViewing] = useState<Payslip | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });
  const payslips = useQuery({
    queryKey: ["my-payslips", me.data?.id],
    queryFn: () => payrollService.payslipsForEmployee(me.data!.id!),
    enabled: !!me.data?.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">My Payslips</h2>
        <p className="text-sm text-slate-500">Your payslip history.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2 text-right">Gross</th>
              <th className="px-4 py-2 text-right">Deductions</th>
              <th className="px-4 py-2 text-right">Net Pay</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(payslips.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td className="px-4 py-2 text-right">
                  {money(p.grossEarnings)}
                </td>
                <td className="px-4 py-2 text-right">
                  {money(p.totalDeductions)}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {money(p.netPay)}
                </td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setViewing(p)}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {payslips.data?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                {MONTH_NAMES[viewing.month - 1]} {viewing.year}
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    payrollService.downloadPayslipPdf(
                      viewing.id,
                      `Payslip_${MONTH_NAMES[viewing.month - 1]}_${viewing.year}.pdf`,
                    )
                  }
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setViewing(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-slate-400">Working Days</div>
                <div className="font-medium">{viewing.workingDays}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-slate-400">Paid Days</div>
                <div className="font-medium">{viewing.paidDays}</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-3">
                <div className="text-rose-500">LOP Days</div>
                <div className="font-medium text-rose-700">
                  {viewing.lopDays}
                </div>
              </div>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {viewing.earnings.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{l.name}</td>
                    <td className="py-1 text-right">{money(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-medium">
                  <td className="py-1">Gross Earnings</td>
                  <td className="py-1 text-right">
                    {money(viewing.grossEarnings)}
                  </td>
                </tr>
                {viewing.deductions.map((l, i) => (
                  <tr key={"d" + i} className="border-t border-slate-100">
                    <td className="py-1">{l.name}</td>
                    <td className="py-1 text-right">-{money(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-medium">
                  <td className="py-1">Total Deductions</td>
                  <td className="py-1 text-right">
                    {money(viewing.totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="rounded-lg bg-emerald-50 p-3 flex items-center justify-between">
              <span className="font-semibold text-emerald-800">Net Pay</span>
              <span className="text-lg font-bold text-emerald-800">
                {money(viewing.netPay)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
