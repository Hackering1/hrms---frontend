import { useState } from "react";
import ResourcePage from "../../components/ResourcePage";
import ManagerOrgDrilldown from "../../pages-shared/ManagerOrgDrilldown";
import AdminOrgDrilldown from "../../pages-shared/AdminOrgDrilldown";
import { useRole } from "../../hooks/useRole";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Shifts",
  endpoint: "/shifts",
  queryKey: "shifts",
  columns: [
    { key: "name", label: "Name" },
    { key: "startTime", label: "Start" },
    { key: "endTime", label: "End" },
    { key: "graceMinutes", label: "Grace (min)" },
    { key: "isNightShift", label: "Night" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "startTime", label: "Start Time", type: "time", required: true },
    { name: "endTime", label: "End Time", type: "time", required: true },
    { name: "graceMinutes", label: "Grace Minutes", type: "number" },
    { name: "isNightShift", label: "Night Shift", type: "checkbox" },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function ShiftsPage() {
  const { isManager, isSuperAdmin, isHr } = useRole();
  const [view, setView] = useState<"manage" | "explore">("manage");

  // Manager (not super admin / HR): team drill-down only.
  if (isManager && !isSuperAdmin && !isHr) {
    return (
      <ManagerOrgDrilldown
        title="Shifts"
        endpoint="/shifts"
        queryKey="shifts"
        matchField="shiftId"
      />
    );
  }

  // Super admin / HR: tabs for Manage (CRUD) and Explore (drill-down + charts).
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setView("manage")}
          className={`px-4 py-2 text-sm font-medium ${
            view === "manage"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Manage
        </button>
        <button
          onClick={() => setView("explore")}
          className={`px-4 py-2 text-sm font-medium ${
            view === "explore"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Explore
        </button>
      </div>

      {view === "manage" ? (
        <ResourcePage config={config} />
      ) : (
        <AdminOrgDrilldown
          title="Shifts"
          endpoint="/shifts"
          queryKey="shifts"
          matchField="shiftId"
        />
      )}
    </div>
  );
}
