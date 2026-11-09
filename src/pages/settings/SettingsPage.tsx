import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Spin,
  Popconfirm,
} from "antd";
import {
  KeyOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  DeleteOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { authService } from "../../services/authService";
import { apiClient } from "../../services/apiClient";
import { useRole } from "../../hooks/useRole";
import { useAuthStore } from "../../store/authStore";
import type { ApiResponse } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

interface PortalUser {
  id: string;
  email: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: string;
}

// Inlined user API (no separate service file needed)
const userApi = {
  listActive: async (): Promise<PortalUser[]> => {
    const { data } = await apiClient.get<ApiResponse<PortalUser[]>>("/users");
    return data.data;
  },
  listDeleted: async (): Promise<PortalUser[]> => {
    const { data } =
      await apiClient.get<ApiResponse<PortalUser[]>>("/users/deleted");
    return data.data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete("/users/" + id);
  },
  deactivate: async (id: string): Promise<void> => {
    await apiClient.post("/users/" + id + "/deactivate");
  },
  restore: async (id: string): Promise<void> => {
    await apiClient.post("/users/" + id + "/restore");
  },
  changeRole: async (id: string, roleName: string): Promise<void> => {
    await apiClient.put("/users/" + id + "/role", { roleName });
  },
};

export default function SettingsPage() {
  const { isSuperAdmin } = useRole();
  const [tab, setTab] = useState("account");

  const items = isSuperAdmin
    ? [
        {
          key: "account",
          label: "Account",
          children: <AccountTab isSuperAdmin={isSuperAdmin} />,
        },
        {
          key: "active",
          label: "Active Users",
          children: <UsersTab mode="active" />,
        },
        {
          key: "deleted",
          label: "Deleted Users",
          children: <UsersTab mode="deleted" />,
        },
      ]
    : [
        {
          key: "account",
          label: "Account",
          children: <AccountTab isSuperAdmin={isSuperAdmin} />,
        },
      ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          Settings
        </Title>
        <Tabs activeKey={tab} onChange={setTab} items={items} />
      </div>
    </ConfigProvider>
  );
}

function FieldRow({
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

function AccountTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const clearMustChange = useAuthStore((s) => s.clearMustChange);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const changeMine = useMutation({
    mutationFn: () => authService.changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirmPwd("");
      clearMustChange();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not change password"),
  });

  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: userApi.listActive,
    enabled: isSuperAdmin,
  });
  const [targetEmail, setTargetEmail] = useState("");
  const [resetPwd, setResetPwd] = useState("User@0412");

  // SA #9: create another Super Admin (super-admin only).
  const qc = useQueryClient();
  const [newSaEmail, setNewSaEmail] = useState("");
  const [newSaPassword, setNewSaPassword] = useState("");
  const createSuperAdmin = useMutation({
    mutationFn: () =>
      authService.register(newSaEmail.trim(), newSaPassword, "SUPER_ADMIN"),
    onSuccess: () => {
      toast.success("Super Admin created: " + newSaEmail.trim());
      setNewSaEmail("");
      setNewSaPassword("");
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not create Super Admin"),
  });

  const resetOther = useMutation({
    mutationFn: () => authService.adminResetPassword(targetEmail, resetPwd),
    onSuccess: () => {
      toast.success("Password reset for " + targetEmail);
      setTargetEmail("");
      setResetPwd("User@0412");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Reset failed"),
  });

  const userList: PortalUser[] = users.data ?? [];

  return (
    <div
      style={{
        maxWidth: 640,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <Card
        title={
          <Space>
            <KeyOutlined style={{ color: "#0d9488" }} />
            Change My Password
          </Space>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldRow label="Current password">
            <AntInput.Password
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="New password">
            <AntInput.Password
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Confirm new password">
            <AntInput.Password
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </FieldRow>
          {confirmPwd && next !== confirmPwd && (
            <Text type="danger" style={{ fontSize: 12 }}>
              New password and confirmation don't match.
            </Text>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <AntButton
              type="primary"
              loading={changeMine.isPending}
              disabled={!current || !next || next !== confirmPwd}
              onClick={() => changeMine.mutate()}
            >
              Update Password
            </AntButton>
          </div>
        </div>
      </Card>

      {isSuperAdmin && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: "#0d9488" }} />
              Reset a User's Password
              <Tag color="cyan">Super Admin</Tag>
            </Space>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="User">
              <AntSelect
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="label"
                value={targetEmail || undefined}
                onChange={(v) => setTargetEmail(v)}
                placeholder={"\u2014 Select \u2014"}
                options={userList.map((u) => ({
                  value: u.email,
                  label: u.email + " (" + u.roles.join(", ") + ")",
                }))}
              />
            </FieldRow>
            <FieldRow label="New password">
              <AntInput
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
              />
            </FieldRow>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <AntButton
                type="primary"
                loading={resetOther.isPending}
                disabled={!targetEmail || !resetPwd}
                onClick={() => resetOther.mutate()}
              >
                Reset Password
              </AntButton>
            </div>
          </div>
        </Card>
      )}

      {isSuperAdmin && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: "#0d9488" }} />
              Create Super Admin
              <Tag color="cyan">Super Admin</Tag>
            </Space>
          }
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Creates a new login with full Super Admin access. Only Super Admins
            can do this. The new user should change their password after first
            sign-in.
          </Text>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            <FieldRow label="Email">
              <AntInput
                type="email"
                placeholder="name@technnext.com"
                value={newSaEmail}
                onChange={(e) => setNewSaEmail(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Temporary password">
              <AntInput
                value={newSaPassword}
                onChange={(e) => setNewSaPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </FieldRow>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <AntButton
                type="primary"
                loading={createSuperAdmin.isPending}
                disabled={!newSaEmail.trim() || newSaPassword.trim().length < 6}
                onClick={() => createSuperAdmin.mutate()}
              >
                Create Super Admin
              </AntButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function UsersTab({ mode }: { mode: "active" | "deleted" }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: [mode === "active" ? "activeUsers" : "deletedUsers"],
    queryFn: mode === "active" ? userApi.listActive : userApi.listDeleted,
  });

  const remove = useMutation({
    mutationFn: (id: string) => userApi.deactivate(id),
    onSuccess: () => {
      toast.success("User moved to Deleted Users");
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  // Permanent (hard) delete — used only from the Deleted Users tab.
  const removePermanent = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      toast.success("User permanently deleted");
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const restore = useMutation({
    mutationFn: (id: string) => userApi.restore(id),
    onSuccess: () => {
      toast.success("User restored");
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  if (list.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }
  const rows: PortalUser[] = list.data ?? [];

  const columns = [
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Role",
      key: "role",
      render: (_: any, u: any) => <Tag>{u.roles.join(", ") || "\u2014"}</Tag>,
    },
    {
      title: "Last Login",
      key: "lastLogin",
      render: (_: any, u: any) =>
        u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "\u2014",
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, u: any) =>
        mode === "active" ? (
          <Popconfirm
            title="Move this user to Deleted Users?"
            description="You can restore them later."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutate(u.id)}
          >
            <AntButton size="small" danger icon={<DeleteOutlined />}>
              Delete
            </AntButton>
          </Popconfirm>
        ) : (
          <Space>
            <AntButton
              size="small"
              icon={<UndoOutlined />}
              onClick={() => restore.mutate(u.id)}
            >
              Restore
            </AntButton>
            <Popconfirm
              title="Permanently delete this user?"
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => removePermanent.mutate(u.id)}
            >
              <AntButton size="small" danger icon={<DeleteOutlined />}>
                Delete
              </AntButton>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <TeamOutlined style={{ color: "#0d9488" }} />
        <Text strong>
          {mode === "active" ? "Active Users" : "Deleted Users"} ({rows.length})
        </Text>
      </Space>
      <Table
        rowKey={(u: any) => u.id}
        columns={columns}
        dataSource={rows}
        locale={{
          emptyText:
            mode === "active" ? "No active users." : "No deleted users.",
        }}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
