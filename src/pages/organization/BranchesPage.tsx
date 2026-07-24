import { useState } from "react";
import ResourcePage from "../../components/ResourcePage";
import ManagerOrgDrilldown from "../../pages-shared/ManagerOrgDrilldown";
import AdminOrgDrilldown from "../../pages-shared/AdminOrgDrilldown";
import { useRole } from "../../hooks/useRole";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Branches",
  endpoint: "/branches",
  queryKey: "branches",
  columns: [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "code", label: "Code", type: "text", required: true },
    { name: "address", label: "Address", type: "textarea" },
    { name: "city", label: "City", type: "text" },
    { name: "state", label: "State", type: "text" },
    { name: "country", label: "Country", type: "text" },
    { name: "pincode", label: "Pincode", type: "text" },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function BranchesPage() {
  const { isManager, isSuperAdmin, isHr } = useRole();
  const [view, setView] = useState<"manage" | "explore">("manage");

  // Manager (not super admin / HR): team drill-down only.
  if (isManager && !isSuperAdmin && !isHr) {
    return (
      <ManagerOrgDrilldown
        title="Branches"
        endpoint="/branches"
        queryKey="branches"
        matchField="branchId"
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
          title="Branches"
          endpoint="/branches"
          queryKey="branches"
          matchField="branchId"
        />
      )}
    </div>
  );
}
