import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Users } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { managerService } from "../../services/managerService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

/**
 * Super Admin → assign employees to managers.
 *
 * Fixes the "empty teams" gap: every team-scoped Manager page (attendance, leave,
 * reports, documents…) only shows a manager's assigned team, so teams must be
 * populated here first. Only Super Admin can reach this (route is guarded).
 */
export default function TeamAssignmentPage() {
  const qc = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [employeeToAdd, setEmployeeToAdd] = useState("");

  const managers = useQuery({
    queryKey: ["assignable-managers"],
    queryFn: managerService.assignableManagers,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });

  const assignments = useQuery({
    queryKey: ["manager-assignments"],
    queryFn: managerService.allAssignments,
  });

  const allEmployees = (employees.data ?? []) as ResourceRecord[];
  const empById = useMemo(() => {
    const m = new Map<string, ResourceRecord>();
    allEmployees.forEach((e) => m.set(e.id as string, e));
    return m;
  }, [allEmployees]);

  const label = (e?: ResourceRecord) =>
    e ? `${e.employeeCode} — ${e.firstName} ${e.lastName}` : "Unknown";

  // Current team of the selected manager (assignment rows carry the id for removal)
  const currentTeam = (assignments.data ?? []).filter(
    (a) => a.managerId === managerId,
  );
  const currentTeamEmpIds = new Set(currentTeam.map((a) => a.employeeId));

  // Employees that can still be added: not the manager, not already on this team
  const addableEmployees = allEmployees.filter(
    (e) => e.id !== managerId && !currentTeamEmpIds.has(e.id as string),
  );

  const assign = useMutation({
    mutationFn: () =>
      managerService.assign({ employeeId: employeeToAdd, managerId }),
    onSuccess: () => {
      toast.success("Employee assigned to manager");
      setEmployeeToAdd("");
      qc.invalidateQueries({ queryKey: ["manager-assignments"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Assignment failed"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => managerService.unassign(id),
    onSuccess: () => {
      toast.success("Removed from team");
      qc.invalidateQueries({ queryKey: ["manager-assignments"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Remove failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="text-indigo-600" size={22} />
        <h1 className="text-xl font-semibold text-slate-800">
          Team Assignment
        </h1>
      </div>
      <p className="text-sm text-slate-500">
        Assign employees to their manager. A manager's team drives what they see
        across attendance, leave, reports and documents.
      </p>

      <Card>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Manager</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={managerId}
            onChange={(e) => {
              setManagerId(e.target.value);
              setEmployeeToAdd("");
            }}
          >
            <option value="">— Select a manager —</option>
            {(managers.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.employeeCode} — {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          {managers.isLoading && (
            <span className="text-xs text-slate-400">Loading managers…</span>
          )}
          {!managers.isLoading && (managers.data ?? []).length === 0 && (
            <span className="text-xs text-amber-600">
              No employees have a Manager/HR role yet. Give a user the Manager
              role first, then they'll appear here.
            </span>
          )}
        </div>

        {managerId && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Add employee to this team
              </label>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={employeeToAdd}
                onChange={(e) => setEmployeeToAdd(e.target.value)}
              >
                <option value="">— Select an employee —</option>
                {addableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {label(e)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => assign.mutate()}
              disabled={!employeeToAdd || assign.isPending}
            >
              <UserPlus size={16} /> Assign
            </Button>
          </div>
        )}
      </Card>

      {managerId && (
        <Card className="p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Current Team ({currentTeam.length})
            </h2>
          </div>
          {assignments.isLoading ? (
            <Spinner />
          ) : currentTeam.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              No one is assigned to this manager yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-2 font-medium">Code</th>
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentTeam.map((a) => {
                  const e = empById.get(a.employeeId);
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-5 py-2 text-slate-700">
                        {e?.employeeCode ?? "—"}
                      </td>
                      <td className="px-5 py-2 text-slate-700">
                        {e ? `${e.firstName} ${e.lastName}` : a.employeeId}
                      </td>
                      <td className="px-5 py-2 text-right">
                        <button
                          title="Remove from team"
                          onClick={() => remove.mutate(a.id)}
                          disabled={remove.isPending}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
