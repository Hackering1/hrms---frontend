import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
  Table,
  Tag,
  Modal as AntModal,
  Space,
} from "antd";
import { PlusOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { leaveService, type LeaveApplyBody } from "../../services/leaveService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title } = Typography;
const { TextArea } = AntInput;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const statusColor: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
};

export default function LeaveRequestsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeaveApplyBody>({
    employeeId: "",
    leaveTypeId: 0,
    fromDate: "",
    toDate: "",
    numberOfDays: 1,
    dayType: "FULL",
    reason: "",
  });

  const requests = useQuery({
    queryKey: ["leaveRequests"],
    queryFn: leaveService.listAll,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  // includeDeleted=true so a leave request tied to a since-removed employee
  // still resolves to a name + email instead of the raw UUID.
  const employeesAll = useQuery({
    queryKey: ["employees", "includeDeleted"],
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  const leaveTypes = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: () => resourceService.list("/leave-types"),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["leaveRequests"] });

  const applyMut = useMutation({
    mutationFn: () => leaveService.apply(form),
    onSuccess: () => {
      invalidate();
      setOpen(false);
    },
  });

  const decideMut = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "APPROVED" | "REJECTED";
    }) => leaveService.decide(id, { approvedBy: null, status }),
    onSuccess: invalidate,
  });

  const change = (k: keyof LeaveApplyBody, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const empName = (id: string) => {
    const e = (employeesAll.data ?? []).find(
      (x: ResourceRecord) => x.id === id,
    );
    if (!e) return id;
    const name = `${e.employeeCode} — ${e.firstName} ${e.lastName}`;
    return e.email ? `${name} (${e.email})` : name;
  };
  const typeName = (id: number) => {
    const t = (leaveTypes.data ?? []).find((x: ResourceRecord) => x.id === id);
    return t ? t.name : id;
  };

  const rows = requests.data ?? [];

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (_: any, r: any) => empName(r.employeeId),
    },
    {
      title: "Type",
      key: "type",
      render: (_: any, r: any) => typeName(r.leaveTypeId),
    },
    { title: "From", dataIndex: "fromDate", key: "fromDate" },
    { title: "To", dataIndex: "toDate", key: "toDate" },
    { title: "Days", dataIndex: "numberOfDays", key: "numberOfDays" },
    { title: "Reason", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={statusColor[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, r: any) =>
        r.status === "PENDING" ? (
          <Space>
            <AntButton
              size="small"
              icon={<CheckOutlined />}
              onClick={() => decideMut.mutate({ id: r.id, status: "APPROVED" })}
              style={{ color: "#16a34a" }}
            />
            <AntButton
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => decideMut.mutate({ id: r.id, status: "REJECTED" })}
            />
          </Space>
        ) : (
          "—"
        ),
    },
  ];

  const canSubmit =
    !applyMut.isPending &&
    form.employeeId &&
    form.leaveTypeId &&
    form.fromDate &&
    form.toDate &&
    form.reason;

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
          <Title level={2} style={{ margin: 0 }}>
            Leave Requests
          </Title>
          <AntButton
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
          >
            Apply for Leave
          </AntButton>
        </div>

        <Table
          loading={requests.isLoading}
          rowKey={(r: any) => r.id}
          columns={columns}
          dataSource={rows}
          scroll={{ x: true }}
          locale={{
            emptyText: requests.isError
              ? "Failed to load. Is the backend running?"
              : "No leave requests yet.",
          }}
          pagination={{ pageSize: 10 }}
        />

        <AntModal
          open={open}
          title="Apply for Leave"
          onCancel={() => setOpen(false)}
          footer={[
            <AntButton key="cancel" onClick={() => setOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              loading={applyMut.isPending}
              disabled={!canSubmit}
              onClick={() => applyMut.mutate()}
            >
              Apply
            </AntButton>,
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Employee">
              <AntSelect
                value={form.employeeId || undefined}
                onChange={(v) => change("employeeId", v)}
                placeholder="— Select —"
                options={(employees.data ?? []).map((e: ResourceRecord) => ({
                  value: e.id,
                  label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
                }))}
              />
            </Field>
            <Field label="Leave Type">
              <AntSelect
                value={form.leaveTypeId || undefined}
                onChange={(v) => change("leaveTypeId", v)}
                placeholder="— Select —"
                options={(leaveTypes.data ?? []).map((t: ResourceRecord) => ({
                  value: t.id,
                  label: t.name,
                }))}
              />
            </Field>
            <Field label="From Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.fromDate ? dayjs(form.fromDate) : null}
                onChange={(d) =>
                  change("fromDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </Field>
            <Field label="To Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.toDate ? dayjs(form.toDate) : null}
                onChange={(d) =>
                  change("toDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </Field>
            <Field label="Number of Days">
              <AntInput
                type="number"
                value={form.numberOfDays}
                onChange={(e) => change("numberOfDays", Number(e.target.value))}
              />
            </Field>
            <Field label="Reason">
              <TextArea
                rows={3}
                value={form.reason}
                onChange={(e) => change("reason", e.target.value)}
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
      <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}
