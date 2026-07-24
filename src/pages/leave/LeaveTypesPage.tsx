import ResourcePage from "../../components/ResourcePage";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Leave Types",
  endpoint: "/leave-types",
  queryKey: "leaveTypes",
  columns: [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "daysPerYear", label: "Days/Year" },
    { key: "isPaid", label: "Paid" },
    { key: "isCarryForward", label: "Carry Fwd" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "code", label: "Code", type: "text", required: true },
    {
      name: "daysPerYear",
      label: "Days Per Year",
      type: "number",
      required: true,
    },
    { name: "maxCarryForward", label: "Max Carry Forward", type: "number" },
    {
      name: "applicableGender",
      label: "Applicable Gender",
      type: "select",
      options: [
        { value: "ALL", label: "All" },
        { value: "MALE", label: "Male" },
        { value: "FEMALE", label: "Female" },
      ],
    },
    { name: "minDaysNotice", label: "Min Days Notice", type: "number" },
    { name: "isPaid", label: "Paid Leave", type: "checkbox" },
    {
      name: "isCarryForward",
      label: "Carry Forward Allowed",
      type: "checkbox",
    },
    { name: "requiresDocument", label: "Requires Document", type: "checkbox" },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function LeaveTypesPage() {
  return <ResourcePage config={config} />;
}
