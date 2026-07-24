import { useState } from "react";
import ResourcePage from "../../components/ResourcePage";
import ManagerOrgDrilldown from "../../pages-shared/ManagerOrgDrilldown";
import AdminOrgDrilldown from "../../pages-shared/AdminOrgDrilldown";
import { useRole } from "../../hooks/useRole";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Designations",
  endpoint: "/designations",
  queryKey: "designations",
  columns: [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "departmentId", label: "Dept ID" },
    { key: "level", label: "Level" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "code", label: "Code", type: "text", required: true },
    { name: "departmentId", label: "Department ID", type: "number" },
    { name: "level", label: "Level (1-5)", type: "number" },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function DesignationsPage() {
  const { isManager, isSuperAdmin, isHr } = useRole();
  const [view, setView] = useState<"manage" | "explore">("manage");

  // Manager (not super admin / HR): team drill-down only.
  if (isManager && !isSuperAdmin && !isHr) {
    return (
      <ManagerOrgDrilldown
        title="Designations"
        endpoint="/designations"
        queryKey="designations"
        matchField="designationId"
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
          title="Designations"
          endpoint="/designations"
          queryKey="designations"
          matchField="designationId"
        />
      )}
    </div>
  );
}
