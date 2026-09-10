import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select as AntSelect } from "antd";
import toast from "react-hot-toast";
import { useRole } from "../../hooks/useRole";
import { resourceService } from "../../services/resourceService";
import {
  payrollService,
  type SalaryStructure,
} from "../../services/payrollService";
import type { ResourceRecord } from "../../utils/types";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function EmployeeSalaryPage() {
  const { canManagePayroll } = useRole();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const qc = useQueryClient();

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const structures = useQuery({
    queryKey: ["salary-structures"],
    queryFn: payrollService.listStructures,
  });

  const current = useQuery({
    queryKey: ["employee-salary-current", employeeId],
    queryFn: () => payrollService.currentSalary(employeeId),
    enabled: !!employeeId,
  });
  const history = useQuery({
    queryKey: ["employee-salary-history", employeeId],
    queryFn: () => payrollService.salaryHistory(employeeId),
    enabled: !!employeeId,
  });

  const [form, setForm] = useState<{
    salaryStructureId?: number;
    annualCtc?: number;
    effectiveFrom: string;
    taxRegime: "NEW" | "OLD";
    pfApplicable: boolean;
    ptApplicable: boolean;
    tdsOverrideMonthly?: number;
  }>({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    taxRegime: "NEW",
    pfApplicable: true,
    ptApplicable: true,
  });

  const assign = useMutation({
    mutationFn: () =>
      payrollService.assignSalary({
        employeeId,
        salaryStructureId: form.salaryStructureId!,
        annualCtc: form.annualCtc!,
        effectiveFrom: form.effectiveFrom,
        taxRegime: form.taxRegime,
        pfApplicable: form.pfApplicable,
        ptApplicable: form.ptApplicable,
        tdsOverrideMonthly: form.tdsOverrideMonthly ?? null,
      }),
    onSuccess: () => {
      toast.success("Salary assigned");
      qc.invalidateQueries({
        queryKey: ["employee-salary-current", employeeId],
      });
      qc.invalidateQueries({
        queryKey: ["employee-salary-history", employeeId],
      });
      setShowAssignForm(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't assign salary"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Employee Salary
        </h2>
        <p className="text-sm text-slate-500">
          Assign a CTC and salary structure to an employee, and review their pay
          breakup.
        </p>
      </div>

      <div className="max-w-md">
        <AntSelect
          style={{ width: "100%" }}
          showSearch
          optionFilterProp="label"
          value={employeeId || undefined}
          onChange={(v) => setEmployeeId(v)}
          placeholder="— Select employee —"
          options={(employees.data ?? []).map((e: ResourceRecord) => ({
            value: String(e.id),
            label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
          }))}
        />
      </div>

      {employeeId && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                Current Salary
              </h3>
              {canManagePayroll && (
                <button
                  onClick={() => setShowAssignForm((v) => !v)}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  {current.data ? "Revise / Assign New" : "Assign Salary"}
                </button>
              )}
            </div>

            {current.data ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-slate-400">Structure</div>
                    <div className="font-medium">
                      {current.data.salaryStructureName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Annual CTC</div>
                    <div className="font-medium">
                      {money(current.data.annualCtc)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Monthly Gross</div>
                    <div className="font-medium">
                      {money(current.data.monthlyGross)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Tax Regime</div>
                    <div className="font-medium">{current.data.taxRegime}</div>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1">Component</th>
                      <th className="py-1">Type</th>
                      <th className="py-1 text-right">Monthly</th>
                      <th className="py-1 text-right">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.data.components.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5">{c.componentName}</td>
                        <td className="py-1.5 text-slate-500">
                          {c.componentType}
                        </td>
                        <td className="py-1.5 text-right">
                          {money(c.monthlyAmount)}
                        </td>
                        <td className="py-1.5 text-right">
                          {money(c.annualAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-400">
                  Statutory deductions (PF/PT/TDS) aren't shown here — they're
                  computed per payroll run, not part of the static structure.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                No active salary assigned yet.
              </p>
            )}
          </div>

          {showAssignForm && canManagePayroll && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-base font-semibold text-slate-800">
                Assign / Revise Salary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">Salary Structure *</span>
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={form.salaryStructureId ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        salaryStructureId: Number(e.target.value),
                      })
                    }
                  >
                    <option value="">— Select —</option>
                    {(structures.data ?? []).map((s: SalaryStructure) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">Annual CTC (Rs.) *</span>
                  <input
                    type="number"
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={form.annualCtc ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, annualCtc: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">Effective From *</span>
                  <input
                    type="date"
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={form.effectiveFrom}
                    onChange={(e) =>
                      setForm({ ...form, effectiveFrom: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">Tax Regime</span>
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={form.taxRegime}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        taxRegime: e.target.value as "NEW" | "OLD",
                      })
                    }
                  >
                    <option value="NEW">
                      New Regime (computed automatically)
                    </option>
                    <option value="OLD">
                      Old Regime (requires manual TDS override below)
                    </option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.pfApplicable}
                    onChange={(e) =>
                      setForm({ ...form, pfApplicable: e.target.checked })
                    }
                  />
                  PF Applicable
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.ptApplicable}
                    onChange={(e) =>
                      setForm({ ...form, ptApplicable: e.target.checked })
                    }
                  />
                  PT Applicable
                </label>
                <label className="flex flex-col gap-1 text-sm col-span-2">
                  <span className="text-slate-600">
                    Manual Monthly TDS Override (Rs.) — optional; required for
                    Old Regime
                  </span>
                  <input
                    type="number"
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={form.tdsOverrideMonthly ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tdsOverrideMonthly: Number(e.target.value) || undefined,
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAssignForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => assign.mutate()}
                  disabled={
                    !form.salaryStructureId ||
                    !form.annualCtc ||
                    assign.isPending
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {assign.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {(history.data?.length ?? 0) > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-800 mb-2">
                Salary History
              </h3>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1">Structure</th>
                    <th className="py-1 text-right">Annual CTC</th>
                    <th className="py-1">From</th>
                    <th className="py-1">To</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data!.map((h) => (
                    <tr key={h.id} className="border-t border-slate-100">
                      <td className="py-1.5">{h.salaryStructureName}</td>
                      <td className="py-1.5 text-right">
                        {money(h.annualCtc)}
                      </td>
                      <td className="py-1.5">{h.effectiveFrom}</td>
                      <td className="py-1.5">{h.effectiveTo ?? "Current"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
