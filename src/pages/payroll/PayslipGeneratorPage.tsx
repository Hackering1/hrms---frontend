import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select as AntSelect } from "antd";
import toast from "react-hot-toast";
import { useRole } from "../../hooks/useRole";
import { resourceService } from "../../services/resourceService";
import { payrollService, type Payslip } from "../../services/payrollService";
import type { ResourceRecord } from "../../utils/types";

/**
 * Payroll → Payslip Generator
 *
 * IMPORTANT: this page does NOT calculate payroll. It is a document/presentation
 * layer only — it looks up an already-generated Payslip (created when a Payroll
 * Run is processed, see PayrollRunsPage) for a chosen employee + period, and
 * renders it using the visual layout adapted from the uploaded Payslip
 * Generator design. Every number shown comes straight from the existing
 * `payrollService.payslipsForEmployee` API (same data PayrollRunsPage already
 * shows per-run). Download/Print/Resend reuse the existing PDF and email
 * endpoints — there is no second PDF engine and no second payroll engine here.
 */

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

// Company identity shown on the preview matches the existing branded PDF
// (PayslipPdfService.java hardcodes the same name today — no company-settings
// API exists yet to source this from, so this mirrors the existing precedent
// rather than inventing a new one).
const COMPANY_NAME_LINE_1 = "TechNext Technologies and";
const COMPANY_NAME_LINE_2 = "Services Private Limited";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

// Ported from the uploaded Payslip Generator's lib/payslip-utils.ts
// (numberToWords) — pure formatting, no payroll logic.
function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const scales = [
    { value: 10000000, name: "Crore" },
    { value: 100000, name: "Lakh" },
    { value: 1000, name: "Thousand" },
    { value: 100, name: "Hundred" },
  ];

  function convertLessThanThousand(n: number): string {
    let result = "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;

    if (h > 0) result += ones[h] + " Hundred";
    if (t >= 2) {
      if (result) result += " ";
      result += tens[t];
      if (u > 0) result += " " + ones[u];
    } else if (t === 1) {
      if (result) result += " ";
      result += teens[u];
    } else if (u > 0) {
      if (result) result += " ";
      result += ones[u];
    }
    return result;
  }

  let absNum = Math.floor(num);
  let result = "";
  for (const scale of scales) {
    if (absNum >= scale.value) {
      const scaleVal = Math.floor(absNum / scale.value);
      result += convertLessThanThousand(scaleVal) + " " + scale.name + " ";
      absNum = absNum % scale.value;
    }
  }
  if (absNum > 0) {
    if (result) result += " ";
    result += convertLessThanThousand(absNum);
  }
  return result.trim() + " Only";
}

function PayslipPreview({
  payslip,
  employee,
}: {
  payslip: Payslip;
  employee: ResourceRecord;
}) {
  const employeeName =
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() ||
    payslip.employeeName ||
    "—";

  return (
    <div
      id="payslip-print-area"
      className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-800"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 border-b-2 border-slate-200 pb-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-snug text-slate-900">
            {COMPANY_NAME_LINE_1}
            <br />
            {COMPANY_NAME_LINE_2}
          </h1>
          {employee.branchName && (
            <p className="mt-2 text-xs text-slate-500">{employee.branchName}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <h2 className="text-sm font-bold text-slate-900">
            Payslip For the Month
          </h2>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {MONTH_NAMES[payslip.month - 1]} {payslip.year}
          </p>
        </div>
      </div>

      {/* Employee summary + net pay */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-bold text-slate-900">
            Employee Summary
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Employee Name" value={employeeName} />
            <Field label="Employee ID" value={payslip.employeeCode} mono />
            <Field label="Designation" value={employee.designationName} />
            <Field label="Department" value={employee.departmentName} />
            <Field label="Date of Joining" value={employee.dateOfJoining} />
            <Field label="Work Location" value={employee.branchName} />
            <Field label="Bank Name" value={employee.bankName} />
            <Field
              label="Bank Account Number"
              value={employee.bankAccountNumber}
              mono
            />
            <Field label="UAN Number" value={employee.uanNumber} mono />
            <Field label="PAN Number" value={employee.panNumber} mono />
          </div>
        </div>
        <div className="col-span-1 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-center">
          <p className="text-xs font-semibold text-emerald-700">Paid Days</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {payslip.paidDays}
          </p>
          <div className="my-3 border-t border-emerald-200" />
          <p className="text-xs font-semibold text-emerald-700">LOP Days</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {payslip.lopDays}
          </p>
          <div className="my-3 border-t border-emerald-200" />
          <p className="text-xs font-semibold text-emerald-700">
            Total Net Pay
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {money(payslip.netPay)}
          </p>
        </div>
      </div>

      {/* Earnings & deductions */}
      <div className="mb-3 rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-4">
          <LineTable title="Earnings" lines={payslip.earnings} />
          <LineTable title="Deductions" lines={payslip.deductions} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 border-t border-slate-200 pt-2 text-xs font-bold text-slate-900">
          <div className="flex justify-between">
            <span>Gross Earnings</span>
            <span>{money(payslip.grossEarnings)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Deductions</span>
            <span>{money(payslip.totalDeductions)}</span>
          </div>
        </div>
      </div>

      {payslip.employerContributions.length > 0 && (
        <div className="mb-3 rounded-lg border border-slate-200 p-3">
          <LineTable
            title="Employer Contributions"
            lines={payslip.employerContributions}
          />
        </div>
      )}

      <div className="mb-2 border-t-2 border-slate-300 pt-2 text-center">
        <p className="text-sm font-bold text-slate-900">
          Total Net Payable = Gross Earnings − Total Deductions ={" "}
          <span className="font-mono">{money(payslip.netPay)}</span>
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600">
          Amount In Words:{" "}
          <span className="text-sm font-semibold text-slate-900">
            Indian Rupee {numberToWords(Math.round(payslip.netPay))}
          </span>
        </p>
      </div>

      <div className="border-t border-slate-200 pt-3 text-center">
        <p className="text-xs text-slate-500">
          This is a system-generated document.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-0.5 font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function LineTable({
  title,
  lines,
}: {
  title: string;
  lines: { name: string; amount: number }[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold text-slate-900">{title}</h4>
      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-2 text-xs font-bold text-slate-500">
        <div>Description</div>
        <div className="text-right">Amount</div>
      </div>
      {lines.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">None</p>
      ) : (
        lines.map((l, i) => (
          <div
            key={i}
            className="grid grid-cols-2 gap-4 py-2 text-xs text-slate-800"
          >
            <div>{l.name}</div>
            <div className="text-right font-mono">{money(l.amount)}</div>
          </div>
        ))
      )}
    </div>
  );
}

export default function PayslipGeneratorPage() {
  const { canManagePayroll } = useRole();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [selectedPayslipId, setSelectedPayslipId] = useState<
    number | undefined
  >();

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });

  const employee = useMemo(
    () =>
      (employees.data ?? []).find(
        (e: ResourceRecord) => String(e.id) === employeeId,
      ),
    [employees.data, employeeId],
  );

  const payslips = useQuery({
    queryKey: ["payslip-generator", employeeId],
    queryFn: () => payrollService.payslipsForEmployee(employeeId),
    enabled: !!employeeId,
  });

  const sortedPayslips = useMemo(
    () =>
      [...(payslips.data ?? [])].sort(
        (a, b) => b.year - a.year || b.month - a.month,
      ),
    [payslips.data],
  );

  const payslip =
    sortedPayslips.find((p) => p.id === selectedPayslipId) ?? sortedPayslips[0];

  const handleDownload = async () => {
    if (!payslip) return;
    const fileName =
      `Payslip_${employee?.firstName ?? ""}_${employee?.lastName ?? ""}_${MONTH_NAMES[payslip.month - 1]}_${payslip.year}.pdf`.replace(
        /\s+/g,
        "_",
      );
    try {
      await payrollService.downloadPayslipPdf(payslip.id, fileName);
    } catch {
      toast.error("Couldn't download the payslip PDF");
    }
  };

  const handleResendEmail = async () => {
    if (!payslip) return;
    try {
      await payrollService.resendPayslipEmail(payslip.id);
      toast.success("Payslip email queued for resend");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ?? "Couldn't resend the payslip email",
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-slate-800">
          Payslip Generator
        </h2>
        <p className="text-sm text-slate-500">
          Pick an employee and a pay period to preview, download or resend a
          payslip that's already been generated by a Payroll Run.
        </p>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2 print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Employee
          </label>
          <AntSelect
            style={{ width: "100%" }}
            showSearch
            optionFilterProp="label"
            value={employeeId || undefined}
            onChange={(v) => {
              setEmployeeId(v);
              setSelectedPayslipId(undefined);
            }}
            placeholder="— Select employee —"
            options={(employees.data ?? []).map((e: ResourceRecord) => ({
              value: String(e.id),
              label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
            }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Pay period
          </label>
          <AntSelect
            style={{ width: "100%" }}
            disabled={!employeeId || sortedPayslips.length === 0}
            value={payslip?.id}
            onChange={(v) => setSelectedPayslipId(v)}
            placeholder={
              employeeId ? "— Select period —" : "Select an employee first"
            }
            options={sortedPayslips.map((p) => ({
              value: p.id,
              label: `${MONTH_NAMES[p.month - 1]} ${p.year}${
                p.status !== "PAID" ? ` (${p.status})` : ""
              }`,
            }))}
          />
        </div>
      </div>

      {employeeId && !payslips.isLoading && sortedPayslips.length === 0 && (
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 print:hidden">
          No payslips found for this employee yet — a payslip appears here once
          a Payroll Run that includes them has been processed under Payroll →
          Payroll Runs.
        </div>
      )}

      {payslip && employee && (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              onClick={handleDownload}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Print
            </button>
            {canManagePayroll && (
              <button
                onClick={handleResendEmail}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Resend Email
              </button>
            )}
          </div>

          <PayslipPreview payslip={payslip} employee={employee} />
        </>
      )}
    </div>
  );
}
