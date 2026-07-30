import { useQuery } from "@tanstack/react-query";
import { ConfigProvider, Typography, Table, Tag, Empty } from "antd";
import { inviteService } from "../../services/inviteService";
import type { ResourceRecord } from "../../utils/types";

const { Title } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export default function PendingProfilesPage() {
  const pending = useQuery({
    queryKey: ["employees", "pending"],
    queryFn: () => inviteService.pendingProfiles(),
  });

  const columns = [
    { title: "Employee Code", dataIndex: "employeeCode", key: "employeeCode" },
    {
      title: "Name",
      key: "name",
      render: (_: unknown, row: ResourceRecord) =>
        `${row.firstName} ${row.lastName}`,
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
    {
      title: "Date of Joining",
      dataIndex: "dateOfJoining",
      key: "dateOfJoining",
    },
    {
      title: "Onboarding Status",
      key: "onboardingStatus",
      render: () => <Tag color="warning">Invited — awaiting completion</Tag>,
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ padding: 24 }}>
        <Title level={3}>Pending Profiles</Title>
        <Typography.Text type="secondary">
          Employees who were invited but haven't finished their own onboarding
          yet. Check the Invitations page to resend or cancel a link.
        </Typography.Text>
        <div style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            loading={pending.isLoading}
            dataSource={(pending.data ?? []) as ResourceRecord[]}
            columns={columns}
            locale={{
              emptyText: <Empty description="No pending profiles" />,
            }}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
