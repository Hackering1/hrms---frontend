import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ArrowLeft, Users } from "lucide-react";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import { resourceService } from "../services/resourceService";
import { DonutChart, pickColor } from "../components/ui/Charts";
import type { ResourceRecord } from "../utils/types";

/**
 * Super-admin drill-down for an org unit (branch / department / designation /
 * shift). Lists units; clicking one shows ALL employees in that unit, split
 * into managers vs employees, with a donut chart.
 *
 * `matchField` is the employee key pointing at the unit id (e.g. "branchId").
 */
export default function AdminOrgDrilldown({
  title,
  endpoint,
  queryKey,
  matchField,
  unitLabelKey = "name",
}: {
  title: string;
  endpoint: string;
  queryKey: string;
  matchField: string;
  unitLabelKey?: string;
}) {
  const [selected, setSelected] = useState<ResourceRecord | null>(null);

  const units = useQuery({
    queryKey: [queryKey],
    queryFn: () => resourceService.list(endpoint),
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });

  const empList = (employees.data ?? []) as ResourceRecord[];

  const isManager = (e: ResourceRecord) =>
    e.loginRole === "MANAGER" ||
    (e as any).isManager === true ||
    (Array.isArray((e as any).roles) && (e as any).roles.includes("MANAGER"));

  const countByUnit = useMemo(() => {
    const m = new Map<any, number>();
    for (const e of empList) {
      const key = (e as ResourceRecord)[matchField];
      if (key === undefined || key === null) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [empList, matchField]);

  const membersInSelected = useMemo(() => {
    if (!selected) return [];
    return empList.filter(
      (e) => String((e as ResourceRecord)[matchField]) === String(selected.id),
    );
  }, [selected, empList, matchField]);

  if (units.isLoading || employees.isLoading) return <Spinner />;

  // Detail view
  if (selected) {
    const managers = membersInSelected.filter(isManager);
    const staff = membersInSelected.filter((e) => !isManager(e));

    const pieData = [
      { label: "Managers", value: managers.length, color: pickColor(0) },
      { label: "Employees", value: staff.length, color: pickColor(1) },
    ].filter((s) => s.value > 0);

    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft size={16} /> Back to {title.toLowerCase()}
        </button>

        <h2 className="text-lg font-semibold text-slate-800">
          {selected[unitLabelKey] as string}
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Managers vs Employees
            </h3>
            {pieData.length > 0 ? (
              <DonutChart data={pieData} />
            ) : (
              <p className="text-sm text-slate-400">
                No people in this {title.toLowerCase().replace(/s$/, "")}.
              </p>
            )}
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-2xl font-semibold text-indigo-700">
                  {managers.length}
                </p>
                <p className="text-xs text-slate-500">Managers</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-2xl font-semibold text-emerald-700">
                  {staff.length}
                </p>
                <p className="text-xs text-slate-500">Employees</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-0">
          {membersInSelected.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No people here.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                </tr>
              </thead>
              <tbody>
                {membersInSelected.map((m) => (
                  <tr
                    key={m.id as string}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {m.employeeCode}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.firstName} {m.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isManager(m)
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isManager(m) ? "Manager" : "Employee"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.departmentName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  }

  // List view
  const unitList = (units.data ?? []) as ResourceRecord[];
  return (
    <Card className="p-0">
      {unitList.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No {title.toLowerCase()}.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {unitList.map((u) => {
            const count = countByUnit.get(u.id) ?? 0;
            return (
              <li key={u.id as string}>
                <button
                  onClick={() => setSelected(u)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">
                    {u[unitLabelKey] as string}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={14} />
                      {count} {count === 1 ? "person" : "people"}
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
