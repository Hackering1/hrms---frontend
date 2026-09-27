import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Select as AntSelect } from "antd";
import toast from "react-hot-toast";
import { useRole } from "../../hooks/useRole";
import { resourceService } from "../../services/resourceService";
import { apiClient } from "../../services/apiClient";
import {
  payrollService,
  type Payslip,
  type PayrollAdjustment,
} from "../../services/payrollService";
import type { ApiResponse, ResourceRecord } from "../../utils/types";

/**
 * Payroll → Payslip Generator
 *
 * This page does NOT calculate payroll and does NOT introduce a second
 * payslip system. It only:
 *  - looks up an already-generated Payslip for an employee + existing
 *    Payroll Run (via the existing `payslipsForEmployee` API), or
 *  - if none exists yet, lets HR add one-off lines via the existing
 *    Payroll Adjustments API and then calls ONE new backend endpoint
 *    (POST /api/payroll/payslip-generator/runs/{runId}/employees/{employeeId})
 *    which itself delegates all payroll math to the existing
 *    PayrollCalculationService and all response formatting to the existing
 *    PayslipService — see PayslipGeneratorService.java.
 *
 * Every other field shown here (Basic/HRA/PF/PT/TDS/bank details/etc.) comes
 * straight from the existing, authoritative HRMS data and is read-only.
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

const COMPANY_NAME_LINE_1 = "TechNext Technologies and";
const COMPANY_NAME_LINE_2 = "Services Private Limited";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

// Pure text formatting only — not a payroll calculation.
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

function PayslipPreview({
  payslip,
  employee,
  previewRef,
}: {
  payslip: Payslip;
  employee: ResourceRecord;
  previewRef: React.RefObject<HTMLDivElement | null>;
}) {
  const employeeName =
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() ||
    payslip.employeeName ||
    "—";

  return (
    <div
      ref={previewRef}
      className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 text-slate-800"
    >
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

export default function PayslipGeneratorPage() {
  const { canManagePayroll } = useRole();
  const qc = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);

  const [employeeId, setEmployeeId] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>();
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjType, setAdjType] = useState<"EARNING" | "DEDUCTION">("EARNING");

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const runs = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: payrollService.listRuns,
  });
  const payslips = useQuery({
    queryKey: ["payslip-generator-employee", employeeId],
    queryFn: () => payrollService.payslipsForEmployee(employeeId),
    enabled: !!employeeId,
  });

  const employee = useMemo(
    () =>
      (employees.data ?? []).find(
        (e: ResourceRecord) => String(e.id) === employeeId,
      ),
    [employees.data, employeeId],
  );
  const selectedRun = useMemo(
    () => (runs.data ?? []).find((r) => r.id === selectedRunId),
    [runs.data, selectedRunId],
  );
  const existingPayslip = useMemo(
    () => (payslips.data ?? []).find((p) => p.payrollRunId === selectedRunId),
    [payslips.data, selectedRunId],
  );

  const adjustments = useQuery({
    queryKey: [
      "payslip-generator-adjustments",
      employeeId,
      selectedRun?.month,
      selectedRun?.year,
    ],
    queryFn: () =>
      payrollService.adjustmentsForEmployeeMonth(
        employeeId,
        selectedRun!.year,
        selectedRun!.month,
      ),
    enabled: !!employeeId && !!selectedRun && !existingPayslip,
  });

  const addAdjustment = useMutation({
    mutationFn: () =>
      payrollService.createAdjustment({
        employeeId,
        month: selectedRun!.month,
        year: selectedRun!.year,
        adjustmentType: adjType,
        label: adjLabel.trim(),
        amount: Number(adjAmount),
      } as PayrollAdjustment),
    onSuccess: () => {
      toast.success("Added");
      setAdjLabel("");
      setAdjAmount("");
      qc.invalidateQueries({ queryKey: ["payslip-generator-adjustments"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't add that line"),
  });

  const removeAdjustment = useMutation({
    mutationFn: (id: number) => payrollService.deleteAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslip-generator-adjustments"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't remove that line"),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<Payslip>>(
        `/payroll/payslip-generator/runs/${selectedRun!.id}/employees/${employeeId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success("Payslip generated");
      qc.invalidateQueries({
        queryKey: ["payslip-generator-employee", employeeId],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't generate payslip"),
  });

  const handleDownload = async () => {
    if (!existingPayslip) return;
    const fileName =
      `Payslip_${employee?.firstName ?? ""}_${employee?.lastName ?? ""}_${MONTH_NAMES[existingPayslip.month - 1]}_${existingPayslip.year}.pdf`.replace(
        /\s+/g,
        "_",
      );
    try {
      await payrollService.downloadPayslipPdf(existingPayslip.id, fileName);
    } catch {
      toast.error("Couldn't download the payslip PDF");
    }
  };

  const handleResendEmail = async () => {
    if (!existingPayslip) return;
    try {
      await payrollService.resendPayslipEmail(existingPayslip.id);
      toast.success("Payslip email queued for resend");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ?? "Couldn't resend the payslip email",
      );
    }
  };

  // Self-contained popup-window print — doesn't touch MainLayout/app chrome.
  const handlePrint = () => {
    if (!previewRef.current) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page { margin: 8mm; size: A4; }
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: white; }
      </style></head><body>${previewRef.current.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const runLocked =
    selectedRun?.status === "APPROVED" || selectedRun?.status === "PAID";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Payslip Generator
        </h2>
        <p className="text-sm text-slate-500">
          Pick an employee and an existing payroll run to view their payslip, or
          generate one if it wasn't produced by that run.
        </p>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
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
              setSelectedRunId(undefined);
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
            Payroll run
          </label>
          <AntSelect
            style={{ width: "100%" }}
            disabled={!employeeId}
            value={selectedRunId}
            onChange={(v) => setSelectedRunId(v)}
            placeholder={
              employeeId
                ? "— Select a payroll run —"
                : "Select an employee first"
            }
            options={(runs.data ?? []).map((r) => ({
              value: r.id,
              label: `${MONTH_NAMES[r.month - 1]} ${r.year} · ${r.status}`,
            }))}
          />
        </div>
      </div>

      {employeeId && selectedRun && existingPayslip && employee && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownload}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Download PDF
            </button>
            <button
              onClick={handlePrint}
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
          <PayslipPreview
            payslip={existingPayslip}
            employee={employee}
            previewRef={previewRef}
          />
        </>
      )}

      {employeeId && selectedRun && !existingPayslip && employee && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              Employee (read-only)
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field
                label="Employee Name"
                value={`${employee.firstName ?? ""} ${employee.lastName ?? ""}`}
              />
              <Field label="Employee ID" value={employee.employeeCode} mono />
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
            <p className="mt-3 text-xs text-slate-400">
              No payslip exists yet for {MONTH_NAMES[selectedRun.month - 1]}{" "}
              {selectedRun.year} under this run. Basic, HRA, PF, PT, TDS and net
              pay will be computed by the same payroll engine as a normal
              Payroll Run once you click Generate below — they are not editable
              here.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              One-off additions (optional)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              e.g. a bonus, incentive, reimbursement, or one-off deduction for
              this employee this month. Only these lines are editable.
            </p>
            <ul className="mb-3 space-y-1">
              {(adjustments.data ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-1.5 text-sm"
                >
                  <span>
                    {a.label}{" "}
                    <span className="text-xs text-slate-400">
                      ({a.adjustmentType.toLowerCase()})
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono">{money(a.amount)}</span>
                    <button
                      onClick={() => a.id && removeAdjustment.mutate(a.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
              {(adjustments.data ?? []).length === 0 && (
                <li className="text-xs text-slate-400">None added yet.</li>
              )}
            </ul>
            <div className="grid grid-cols-4 gap-2">
              <input
                className="col-span-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Label (e.g. Diwali Bonus)"
                value={adjLabel}
                onChange={(e) => setAdjLabel(e.target.value)}
              />
              <input
                type="number"
                className="col-span-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Amount"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
              />
              <select
                className="col-span-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as any)}
              >
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </div>
            <button
              disabled={
                !adjLabel.trim() || !adjAmount || addAdjustment.isPending
              }
              onClick={() => addAdjustment.mutate()}
              className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              + Add line
            </button>
          </div>

          {runLocked && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This run is {selectedRun.status} — payslips can no longer be added
              to it.
            </p>
          )}

          <button
            disabled={runLocked || generate.isPending}
            onClick={() => generate.mutate()}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {generate.isPending ? "Generating…" : "Generate Payslip"}
          </button>
        </div>
      )}
    </div>
  );
}
