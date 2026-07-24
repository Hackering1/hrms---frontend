import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ArrowLeft, Users } from "lucide-react";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import { resourceService } from "../services/resourceService";
import { managerService } from "../services/managerService";
import { selfService } from "../services/selfService";
import type { ResourceRecord } from "../utils/types";

/**
 * Manager-facing drill-down for an org master-data type (branch / department /
 * designation / shift). Lists the org units; clicking one shows the manager's
 * OWN team members who belong to that unit.
 *
 * `matchField` is the key on an employee record that points at this unit's id,
 * e.g. "branchId" for branches.
 */
export default function ManagerOrgDrilldown({
  title,
  endpoint,
  queryKey,
  matchField,
  unitLabelKey = "name",
}: {
  title: string;
  endpoint: string; // e.g. "/branches"
  queryKey: string; // e.g. "branches"
  matchField: string; // e.g. "branchId"
  unitLabelKey?: string; // which field on the unit is its display name
}) {
  const [selected, setSelected] = useState<ResourceRecord | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });

  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: !!me.data?.id,
  });

  const units = useQuery({
    queryKey: [queryKey],
    queryFn: () => resourceService.list(endpoint),
  });

  const teamList = team.data ?? [];

  // Count team members per unit id, so the list can show "3 in your team".
  const countByUnit = useMemo(() => {
    const m = new Map<any, number>();
    for (const emp of teamList) {
      const key = (emp as ResourceRecord)[matchField];
      if (key === undefined || key === null) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [teamList, matchField]);

  // Members of the currently-selected unit.
  const membersInSelected = useMemo(() => {
    if (!selected) return [];
    return teamList.filter(
      (emp) =>
        String((emp as ResourceRecord)[matchField]) === String(selected.id),
    );
  }, [selected, teamList, matchField]);

  if (me.isLoading || team.isLoading || units.isLoading) return <Spinner />;

  if (me.isError) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} />
        <Card>
          <p className="text-sm text-slate-500">
            Your employee profile isn't linked yet, so your team can't be shown.
            Please contact HR.
          </p>
        </Card>
      </div>
    );
  }

  // Detail view — team members in the selected unit.
  if (selected) {
    return (
      <div className="space-y-5">
        <PageHeader title={`${title} — ${selected[unitLabelKey] ?? ""}`} />
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft size={16} /> Back to {title.toLowerCase()}
        </button>

        <Card className="p-0">
          {membersInSelected.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              None of your team members are in this{" "}
              {title.toLowerCase().replace(/s$/, "")}.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {membersInSelected.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {m.employeeCode}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.firstName} {m.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.departmentName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.status ?? "—"}
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

  // List view — all units, each showing how many of the manager's team are in it.
  const unitList = units.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle="Click one to see your team members in it."
      />
      <Card className="p-0">
        {unitList.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No {title.toLowerCase()}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unitList.map((u: ResourceRecord) => {
              const count = countByUnit.get(u.id) ?? 0;
              return (
                <li key={u.id}>
                  <button
                    onClick={() => setSelected(u)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">
                      {u[unitLabelKey]}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Users size={14} />
                        {count} in your team
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
    </div>
  );
}
