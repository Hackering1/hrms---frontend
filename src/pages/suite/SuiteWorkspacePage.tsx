import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ResourcePage from "../../components/ResourcePage";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { FieldConfig, ResourceConfig } from "../../utils/types";

type SuiteModule = "payroll" | "payslips" | "statutory" | "time-tracking" | "tasks" | "timesheets" | "performance" | "assets" | "monitoring";
export type EmployeeOption = { id: string; employeeCode: string; displayName: string };

const STATUS_OPTIONS = ["DRAFT", "SUBMITTED", "PENDING", "APPROVED", "PAID", "GENERATED", "CALCULATED", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ACTIVE", "INACTIVE", "RETURNED", "CONSENT_WITHDRAWN"].map((x) => ({ value: x, label: x.replaceAll("_", " ") }));

const MODULE_CONFIG: Record<SuiteModule, Omit<ResourceConfig, "fields"> & { fields: FieldConfig[]; employeeField?: boolean }> = {
  payroll: { title: "Payroll", endpoint: "/hr-suite/payroll", queryKey: "suite-payroll", adminOnly: true, readOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Payroll run" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Pay period" }, { key: "amount", label: "Net pay (₹)" }, { key: "status", label: "Status" }], fields: [] },
  payslips: { title: "Payslips", endpoint: "/hr-suite/payslips", queryKey: "suite-payslips", adminOnly: true, readOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Payslip" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Pay period" }, { key: "amount", label: "Net pay (₹)" }, { key: "status", label: "Status" }], fields: [] },
  statutory: { title: "PF, ESI & Professional Tax", endpoint: "/hr-suite/statutory", queryKey: "suite-statutory", payrollAdminOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Contribution / tax" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Period" }, { key: "amount", label: "Amount (₹)" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Type (PF, ESI, PT)", type: "text", required: true }, { name: "employeeId", label: "Employee", type: "select", required: true }, { name: "period", label: "Period (YYYY-MM)", type: "text", required: true }, { name: "amount", label: "Amount (₹)", type: "number", required: true }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Rule version / filing reference", type: "textarea" }] },
  "time-tracking": { title: "Time Tracker", endpoint: "/hr-suite/time-tracking", queryKey: "suite-time-tracking", allowSelfService: true, disableDelete: true, columns: [{ key: "title", label: "Project / activity" }, { key: "startDate", label: "Work date" }, { key: "minutes", label: "Minutes" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Project / activity", type: "text", required: true }, { name: "startDate", label: "Work date", type: "date", required: true }, { name: "minutes", label: "Duration (minutes)", type: "number", required: true }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Notes", type: "textarea" }] },
  tasks: { title: "Tasks", endpoint: "/hr-suite/tasks", queryKey: "suite-tasks", allowSelfService: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Task" }, { key: "employeeLabel", label: "Assignee" }, { key: "startDate", label: "Due date" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Task", type: "text", required: true }, { name: "employeeId", label: "Assignee", type: "select" }, { name: "startDate", label: "Due date", type: "date" }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Description", type: "textarea" }] },
  timesheets: { title: "Timesheets", endpoint: "/hr-suite/timesheets", queryKey: "suite-timesheets", allowSelfService: true, disableDelete: true, columns: [{ key: "title", label: "Timesheet" }, { key: "period", label: "Period" }, { key: "minutes", label: "Minutes" }, { key: "status", label: "Approval" }], fields: [{ name: "title", label: "Timesheet", type: "text", required: true }, { name: "period", label: "Period", type: "text", required: true, placeholder: "2026-W46" }, { name: "minutes", label: "Total minutes", type: "number", required: true }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Daily entries / notes", type: "textarea" }] },
  performance: { title: "Performance", endpoint: "/hr-suite/performance", queryKey: "suite-performance", disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Review" }, { key: "employeeLabel", label: "Employee" }, { key: "period", label: "Review period" }, { key: "amount", label: "Score" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Review title", type: "text", required: true }, { name: "employeeId", label: "Employee", type: "select", required: true }, { name: "period", label: "Review period", type: "text", required: true }, { name: "amount", label: "Score", type: "number" }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "details", label: "Goals, feedback and development plan", type: "textarea" }] },
  assets: { title: "Asset Management", endpoint: "/hr-suite/assets", queryKey: "suite-assets", adminOnly: true, disableDelete: true, employeeField: true, columns: [{ key: "title", label: "Asset" }, { key: "employeeLabel", label: "Assigned employee" }, { key: "status", label: "Status" }, { key: "startDate", label: "Issued" }, { key: "endDate", label: "Return due" }], fields: [{ name: "title", label: "Asset / serial number", type: "text", required: true }, { name: "employeeId", label: "Assigned employee", type: "select", required: true }, { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS }, { name: "startDate", label: "Issue date", type: "date" }, { name: "endDate", label: "Return date", type: "date" }, { name: "details", label: "Condition / handover notes", type: "textarea" }] },
  monitoring: { title: "Computer Use & Work Sessions", endpoint: "/hr-suite/monitoring", queryKey: "suite-monitoring", allowSelfService: true, selfServiceOnly: true, disableDelete: true, columns: [{ key: "title", label: "Session / consent record" }, { key: "startDate", label: "Date" }, { key: "minutes", label: "Minutes" }, { key: "consent", label: "Consent recorded" }], fields: [{ name: "title", label: "Session / consent record", type: "text", required: true }, { name: "startDate", label: "Date", type: "date" }, { name: "minutes", label: "Duration (minutes)", type: "number" }, { name: "consent", label: "I consent to transparent work-session tracking", type: "checkbox", required: true }, { name: "details", label: "Purpose / policy version", type: "textarea" }] },
};

export default function SuiteWorkspacePage({ module }: { module: SuiteModule }) {
  const { isHr, isManager, isEmployee } = useRole();
  const definition = MODULE_CONFIG[module];
  const canChooseEmployee = isHr || isManager;
  const employees = useQuery({
    queryKey: ["suite-employee-options"],
    queryFn: () => resourceService.get<EmployeeOption[]>("/hr-suite/employee-options"),
    enabled: canChooseEmployee && definition.employeeField === true,
  });
  const config = useMemo<ResourceConfig>(() => {
    const fields = definition.fields.map((field) => {
      if (field.name !== "employeeId" || !field.options) return field;
      return { ...field, options: employees.data?.map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` })) ?? [] };
    });
    // Employee selectors are populated from a backend projection that excludes
    // Aadhaar, PAN, bank and other profile fields.
    if (definition.employeeField && canChooseEmployee) {
      const index = fields.findIndex((f) => f.name === "employeeId");
      if (index >= 0) fields[index] = { ...fields[index], type: "select", options: employees.data?.map((e) => ({ value: e.id, label: `${e.employeeCode} · ${e.displayName}` })) ?? [] };
    }
    return { ...definition, fields };
  }, [definition, employees.data, canChooseEmployee]);

  return (
    <div className="space-y-4">
      {module === "monitoring" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This feature records only work-session duration and employee consent. It does not capture screenshots, keystrokes, browsing history, or app content. Tracking stays off unless the employee opts in.
        </div>
      )}
      {module === "statutory" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          PF, ESI and professional-tax amounts require HR-configured, location-specific rules and review. This register does not calculate legal contributions automatically.
        </div>
      )}
      {isEmployee && module === "payslips" && <p className="text-sm text-slate-500">Your payslips are private to your account.</p>}
      <ResourcePage config={config} />
    </div>
  );
}
