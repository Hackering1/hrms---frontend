import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
  Table,
  Card,
  Modal as AntModal,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import FileUpload from "../../components/ui/FileUpload";
import { fileService } from "../../services/fileService";
import {
  documentService,
  type DocumentCreate,
} from "../../services/documentService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export default function EmployeeDocumentsPage() {
  const qc = useQueryClient();
  const { isHr, isSuperAdmin, isManager } = useRole();
  const canEditDelete = isHr || isSuperAdmin || isManager;
  const managerScoped = isManager && !isSuperAdmin && !isHr;
  const ownOnly = !isHr && !isSuperAdmin && !isManager;
  const [employeeId, setEmployeeId] = useState("");
  const [catFilter, setCatFilter] = useState<number | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<
    Omit<DocumentCreate, "employeeId" | "uploadedBy">
  >({
    documentName: "",
    fileUrl: "",
    fileType: "",
    categoryId: undefined,
    expiryDate: "",
  });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: ownOnly || managerScoped,
  });
  useEffect(() => {
    if (ownOnly && me.data?.id) setEmployeeId(me.data.id as string);
  }, [ownOnly, me.data]);

  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
    enabled: !ownOnly && !managerScoped,
  });

  const pickerPeople = (
    managerScoped ? (team.data ?? []) : (employees.data ?? [])
  ) as ResourceRecord[];
  const categories = useQuery({
    queryKey: ["documentCategories"],
    queryFn: () => resourceService.list("/document-categories"),
  });
  const docs = useQuery({
    queryKey: ["documents", employeeId],
    queryFn: () => documentService.byEmployee(employeeId),
    enabled: !!employeeId,
  });

  const addMut = useMutation({
    mutationFn: () =>
      documentService.add({ ...form, employeeId, uploadedBy: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", employeeId] });
      setOpen(false);
      setForm({
        documentName: "",
        fileUrl: "",
        fileType: "",
        categoryId: undefined,
        expiryDate: "",
      });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => documentService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["documents", employeeId] }),
  });

  const change = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const catName = (id?: number) => {
    if (!id) return "—";
    const c = (categories.data ?? []).find((x: ResourceRecord) => x.id === id);
    return c ? c.name : id;
  };

  const rows = docs.data ?? [];
  // #9: category-wise view — filter documents by the chosen category.
  const filteredRows =
    catFilter === "ALL"
      ? rows
      : rows.filter((d: any) => d.categoryId === catFilter);

  const columns = [
    { title: "Name", dataIndex: "documentName", key: "documentName" },
    {
      title: "Category",
      key: "category",
      render: (_: any, d: any) => catName(d.categoryId),
    },
    {
      title: "Type",
      key: "fileType",
      render: (_: any, d: any) => d.fileType ?? "—",
    },
    {
      title: "Expiry",
      key: "expiry",
      render: (_: any, d: any) => d.expiryDate ?? "—",
    },
    {
      title: "File",
      key: "file",
      render: (_: any, d: any) => (
        <AntButton
          type="link"
          size="small"
          icon={<ExportOutlined />}
          onClick={async () => {
            try {
              await fileService.openFile(d.fileUrl);
            } catch {
              toast.error("Could not open the document. Please try again.");
            }
          }}
        >
          Open
        </AntButton>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, d: any) =>
        canEditDelete ? (
          <Popconfirm
            title="Delete this document?"
            onConfirm={() => delMut.mutate(d.id)}
          >
            <AntButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Employee Documents
          </Title>
          <AntButton
            type="primary"
            icon={<PlusOutlined />}
            disabled={!employeeId}
            onClick={() => setOpen(true)}
          >
            Add Document
          </AntButton>
        </div>

        {!ownOnly && (
          <Card>
            <Field label="Employee">
              <AntSelect
                style={{ width: "100%", maxWidth: 320 }}
                value={employeeId || undefined}
                onChange={(v) => setEmployeeId(v)}
                placeholder="— Select —"
                options={pickerPeople.map((e: ResourceRecord) => ({
                  value: e.id,
                  label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
                }))}
              />
            </Field>
          </Card>
        )}

        {employeeId && (
          <AntSelect
            style={{ width: "100%", maxWidth: 260 }}
            value={catFilter}
            onChange={(v) => setCatFilter(v)}
            options={[
              { value: "ALL", label: "All categories" },
              ...(categories.data ?? []).map((c: ResourceRecord) => ({
                value: c.id as number,
                label: c.name as string,
              })),
            ]}
          />
        )}

        <Table
          loading={docs.isLoading}
          rowKey={(d: any) => d.id}
          columns={columns}
          dataSource={filteredRows}
          locale={{
            emptyText: !employeeId
              ? ownOnly
                ? "Loading your documents…"
                : "Select an employee to see documents."
              : "No documents yet.",
          }}
          pagination={{ pageSize: 10 }}
        />

        <AntModal
          open={open}
          title="Add Document"
          onCancel={() => setOpen(false)}
          footer={[
            <AntButton key="cancel" onClick={() => setOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="add"
              type="primary"
              loading={addMut.isPending}
              disabled={!form.documentName || !form.fileUrl}
              onClick={() => addMut.mutate()}
            >
              Add
            </AntButton>,
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Document Name">
              <AntInput
                value={form.documentName}
                onChange={(e) => change("documentName", e.target.value)}
              />
            </Field>
            <FileUpload
              label="Document File"
              value={form.fileUrl}
              onUploaded={(url, fileName) => {
                change("fileUrl", url);
                if (!form.documentName && fileName)
                  change("documentName", fileName);
                const ext = fileName.includes(".")
                  ? fileName.split(".").pop()
                  : "";
                if (!form.fileType && ext) change("fileType", ext);
              }}
            />
            <Field label="File Type">
              <AntInput
                placeholder="pdf, png, docx..."
                value={form.fileType ?? ""}
                onChange={(e) => change("fileType", e.target.value)}
              />
            </Field>
            <Field label="Category">
              <AntSelect
                allowClear
                value={form.categoryId ?? undefined}
                onChange={(v) => change("categoryId", v ?? undefined)}
                placeholder="— None —"
                options={(categories.data ?? []).map((c: ResourceRecord) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </Field>
            <Field label="Expiry Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.expiryDate ? dayjs(form.expiryDate) : null}
                onChange={(d) =>
                  change("expiryDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </Field>
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: 500 }}>{label}</Text>
      {children}
    </div>
  );
}
