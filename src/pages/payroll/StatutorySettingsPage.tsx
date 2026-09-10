import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ResourcePage from "../../components/ResourcePage";
import { useRole } from "../../hooks/useRole";
import {
  payrollService,
  type PfSettings,
  type TaxSlab,
  type TaxSettings,
} from "../../services/payrollService";
import type { ResourceConfig } from "../../utils/types";

const ptConfig: ResourceConfig = {
  title: "Professional Tax Slabs",
  endpoint: "/payroll/statutory/pt",
  queryKey: "pt-slabs",
  columns: [
    { key: "state", label: "State" },
    { key: "gender", label: "Gender" },
    { key: "minSalary", label: "Min Salary" },
    { key: "maxSalary", label: "Max Salary" },
    { key: "monthlyAmount", label: "Monthly" },
    { key: "februaryAmount", label: "February" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "state", label: "State", type: "text", required: true },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: [
        { value: "ALL", label: "All" },
        { value: "MALE", label: "Male" },
        { value: "FEMALE", label: "Female" },
      ],
    },
    {
      name: "minSalary",
      label: "Min Salary (Rs.)",
      type: "number",
      required: true,
    },
    {
      name: "maxSalary",
      label: "Max Salary (Rs.) — leave blank for no upper bound",
      type: "number",
    },
    {
      name: "monthlyAmount",
      label: "Monthly Amount (Rs.)",
      type: "number",
      required: true,
    },
    {
      name: "februaryAmount",
      label: "February Amount (Rs.) — leave blank to match Monthly",
      type: "number",
    },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

function PfSettingsCard() {
  const { canManagePayroll } = useRole();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pf-settings-current"],
    queryFn: payrollService.pfCurrent,
  });
  const [form, setForm] = useState<Partial<PfSettings> | null>(null);
  const active = form ?? data;

  const save = useMutation({
    mutationFn: (body: PfSettings) => payrollService.updatePf(body),
    onSuccess: () => {
      toast.success("PF settings saved as a new revision");
      qc.invalidateQueries({ queryKey: ["pf-settings-current"] });
      setForm(null);
    },
    onError: () => toast.error("Couldn't save PF settings"),
  });

  if (isLoading || !active) {
    return <div className="text-sm text-slate-400">Loading PF settings…</div>;
  }

  const field = (key: keyof PfSettings, label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        step="0.01"
        disabled={!canManagePayroll}
        className="rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
        value={(active as any)[key] ?? ""}
        onChange={(e) =>
          setForm({ ...(active as PfSettings), [key]: Number(e.target.value) })
        }
      />
    </label>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800">
          Provident Fund (EPFO)
        </h3>
        <p className="text-sm text-slate-500">
          Employee PF = Employee % × min(Basic, Wage Ceiling). Saving here
          creates a new dated revision rather than editing history in place.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {field("employeeRatePercent", "Employee Rate (%)")}
        {field("employerRatePercent", "Employer Rate (%)")}
        {field("epsRatePercent", "EPS Rate (%)")}
        {field("wageCeiling", "Wage Ceiling (Rs.)")}
        {field("epsWageCeiling", "EPS Wage Ceiling (Rs.)")}
      </div>
      {canManagePayroll && (
        <button
          onClick={() => save.mutate(active as PfSettings)}
          disabled={save.isPending || !form}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save as new revision"}
        </button>
      )}
    </div>
  );
}

function currentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
}

function TaxSlabsCard() {
  const { canManagePayroll } = useRole();
  const qc = useQueryClient();
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [regime, setRegime] = useState<"NEW" | "OLD">("NEW");
  const [slabRows, setSlabRows] = useState<TaxSlab[] | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<TaxSettings> | null>(
    null,
  );

  const slabsQuery = useQuery({
    queryKey: ["tax-slabs", financialYear, regime],
    queryFn: () => payrollService.taxSlabs(financialYear, regime),
  });
  const settingsQuery = useQuery({
    queryKey: ["tax-settings", financialYear],
    queryFn: () => payrollService.taxSettings(financialYear),
  });

  const slabs = slabRows ?? slabsQuery.data ?? [];
  const settings = settingsForm ?? settingsQuery.data;

  const saveSlabs = useMutation({
    mutationFn: () =>
      payrollService.replaceTaxSlabs(financialYear, regime, slabs),
    onSuccess: () => {
      toast.success(
        `Tax slabs saved for FY ${financialYear} (${regime} regime)`,
      );
      qc.invalidateQueries({ queryKey: ["tax-slabs", financialYear, regime] });
      setSlabRows(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't save tax slabs"),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      payrollService.upsertTaxSettings({
        ...(settings as TaxSettings),
        financialYear,
      }),
    onSuccess: () => {
      toast.success(`Tax settings saved for FY ${financialYear}`);
      qc.invalidateQueries({ queryKey: ["tax-settings", financialYear] });
      setSettingsForm(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't save tax settings"),
  });

  const updateRow = (idx: number, patch: Partial<TaxSlab>) => {
    setSlabRows(slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addRow = () => {
    const lastTo = slabs.length > 0 ? slabs[slabs.length - 1].toAmount : 0;
    setSlabRows([
      ...slabs,
      {
        financialYear,
        regime,
        fromAmount: lastTo ?? 0,
        toAmount: null,
        ratePercent: 0,
      },
    ]);
  };
  const removeRow = (idx: number) =>
    setSlabRows(slabs.filter((_, i) => i !== idx));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800">
          Income Tax (TDS) Slabs
        </h3>
        <p className="text-sm text-slate-500">
          Used to estimate monthly TDS under Section 192. Slabs are per
          financial year — a Budget change means adding new slabs here, not a
          code deploy.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          Note: only the NEW regime is actually used by the payroll calculation
          engine right now. OLD-regime slabs can be recorded here for reference,
          but employees on the OLD regime still need a manual TDS override on
          their salary record (Employee Salary page) — the
          investment-declaration workflow (80C/HRA proofs) isn't built yet.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Financial Year</span>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            placeholder="2026-27"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Regime</span>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={regime}
            onChange={(e) => setRegime(e.target.value as "NEW" | "OLD")}
          >
            <option value="NEW">New Regime</option>
            <option value="OLD">Old Regime (reference only)</option>
          </select>
        </label>
      </div>

      {slabsQuery.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Slab Bands (annual taxable income)
            </span>
            {canManagePayroll && (
              <button
                onClick={addRow}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                + Add band
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">From (Rs.)</th>
                <th className="py-1">To (Rs.) — blank = no upper bound</th>
                <th className="py-1">Rate (%)</th>
                {canManagePayroll && <th className="py-1"></th>}
              </tr>
            </thead>
            <tbody>
              {slabs.map((s, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      disabled={!canManagePayroll}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={s.fromAmount}
                      onChange={(e) =>
                        updateRow(idx, { fromAmount: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      disabled={!canManagePayroll}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={s.toAmount ?? ""}
                      onChange={(e) =>
                        updateRow(idx, {
                          toAmount:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      disabled={!canManagePayroll}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={s.ratePercent}
                      onChange={(e) =>
                        updateRow(idx, { ratePercent: Number(e.target.value) })
                      }
                    />
                  </td>
                  {canManagePayroll && (
                    <td className="py-1">
                      <button
                        onClick={() => removeRow(idx)}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {slabs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-400">
                    No slabs configured for FY {financialYear} ({regime}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {canManagePayroll && (
            <button
              onClick={() => saveSlabs.mutate()}
              disabled={saveSlabs.isPending || slabs.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saveSlabs.isPending ? "Saving…" : "Save Slabs"}
            </button>
          )}
        </div>
      )}

      {settingsQuery.isLoading || !settings ? (
        <div className="text-sm text-slate-400">Loading settings…</div>
      ) : (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <span className="text-sm font-medium text-slate-700">
            Deduction / Rebate Settings
          </span>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(
              [
                ["standardDeduction", "Standard Deduction (Rs.)"],
                ["rebate87aIncomeLimit", "Sec 87A Income Limit (Rs.)"],
                ["rebate87aAmount", "Sec 87A Rebate Amount (Rs.)"],
                ["cessPercent", "Health & Education Cess (%)"],
              ] as [keyof TaxSettings, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-slate-600">{label}</span>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canManagePayroll}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                  value={(settings as any)[key] ?? ""}
                  onChange={(e) =>
                    setSettingsForm({
                      ...(settings as TaxSettings),
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {canManagePayroll && (
            <button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending || !settingsForm}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saveSettings.isPending ? "Saving…" : "Save Settings"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function StatutorySettingsPage() {
  const { canManagePayroll } = useRole();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Statutory Settings
        </h2>
        <p className="text-sm text-slate-500">
          PF, Professional Tax, and income-tax rules used by every payroll run.
          These change by government notification — review periodically rather
          than assuming they're permanent.
        </p>
      </div>
      <PfSettingsCard />
      <div>
        <ResourcePage config={ptConfig} permissionOverride={canManagePayroll} />
      </div>
      <TaxSlabsCard />
    </div>
  );
}
