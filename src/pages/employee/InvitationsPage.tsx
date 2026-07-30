import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Table,
  Tag,
  Button as AntButton,
  Popconfirm,
  Empty,
} from "antd";
import { inviteService } from "../../services/inviteService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function statusOf(inv: ResourceRecord): { label: string; color: string } {
  if (inv.status === "USED") return { label: "Used", color: "success" };
  if (inv.status === "CANCELLED")
    return { label: "Cancelled", color: "default" };
  const expiresAt = inv.expiresAt ? new Date(String(inv.expiresAt)) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { label: "Expired", color: "error" };
  }
  return { label: "Pending", color: "processing" };
}

export default function InvitationsPage() {
  const qc = useQueryClient();

  const invitations = useQuery({
    queryKey: ["employees", "invitations"],
    queryFn: () => inviteService.list(),
  });
  // Joined client-side so the invite table can show the candidate's name/code
  // without needing a dedicated backend enrichment endpoint.
  const employees = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => resourceService.list("/employees"),
  });
  const employeeById = new Map(
    ((employees.data ?? []) as ResourceRecord[]).map((e) => [String(e.id), e]),
  );

  const resend = useMutation({
    mutationFn: (id: string) => inviteService.resend(id),
    onSuccess: () => {
      toast.success("Invitation resent");
      qc.invalidateQueries({ queryKey: ["employees", "invitations"] });
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message ?? "Could not resend invitation",
      ),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => inviteService.cancel(id),
    onSuccess: () => {
      toast.success("Invitation cancelled");
      qc.invalidateQueries({ queryKey: ["employees", "invitations"] });
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message ?? "Could not cancel invitation",
      ),
  });

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (_: unknown, row: ResourceRecord) => {
        const emp = employeeById.get(String(row.employeeId));
        return emp
          ? `${emp.employeeCode} — ${emp.firstName} ${emp.lastName}`
          : "—";
      },
    },
    { title: "Login Email", dataIndex: "email", key: "email" },
    { title: "Role", dataIndex: "loginRole", key: "loginRole" },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, row: ResourceRecord) => {
        const s = statusOf(row);
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "Sent",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      title: "Expires",
      dataIndex: "expiresAt",
      key: "expiresAt",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, row: ResourceRecord) => {
        const s = statusOf(row);
        const canAct = s.label !== "Used" && s.label !== "Cancelled";
        return (
          <div style={{ display: "flex", gap: 8 }}>
            <AntButton
              size="small"
              disabled={!canAct}
              loading={resend.isPending}
              onClick={() => resend.mutate(String(row.id))}
            >
              Resend
            </AntButton>
            <Popconfirm
              title="Cancel this invitation?"
              disabled={!canAct}
              onConfirm={() => cancel.mutate(String(row.id))}
            >
              <AntButton size="small" danger disabled={!canAct}>
                Cancel
              </AntButton>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ padding: 24 }}>
        <Title level={3}>Invitations</Title>
        <Table
          rowKey="id"
          loading={invitations.isLoading}
          dataSource={(invitations.data ?? []) as ResourceRecord[]}
          columns={columns}
          locale={{
            emptyText: <Empty description="No invitations sent yet" />,
          }}
        />
      </div>
    </ConfigProvider>
  );
}
