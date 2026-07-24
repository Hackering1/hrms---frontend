import ResourcePage from "../../components/ResourcePage";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Letter Templates",
  endpoint: "/letter-templates",
  queryKey: "letterTemplates",
  columns: [
    { key: "name", label: "Name" },
    { key: "letterType", label: "Type" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Template Name", type: "text", required: true },
    {
      name: "letterType",
      label: "Letter Type",
      type: "select",
      options: [
        { value: "OFFER", label: "Offer Letter" },
        { value: "CONFIRMATION", label: "Confirmation Letter" },
        { value: "EXPERIENCE", label: "Experience Letter" },
        { value: "RELIEVING", label: "Relieving Letter" },
        { value: "APPRAISAL", label: "Appraisal Letter" },
        { value: "WARNING", label: "Warning Letter" },
      ],
    },
    {
      name: "templateBody",
      label:
        "Template Body (use {firstName}, {lastName}, {fullName}, {employeeCode}, {designation}, {department}, {branch}, {dateOfJoining}, {employmentType})",
      type: "textarea",
      required: true,
    },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function LetterTemplatesPage() {
  return <ResourcePage config={config} />;
}
