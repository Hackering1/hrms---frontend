import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import toast from "react-hot-toast";
import {
  Button,
  ConfigProvider,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { inviteService, type InviteEmployeeInput } from "../../services/inviteService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

interface EditInviteValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  designationId: string;
  managerId?: string;
  dateOfJoining: Dayjs;
  email: string;
  loginRole: string;
}

interface EditingInvite {
  employee: ResourceRecord;
  invite: ResourceRecord;
}

export default function PendingProfilesPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm<EditInviteValues>();
  const [editing, setEditing] = useState<EditingInvite | null>(null);
  const pending = useQuery({
    queryKey: ["employees", "pending"],
    queryFn: () => inviteService.pendingProfiles(),
  });
  const invitations = useQuery({
    queryKey: ["employees", "invitations"],
    queryFn: () => inviteService.list(),
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => resourceService.list("/departments"),
  });
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: () => resourceService.list("/designations"),
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: () => resourceService.list("/users"),
  });

  const inviteByEmployee = new Map<string, ResourceRecord>();
  for (const invite of (invitations.data ?? []) as ResourceRecord[]) {
    if (String(invite.status).toUpperCase() !== "PENDING") continue;
    const employeeId = String(invite.employeeId);
    if (!inviteByEmployee.has(employeeId)) inviteByEmployee.set(employeeId, invite);
  }

  const managers = ((employees.data ?? []) as ResourceRecord[])
    .filter((employee) => {
      const user = ((users.data ?? []) as ResourceRecord[]).find(
        (candidate) => String(candidate.id) === String(employee.userId)
          || String(candidate.email ?? "").toLowerCase() === String(employee.email ?? "").toLowerCase(),
      );
      const roles = Array.isArray(user?.roles) ? user.roles as string[] : [];
      return roles.includes("MANAGER") || roles.includes("SUPER_ADMIN");
    })
    .map((employee) => ({
      value: String(employee.id),
      label: `${employee.employeeCode} — ${employee.firstName} ${employee.lastName}`,
    }));

  const refreshInviteData = () => {
    void qc.invalidateQueries({ queryKey: ["employees", "pending"] });
    void qc.invalidateQueries({ queryKey: ["employees", "invitations"] });
    void qc.invalidateQueries({ queryKey: ["employees"] });
  };
  const resend = useMutation({
    mutationFn: (id: string) => inviteService.resend(id),
    onSuccess: () => {
      toast.success("Invitation email resent");
      refreshInviteData();
    },
    onError: () => toast.error("Could not resend the invitation email. Please try again."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => inviteService.cancel(id),
    onSuccess: () => {
      toast.success("Invitation and unfinished profile deleted");
      refreshInviteData();
    },
    onError: () => toast.error("Could not delete the invitation. Please try again."),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: InviteEmployeeInput }) => inviteService.update(id, body),
    onSuccess: () => {
      toast.success("Invite updated and a fresh invitation email sent");
      setEditing(null);
      refreshInviteData();
    },
    onError: () => toast.error("Could not update the invitation. Please review the details and try again."),
  });

  const openEdit = (employee: ResourceRecord, invite: ResourceRecord) => {
    form.setFieldsValue({
      employeeCode: String(employee.employeeCode ?? ""),
      firstName: String(employee.firstName ?? ""),
      lastName: String(employee.lastName ?? ""),
      departmentId: employee.departmentId == null ? "" : String(employee.departmentId),
      designationId: employee.designationId == null ? "" : String(employee.designationId),
      managerId: employee.reportingManagerId == null ? undefined : String(employee.reportingManagerId),
      dateOfJoining: employee.dateOfJoining ? dayjs(String(employee.dateOfJoining)) : dayjs(),
      email: String(invite.email ?? employee.email ?? ""),
      loginRole: String(invite.loginRole ?? "EMPLOYEE"),
    });
    setEditing({ employee, invite });
  };

  const saveEdit = (values: EditInviteValues) => {
    if (!editing) return;
    const body: InviteEmployeeInput = {
      employeeCode: values.employeeCode.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      departmentId: values.departmentId,
      designationId: values.designationId,
      managerId: values.managerId,
      dateOfJoining: values.dateOfJoining.format("YYYY-MM-DD"),
      email: values.email.trim(),
      loginRole: values.loginRole,
    };
    update.mutate({ id: String(editing.invite.id), body });
  };

  const columns = [
    { title: "Employee Code", dataIndex: "employeeCode", key: "employeeCode" },
    {
      title: "Name",
      key: "name",
      render: (_: unknown, row: ResourceRecord) => `${row.firstName} ${row.lastName}`,
    },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Department",
      key: "department",
      render: (_: unknown, row: ResourceRecord) => row.departmentName ?? "—",
    },
    {
      title: "Designation",
      key: "designation",
      render: (_: unknown, row: ResourceRecord) => row.designationName ?? "—",
    },
    { title: "Date of Joining", dataIndex: "dateOfJoining", key: "dateOfJoining" },
    {
      title: "Onboarding Status",
      key: "onboardingStatus",
      render: () => <Tag color="warning">Invited — awaiting completion</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, row: ResourceRecord) => {
        const invite = inviteByEmployee.get(String(row.id));
        return (
          <Space wrap>
            <Button size="small" disabled={!invite} onClick={() => invite && openEdit(row, invite)}>
              Edit invite
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={!invite}
              loading={resend.isPending}
              onClick={() => invite && resend.mutate(String(invite.id))}
            >
              Resend email
            </Button>
            <Popconfirm
              title="Delete this invitation?"
              description="This also permanently removes the unfinished employee profile and frees its employee code."
              okText="Delete invite"
              okButtonProps={{ danger: true, loading: remove.isPending }}
              onConfirm={() => invite && remove.mutate(String(invite.id))}
            >
              <Button size="small" danger disabled={!invite} loading={remove.isPending}>
                Delete invite
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ padding: 24 }}>
        <Title level={3}>Pending Profiles</Title>
        <Text type="secondary">
          Manage invited employees who have not completed onboarding. Saving edits refreshes the secure invitation link and emails the updated details.
        </Text>
        <div style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            loading={pending.isLoading || invitations.isLoading}
            dataSource={(pending.data ?? []) as ResourceRecord[]}
            columns={columns}
            scroll={{ x: 1000 }}
            locale={{ emptyText: <Empty description="No pending profiles" /> }}
          />
        </div>
      </div>
      <Modal
        title="Edit invitation"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnHidden
      >
        <Text type="secondary">
          Saving replaces the old invitation link, extends the new link for 24 hours, and emails the updated invitation.
        </Text>
        <Form form={form} layout="vertical" onFinish={saveEdit} style={{ marginTop: 18 }}>
          <Form.Item name="employeeCode" label="Employee Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }} align="start">
            <Form.Item name="firstName" label="First Name" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="email" label="Login Email" rules={[{ required: true }, { type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={((departments.data ?? []) as ResourceRecord[]).map((item) => ({ value: String(item.id), label: String(item.name) }))} />
          </Form.Item>
          <Form.Item name="designationId" label="Designation" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={((designations.data ?? []) as ResourceRecord[]).map((item) => ({ value: String(item.id), label: String(item.name) }))} />
          </Form.Item>
          <Form.Item name="managerId" label="Reporting Manager" rules={[{ required: true }]}>
            <Select allowClear showSearch optionFilterProp="label" options={managers} />
          </Form.Item>
          <Form.Item name="dateOfJoining" label="Date of Joining" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="loginRole" label="Login Role" rules={[{ required: true }]}>
            <Select options={[
              { value: "EMPLOYEE", label: "Employee" },
              { value: "MANAGER", label: "Manager" },
            ]} />
          </Form.Item>
          <Space style={{ display: "flex", justifyContent: "end" }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={update.isPending}>
              Save and resend
            </Button>
          </Space>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

