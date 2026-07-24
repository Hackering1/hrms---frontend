import ResourcePage from "../../components/ResourcePage";
import type { ResourceConfig } from "../../utils/types";

const config: ResourceConfig = {
  title: "Document Categories",
  endpoint: "/document-categories",
  queryKey: "documentCategories",
  columns: [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "hasExpiry", label: "Has Expiry" },
    { key: "isActive", label: "Active" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "hasExpiry", label: "Has Expiry", type: "checkbox" },
    { name: "isActive", label: "Active", type: "checkbox" },
  ],
};

export default function DocumentCategoriesPage() {
  return <ResourcePage config={config} />;
}
