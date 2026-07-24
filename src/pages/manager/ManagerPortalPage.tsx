import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Check, X as XIcon, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { managerService } from "../../services/managerService";
import { leaveService } from "../../services/leaveService";
import { resourceService } from "../../services/resourceService";
import { selfService } from "../../services/selfService";
import { useRole } from "../../hooks/useRole";
import type { ResourceRecord } from "../../utils/types";

type Tab = "team" | "approvals";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function ManagerPortalPage() {
  const qc = useQueryClient();
  const { isManager, isHr, isSuperAdmin } = useRole();
  // HR / Admin may inspect ANY manager's team (picker shown).
  // A plain manager is auto-scoped to their own team (no picker).
  const canPickManager = isHr || isSuperAdmin;

  const [tab, setTab] = useState<Tab>("team");
  const [managerId, setManagerId] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmp, setAssignEmp] = useState("");

  // The logged-in person's own employee record (used to auto-scope a manager).
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: isManager && !canPickManager,
  });
  // Auto-set managerId to the logged-in manager's own employee id.
  useEffect(() => {
    if (isManager && !canPickManager && me.data?.id) {
      setManagerId(me.data.id as string);
    }
  }, [isManager, canPickManager, me.data]);

  // Employee list is only needed for the picker / assign modal (HR/Admin).
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
    enabled: canPickManager,
  });

  // Real roles live in the users table. Fetch users and build a userId -> roles
  // map (reliable), with an email fallback, so we can tell managers / super
  // admins apart from ordinary employees.
  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: () => resourceService.list("/users"),
    enabled: canPickManager,
  });
  const rolesByUserId = new Map<string, string[]>();
  const rolesByEmail = new Map<string, string[]>();
  for (const u of (users.data ?? []) as any[]) {
    const rs: string[] = Array.isArray(u.roles) ? u.roles : [];
    if (u.id != null) rolesByUserId.set(String(u.id), rs);
    if (u.email) rolesByEmail.set(String(u.email).toLowerCase(), rs);
  }
  const rolesOf = (e: any): string[] => {
    if (e.userId && rolesByUserId.has(String(e.userId)))
      return rolesByUserId.get(String(e.userId))!;
    return rolesByEmail.get(String(e.email ?? "").toLowerCase()) ?? [];
  };
  const isManagerEmp = (e: any) => rolesOf(e).includes("MANAGER");
  const isSuperAdminEmp = (e: any) => rolesOf(e).includes("SUPER_ADMIN");

  // The manager picker lists only employees whose login account has MANAGER role.
  const managersOnly = ((employees.data ?? []) as ResourceRecord[]).filter(
    (e) => isManagerEmp(e),
  );

  const team = useQuery({
    queryKey: ["team", managerId],
    queryFn: () => managerService.team(managerId),
    enabled: !!managerId,
  });

  const allLeave = useQuery({
    queryKey: ["leaveRequests"],
    queryFn: leaveService.listAll,
    enabled: !!managerId && tab === "approvals",
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "APPROVED" | "REJECTED";
    }) => leaveService.decide(id, { approvedBy: null, status }),
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["leaveRequests"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not record decision"),
  });

  const assign = useMutation({
    mutationFn: () =>
      managerService.assign({ employeeId: assignEmp, managerId }),
    onSuccess: () => {
      toast.success("Team member assigned");
      qc.invalidateQueries({ queryKey: ["team", managerId] });
      setAssignOpen(false);
      setAssignEmp("");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not assign"),
  });

  const teamList = team.data ?? [];
  const teamIds = new Set(teamList.map((e) => String(e.id)));

  // Assignable = ordinary employees only: exclude the selected manager, anyone
  // who is a MANAGER or SUPER_ADMIN, and anyone already on this team.
  const assignableEmployees = (
    (employees.data ?? []) as ResourceRecord[]
  ).filter(
    (e) =>
      String(e.id) !== managerId &&
      !isManagerEmp(e) &&
      !isSuperAdminEmp(e) &&
      !teamIds.has(String(e.id)),
  );

  const empName = (id: string) => {
    // Prefer the picker's employee list (HR/admin); fall back to team list.
    const fromAll = (employees.data ?? []).find(
      (x: ResourceRecord) => x.id === id,
    );
    if (fromAll)
      return (
        fromAll.employeeCode +
        " \u2014 " +
        fromAll.firstName +
        " " +
        fromAll.lastName
      );
    const fromTeam = teamList.find((x) => x.id === id);
    return fromTeam
      ? fromTeam.employeeCode +
          " \u2014 " +
          fromTeam.firstName +
          " " +
          fromTeam.lastName
      : id;
  };

  // Only this manager's team's leave requests.
  const teamLeave = (allLeave.data ?? []).filter((l) =>
    teamIds.has(String(l.employeeId)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-slate-700" />
        <h1 className="text-xl font-semibold text-slate-800">Manager Portal</h1>
      </div>

      {/* Manager picker — only for HR / Admin inspecting a manager. */}
      {canPickManager && (
        <Card>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              View team of manager
            </label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">{"\u2014 Select manager \u2014"}</option>
              {managersOnly.map((e: ResourceRecord) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} {"\u2014"} {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* A plain manager whose profile is still loading. */}
      {!canPickManager && me.isLoading && <Spinner />}
      {!canPickManager && me.isError && (
        <Card>
          <p className="text-sm text-slate-500">
            Your employee profile isn't linked yet, so your team can't be
            loaded. Please contact HR.
          </p>
        </Card>
      )}

      {!managerId ? (
        canPickManager ? (
          <Card>
            <p className="text-sm text-slate-500">
              Select a manager to view their team and approvals.
            </p>
          </Card>
        ) : null
      ) : (
        <>
          <div className="flex gap-1 border-b border-slate-200">
            <button
              onClick={() => setTab("team")}
              className={`px-4 py-2 text-sm font-medium ${tab === "team" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Team Directory
            </button>
            <button
              onClick={() => setTab("approvals")}
              className={`px-4 py-2 text-sm font-medium ${tab === "approvals" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Leave Approvals
            </button>
          </div>

          {tab === "team" && (
            <>
              {/* Only HR/Admin assign team members; a manager just views. */}
              {canPickManager && (
                <div className="flex justify-end">
                  <Button onClick={() => setAssignOpen(true)}>
                    <UserPlus size={16} /> Add Team Member
                  </Button>
                </div>
              )}
              <Card className="p-0">
                {team.isLoading ? (
                  <Spinner />
                ) : teamList.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    {canPickManager
                      ? 'No team members yet. Use "Add Team Member" to assign reports.'
                      : "You don't have any team members assigned yet."}
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Designation</th>
                        <th className="px-4 py-3 font-medium">Department</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamList.map((m) => (
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
                            {m.designationName ?? "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {m.departmentName ?? "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {m.status ?? "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}

          {tab === "approvals" && (
            <Card className="p-0">
              {allLeave.isLoading ? (
                <Spinner />
              ) : teamLeave.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">
                  No leave requests from your team.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium">Days</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeave.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-slate-700">
                          {empName(l.employeeId)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {l.fromDate}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{l.toDate}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {l.numberOfDays}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[l.status] ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {l.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                title="Approve"
                                onClick={() =>
                                  decide.mutate({
                                    id: l.id,
                                    status: "APPROVED",
                                  })
                                }
                                className="rounded p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-600"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                title="Reject"
                                onClick={() =>
                                  decide.mutate({
                                    id: l.id,
                                    status: "REJECTED",
                                  })
                                }
                                className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <XIcon size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-slate-400">
                              {"\u2014"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </>
      )}

      {/* Assign modal — HR/Admin only. */}
      {canPickManager && (
        <Modal
          open={assignOpen}
          title="Add Team Member"
          onClose={() => setAssignOpen(false)}
        >
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Employee (reports to this manager)
              </label>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={assignEmp}
                onChange={(e) => setAssignEmp(e.target.value)}
              >
                <option value="">{"\u2014 Select \u2014"}</option>
                {assignableEmployees.map((e: ResourceRecord) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} {"\u2014"} {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => assign.mutate()}
                disabled={assign.isPending || !assignEmp}
              >
                Assign
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
