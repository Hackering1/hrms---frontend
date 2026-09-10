import ResourcePage from "../../components/ResourcePage";
import { useRole } from "../../hooks/useRole";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Salary Components",
  endpoint: "/payroll/salary-components",
  queryKey: "salary-components",
  columns: [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "componentType", label: "Type" },
    { key: "calculationType", label: "Calculation" },
    { key: "isTaxable", label: "Taxable" },
    { key: "isStatutory", label: "Statutory" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "code", label: "Code", type: "text", required: true },
    {
      name: "componentType",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "EARNING", label: "Earning" },
        { value: "DEDUCTION", label: "Deduction" },
        { value: "EMPLOYER_CONTRIBUTION", label: "Employer Contribution" },
      ],
    },
    {
      name: "calculationType",
      label: "Default Calculation",
      type: "select",
      required: true,
      options: [
        { value: "FLAT", label: "Flat amount" },
        { value: "PERCENT_OF_CTC", label: "% of CTC" },
        { value: "PERCENT_OF_BASIC", label: "% of Basic" },
        { value: "REMAINDER", label: "Remainder of CTC" },
      ],
    },
    { name: "defaultPercentage", label: "Default %", type: "number" },
    { name: "isTaxable", label: "Taxable", type: "checkbox" },
    {
      name: "isStatutory",
      label: "Statutory (system-computed — PF/PT/TDS)",
      type: "checkbox",
    },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function SalaryComponentsPage() {
  const { canManagePayroll } = useRole();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        The reusable building blocks (Basic, HRA, PF, etc.) combined into Salary
        Structures. Components marked <strong>Statutory</strong> are computed
        automatically per payroll run (PF/PT/TDS) — leave them out of a
        structure's percentage split.
      </p>
      <ResourcePage config={config} permissionOverride={canManagePayroll} />
    </div>
  );
}
