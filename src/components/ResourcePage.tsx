import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Table,
  Tag,
  Modal as AntModal,
  Popconfirm,
  Empty,
  Checkbox,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { formatValue } from "../utils/format";
import { useResource } from "../hooks/useResource";
import { useRole } from "../hooks/useRole";
import type {
  ResourceConfig,
  ResourceRecord,
  FieldConfig,
} from "../utils/types";

const { Title, Text } = Typography;
const { TextArea } = AntInput;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const PAGE_SIZE = 10;

const statusTagColor: Record<string, string> = {
  ACTIVE: "success",
  INACTIVE: "default",
  true: "success",
  false: "default",
};

export default function ResourcePage({ config }: { config: ResourceConfig }) {
  const { list, create, update, remove } = useResource(
    config.endpoint,
    config.queryKey,
  );
  const { canManage } = useRole();
  const allowManage = canManage;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [form, setForm] = useState<ResourceRecord>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const singular = config.title.replace(/s$/, "");
  const hasSections = config.fields.some((f) => f.section);

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: ResourceRecord) => {
    setEditing(row);
    setForm({ ...row });
    setErrors({});
    setOpen(true);
  };
  const handleChange = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    config.fields.forEach((f) => {
      if (f.required) {
        const v = form[f.name];
        if (v === undefined || v === null || v === "")
          next[f.name] = `${f.label} is required`;
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Please fill the required fields");
      return;
    }
    if (editing?.id) {
      update.mutate(
        { id: editing.id, body: form },
        {
          onSuccess: () => {
            setOpen(false);
            toast.success(`${singular} updated`);
          },
          onError: () => toast.error("Couldn't save changes"),
        },
      );
    } else {
      create.mutate(form, {
        onSuccess: () => {
          setOpen(false);
          toast.success(`${singular} added`);
        },
        onError: () => toast.error("Couldn't create record"),
      });
    }
  };

  const handleDelete = (id: string | number) => {
    remove.mutate(id, {
      onSuccess: () => toast.success(`${singular} deleted`),
      onError: () => toast.error("Couldn't delete record"),
    });
  };

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      config.columns.some((c) =>
        String(r[c.key] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, query, config.columns]);

  const sections = useMemo(() => {
    if (!hasSections) return [{ heading: "", fields: config.fields }];
    const map = new Map<string, FieldConfig[]>();
    config.fields.forEach((f) => {
      const key = f.section ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries()).map(([heading, fields]) => ({
      heading,
      fields,
    }));
  }, [config.fields, hasSections]);

  const tableColumns = [
    ...config.columns.map((c) => ({
      title: c.label,
      dataIndex: c.key,
      key: c.key,
      render: (v: any) => {
        if (c.key.toLowerCase().includes("status") && v) {
          return (
            <Tag color={statusTagColor[String(v)] ?? "default"}>
              {String(v)}
            </Tag>
          );
        }
        if (typeof v === "boolean") {
          return (
            <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>
          );
        }
        return formatValue(v) ?? "—";
      },
    })),
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, row: any) =>
        allowManage ? (
          <span style={{ display: "inline-flex", gap: 4 }}>
            <AntButton
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
            />
            <Popconfirm
              title={`Delete this ${singular.toLowerCase()}?`}
              description="This action can't be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(row.id!)}
            >
              <AntButton size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </span>
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
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {config.title}
            </Title>
            {!list.isLoading && !list.isError && (
              <Text type="secondary">
                {rows.length} {rows.length === 1 ? "record" : "records"}
              </Text>
            )}
          </div>
          {allowManage && (
            <AntButton
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              Add {singular}
            </AntButton>
          )}
        </div>

        {!list.isLoading && !list.isError && rows.length > 0 && (
          <AntInput
            allowClear
            style={{ maxWidth: 320 }}
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            placeholder={`Search ${config.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        )}

        {list.isError ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Text strong style={{ color: "#e11d48" }}>
              Couldn't load {config.title.toLowerCase()}
            </Text>
            <div>
              <Text type="secondary">
                Check that the backend is running and you're signed in, then
                refresh.
              </Text>
            </div>
          </div>
        ) : (
          <Table
            loading={list.isLoading}
            rowKey={(r: any) => r.id}
            columns={tableColumns}
            dataSource={filtered as any[]}
            locale={{
              emptyText: (
                <Empty
                  description={
                    query
                      ? `No matches for "${query}"`
                      : `No ${config.title.toLowerCase()} yet`
                  }
                >
                  {query ? (
                    <AntButton onClick={() => setQuery("")}>
                      Clear search
                    </AntButton>
                  ) : (
                    allowManage && (
                      <AntButton
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreate}
                      >
                        Add {singular}
                      </AntButton>
                    )
                  )}
                </Empty>
              ),
            }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: filtered.length,
              onChange: (p) => setPage(p),
              showTotal: (total) => `${total} total`,
            }}
          />
        )}

        <AntModal
          open={open}
          title={`${editing ? "Edit" : "Add"} ${singular}`}
          onCancel={() => setOpen(false)}
          width={hasSections ? 700 : 480}
          footer={[
            <AntButton key="cancel" onClick={() => setOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              loading={create.isPending || update.isPending}
              onClick={handleSubmit}
            >
              {editing ? "Update" : "Create"}
            </AntButton>,
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sections.map((sec, si) => (
              <div key={si}>
                {sec.heading && (
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    {sec.heading}
                  </Text>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: hasSections
                      ? "repeat(auto-fit, minmax(200px, 1fr))"
                      : "1fr",
                    gap: 12,
                  }}
                >
                  {sec.fields.map((field) => (
                    <FieldInput
                      key={field.name}
                      field={field}
                      value={form[field.name]}
                      error={errors[field.name]}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}

/* ---------- field renderer ---------- */
function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldConfig;
  value: any;
  error?: string;
  onChange: (name: string, value: any) => void;
}) {
  const label = (
    <Text style={{ fontSize: 13, fontWeight: 500 }}>
      {field.label}
      {field.required && <span style={{ color: "#e11d48" }}> *</span>}
    </Text>
  );

  if (field.type === "checkbox") {
    return (
      <Checkbox
        checked={Boolean(value)}
        onChange={(e) => onChange(field.name, e.target.checked)}
      >
        {field.label}
      </Checkbox>
    );
  }

  if (field.type === "select") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {label}
        <AntSelect
          status={error ? "error" : undefined}
          value={
            value === "" || value === undefined || value === null
              ? undefined
              : value
          }
          onChange={(v) => onChange(field.name, v)}
          allowClear
          placeholder="— Select —"
          options={field.options?.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
        />
        {error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            {error}
          </Text>
        )}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        {label}
        <TextArea
          status={error ? "error" : undefined}
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        {error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            {error}
          </Text>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <AntInput
        status={error ? "error" : undefined}
        type={field.type === "number" ? "number" : field.type}
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            field.name,
            field.type === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
      {error && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {error}
        </Text>
      )}
    </div>
  );
}
