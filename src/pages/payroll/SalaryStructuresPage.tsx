import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRole } from "../../hooks/useRole";
import { resourceService } from "../../services/resourceService";
import {
  payrollService,
  type SalaryComponent,
  type SalaryStructure,
  type SalaryStructureComponentLine,
} from "../../services/payrollService";

const CALC_TYPES = [
  { value: "PERCENT_OF_CTC", label: "% of CTC" },
  { value: "PERCENT_OF_BASIC", label: "% of Basic" },
  { value: "FLAT", label: "Flat amount" },
  { value: "REMAINDER", label: "Remainder of CTC" },
];

function emptyLine(componentId: number): SalaryStructureComponentLine {
  return {
    salaryComponentId: componentId,
    calculationType: "FLAT",
    displayOrder: 0,
  };
}

function StructureEditor({
  structure,
  components,
  onClose,
}: {
  structure: SalaryStructure | null;
  components: SalaryComponent[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(structure?.name ?? "");
  const [description, setDescription] = useState(structure?.description ?? "");
  const [lines, setLines] = useState<SalaryStructureComponentLine[]>(
    structure?.components.map((c) => ({ ...c })) ?? [],
  );

  // Only non-statutory EARNING components belong in the CTC split — PF/PT/TDS
  // are computed per payroll run, not part of a static structure.
  const earningComponents = components.filter(
    (c) => c.componentType === "EARNING" && !c.isStatutory,
  );

  const save = useMutation({
    mutationFn: () => {
      const body: SalaryStructure = {
        name,
        description,
        isActive: true,
        components: lines,
      };
      return structure?.id
        ? payrollService.updateStructure(structure.id, body)
        : payrollService.createStructure(body);
    },
    onSuccess: () => {
      toast.success(structure ? "Structure updated" : "Structure created");
      qc.invalidateQueries({ queryKey: ["salary-structures"] });
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't save the structure"),
  });

  const addLine = () => {
    const unused = earningComponents.find(
      (c) => !lines.some((l) => l.salaryComponentId === c.id),
    );
    if (!unused) {
      toast.error(
        "Every available earning component is already on this structure.",
      );
      return;
    }
    setLines([...lines, emptyLine(unused.id!)]);
  };

  const updateLine = (
    idx: number,
    patch: Partial<SalaryStructureComponentLine>,
  ) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) =>
    setLines(lines.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 space-y-5">
        <h3 className="text-lg font-semibold text-slate-800">
          {structure ? "Edit Salary Structure" : "New Salary Structure"}
        </h3>

        <div className="grid gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Name *</span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Description</span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Components
            </span>
            <button
              onClick={addLine}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              + Add component
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Order matters: Basic (% of CTC) is resolved first, then % of Basic
            (e.g. HRA), then flat amounts, then one Remainder component absorbs
            whatever's left of the CTC.
          </p>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const comp = components.find(
                (c) => c.id === line.salaryComponentId,
              );
              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2"
                >
                  <select
                    className="col-span-4 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    value={line.salaryComponentId}
                    onChange={(e) =>
                      updateLine(idx, {
                        salaryComponentId: Number(e.target.value),
                      })
                    }
                  >
                    {earningComponents.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="col-span-3 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    value={line.calculationType}
                    onChange={(e) =>
                      updateLine(idx, { calculationType: e.target.value })
                    }
                  >
                    {CALC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {(line.calculationType === "PERCENT_OF_CTC" ||
                    line.calculationType === "PERCENT_OF_BASIC") && (
                    <input
                      type="number"
                      placeholder="%"
                      className="col-span-3 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={line.percentage ?? ""}
                      onChange={(e) =>
                        updateLine(idx, { percentage: Number(e.target.value) })
                      }
                    />
                  )}
                  {line.calculationType === "FLAT" && (
                    <input
                      type="number"
                      placeholder="Rs. / month"
                      className="col-span-3 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={line.flatAmount ?? ""}
                      onChange={(e) =>
                        updateLine(idx, { flatAmount: Number(e.target.value) })
                      }
                    />
                  )}
                  {line.calculationType === "REMAINDER" && (
                    <span className="col-span-3 text-xs text-slate-400 px-2">
                      absorbs the rest
                    </span>
                  )}
                  <button
                    onClick={() => removeLine(idx)}
                    className="col-span-2 text-xs font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                  {comp?.isStatutory && (
                    <span className="col-span-12 text-xs text-amber-600">
                      Statutory components shouldn't be added here — they're
                      computed automatically.
                    </span>
                  )}
                </div>
              );
            })}
            {lines.length === 0 && (
              <p className="text-sm text-slate-400">No components added yet.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!name || lines.length === 0 || save.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalaryStructuresPage() {
  const { canManagePayroll } = useRole();
  const [editing, setEditing] = useState<SalaryStructure | null | "new">(null);

  const structures = useQuery({
    queryKey: ["salary-structures"],
    queryFn: payrollService.listStructures,
  });

  const componentsList = useQuery({
    queryKey: ["salary-components-raw"],
    queryFn: () =>
      resourceService.list("/payroll/salary-components") as unknown as Promise<
        SalaryComponent[]
      >,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Salary Structures
          </h2>
          <p className="text-sm text-slate-500">
            Reusable CTC templates (e.g. "Standard CTC Template") assigned to
            employees.
          </p>
        </div>
        {canManagePayroll && (
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            + New Structure
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Components</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(structures.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {s.name}
                </td>
                <td className="px-4 py-2 text-slate-500">{s.description}</td>
                <td className="px-4 py-2 text-slate-500">
                  {s.components.length}
                </td>
                <td className="px-4 py-2">{s.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  {canManagePayroll && (
                    <button
                      onClick={() => setEditing(s)}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {structures.data?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No salary structures yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <StructureEditor
          structure={editing === "new" ? null : editing}
          components={componentsList.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
