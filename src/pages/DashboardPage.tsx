import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  ConfigProvider,
  Row,
  Col,
  Card,
  Progress,
  Badge,
  Typography,
  Button as AntButton,
  List,
  Empty,
  Space,
  Tag,
  Modal,
  Table,
} from "antd";
import {
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UsergroupAddOutlined,
  BarChartOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { selfService } from "../services/selfService";
import { attendanceService } from "../services/attendanceService";
import { resourceService } from "../services/resourceService";
import { leaveService } from "../services/leaveService";
import { managerService } from "../services/managerService";
import { useRole } from "../hooks/useRole";

const { Title, Text } = Typography;
// Local calendar date (not UTC) — new Date().toISOString() always converts
// to UTC first, which is the wrong day during India's midnight–5:30 AM IST
// window (backend correctly runs in IST; this was silently mismatched with
// it, showing yesterday's attendance as "today's" during that window).
const TODAY = dayjs().format("YYYY-MM-DD");
const YEAR = new Date().getFullYear();

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 12,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const leaveStatusColor: Record<string, string> = {
  APPROVED: "success",
  REJECTED: "error",
  PENDING: "warning",
};

export default function DashboardPage() {
  const { isSuperAdmin, isHr, isManager } = useRole();
  const scope =
    isSuperAdmin || isHr ? "admin" : isManager ? "manager" : "employee";

  return (
    <ConfigProvider theme={theme}>
      {scope === "employee" && <EmployeeHome />}
      {scope === "manager" && <ManagerHome />}
      {scope === "admin" && <AdminHome />}
    </ConfigProvider>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Greeting({
  subtitle,
  checkInTo = "/attendance",
}: {
  subtitle: string;
  checkInTo?: string;
}) {
  return (
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
          {greeting()}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>
      <Space>
        <Link to={checkInTo}>
          <AntButton type="primary" icon={<ClockCircleOutlined />}>
            Check in
          </AntButton>
        </Link>
        <Link to="/leave">
          <AntButton icon={<CalendarOutlined />}>Apply leave</AntButton>
        </Link>
      </Space>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <div style={{ fontSize: 12, color: warn ? "#d97706" : "#64748b" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {hint}
        </Text>
      )}
    </Card>
  );
}

function RingCard({
  label,
  pct,
  valueLabel,
  onClick,
}: {
  label: string;
  pct: number;
  valueLabel: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      className={onClick ? "card-hover" : undefined}
    >
      <Space align="center" size={16}>
        <Progress type="circle" percent={pct} size={56} strokeColor="#00a8f0" />
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Text>
          <div style={{ fontWeight: 600 }}>{valueLabel}</div>
        </div>
      </Space>
    </Card>
  );
}

function AppTiles({
  tiles,
}: {
  tiles: {
    to: string;
    icon: React.ReactNode;
    label: string;
    color: string;
    bg: string;
  }[];
}) {
  return (
    <div>
      <Text
        type="secondary"
        style={{ fontSize: 11, letterSpacing: 1, fontWeight: 500 }}
      >
        YOUR APPS
      </Text>
      <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
        {tiles.map((t) => (
          <Col xs={12} sm={8} lg={6} key={t.label}>
            <Link to={t.to}>
              <Card hoverable styles={{ body: { padding: 16 } }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: t.bg,
                    color: t.color,
                    fontSize: 18,
                    marginBottom: 12,
                  }}
                >
                  {t.icon}
                </div>
                <Text strong style={{ fontSize: 13 }}>
                  {t.label}
                </Text>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  );
}

function QuickActions({
  actions,
}: {
  actions: { to: string; icon: React.ReactNode; label: string }[];
}) {
  return (
    <Card title="Quick actions">
      <Row gutter={8}>
        {actions.map((qa) => (
          <Col span={24 / actions.length} key={qa.label}>
            <Link to={qa.to}>
              <div
                style={{
                  border: "1px solid #e5e9e9",
                  borderRadius: 8,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#00a8f0", marginBottom: 4 }}>
                  {qa.icon}
                </div>
                <Text style={{ fontSize: 11 }}>{qa.label}</Text>
              </div>
            </Link>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

/* ─────────────────────────── EMPLOYEE ─────────────────────────── */

function EmployeeHome() {
  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });
  const myId = me.data?.id as string | undefined;

  const myAtt = useQuery({
    queryKey: ["attendance", myId, TODAY],
    queryFn: () => attendanceService.history(myId as string),
    enabled: !!myId,
  });
  const myBal = useQuery({
    queryKey: ["balances", myId, YEAR],
    queryFn: () => leaveService.balances(myId as string, YEAR),
    enabled: !!myId,
  });
  const myReq = useQuery({
    queryKey: ["myLeave", myId],
    queryFn: () => leaveService.byEmployee(myId as string),
    enabled: !!myId,
  });

  const todayRec = ((myAtt.data as any[]) ?? []).find(
    (a) => a.attendanceDate === TODAY,
  );
  const totalBal = ((myBal.data as any[]) ?? []).reduce(
    (s, b) => s + (b.balanceDays ?? 0),
    0,
  );
  const myReqList = (myReq.data as any[]) ?? [];
  const myPending = myReqList.filter((r) => r.status === "PENDING");

  // #6: show the employee's reporting manager right in the greeting.
  const subtitle =
    "Welcome back" +
    (me.data ? ", " + me.data.firstName : "") +
    (me.data?.reportingManagerName
      ? "  \u00B7  Reporting Manager: " + me.data.reportingManagerName
      : "") +
    "  \u2014  here's your day";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Greeting subtitle={subtitle} />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <RingCard
            label="Today"
            pct={todayRec?.status === "PRESENT" ? 100 : 0}
            valueLabel={todayRec?.status ?? "Not marked"}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="Leave balance"
            value={totalBal}
            hint="days available"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="My pending"
            value={myPending.length}
            hint="awaiting approval"
            warn={myPending.length > 0}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard label="This year" value={YEAR} hint="leave year" />
        </Col>
      </Row>

      <AppTiles
        tiles={[
          {
            to: "/attendance",
            icon: <ClockCircleOutlined />,
            label: "Attendance",
            color: "#059669",
            bg: "#ecfdf5",
          },
          {
            to: "/leave",
            icon: <CalendarOutlined />,
            label: "Leave",
            color: "#dc2626",
            bg: "#fef2f2",
          },
          {
            to: "/documents/employee",
            icon: <FileTextOutlined />,
            label: "My Documents",
            color: "#7c3aed",
            bg: "#f5f3ff",
          },
          {
            to: "/my-profile",
            icon: <UserOutlined />,
            label: "My Profile",
            color: "#00a8f0",
            bg: "#f0fdfa",
          },
        ]}
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            title="My recent leave"
            extra={
              myPending.length > 0 && (
                <Badge count={myPending.length} color="#d97706" />
              )
            }
          >
            {myReqList.length === 0 ? (
              <Empty
                description="No leave requests yet."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={myReqList.slice(0, 5)}
                renderItem={(r: any) => (
                  <List.Item
                    extra={
                      <Tag color={leaveStatusColor[r.status] ?? "default"}>
                        {r.status}
                      </Tag>
                    }
                  >
                    <Text style={{ fontSize: 12.5 }}>
                      {r.fromDate} {"\u2192"} {r.toDate}
                    </Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <QuickActions
            actions={[
              {
                to: "/attendance",
                icon: <ClockCircleOutlined />,
                label: "Check in",
              },
              {
                to: "/leave",
                icon: <CalendarOutlined />,
                label: "Apply leave",
              },
              {
                to: "/documents/employee",
                icon: <FileTextOutlined />,
                label: "My docs",
              },
            ]}
          />
        </Col>
      </Row>
    </div>
  );
}

/* ─────────────────────────── MANAGER (team-scoped) ─────────────────────────── */

function ManagerHome() {
  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });
  const myId = me.data?.id as string | undefined;
  const team = useQuery({
    queryKey: ["team", myId],
    queryFn: () => managerService.team(myId as string),
    enabled: !!myId,
  });
  const teamList = (team.data ?? []) as any[];
  const teamIds = new Set(teamList.map((e) => e.id));
  const allLeave = useQuery({
    queryKey: ["allLeave"],
    queryFn: leaveService.listAll,
  });
  const pending = useQuery({
    queryKey: ["pendingLeaves"],
    queryFn: leaveService.pending,
  });

  const attQ = useQueries({
    queries: teamList.map((m) => ({
      queryKey: ["attendance", m.id, TODAY],
      queryFn: () => attendanceService.history(m.id as string),
      enabled: teamList.length > 0,
    })),
  });
  const present = attQ.filter((q) =>
    ((q.data as any[]) ?? []).some(
      (a: any) => a.attendanceDate === TODAY && a.status === "PRESENT",
    ),
  ).length;
  const onLeave = teamList.filter((e) =>
    ((allLeave.data as any[]) ?? []).some(
      (r) =>
        r.employeeId === e.id &&
        r.status === "APPROVED" &&
        r.fromDate <= TODAY &&
        r.toDate >= TODAY,
    ),
  ).length;
  const teamPending = ((pending.data as any[]) ?? []).filter((r) =>
    teamIds.has(r.employeeId),
  );
  const pct = teamList.length
    ? Math.round((present / teamList.length) * 100)
    : 0;

  const empName = (id: string) => {
    const e = teamList.find((x) => x.id === id);
    return e ? e.firstName + " " + e.lastName : "Team member";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Greeting subtitle="Here's how your team is doing today" />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <RingCard
            label="Team present"
            pct={pct}
            valueLabel={present + "/" + teamList.length}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="My team"
            value={teamList.length}
            hint="direct reports"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard label="On leave" value={onLeave} hint="today" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="Approvals"
            value={teamPending.length}
            hint="waiting on you"
            warn={teamPending.length > 0}
          />
        </Col>
      </Row>

      <AppTiles
        tiles={[
          {
            to: "/manager",
            icon: <UsergroupAddOutlined />,
            label: "My Team",
            color: "#00a8f0",
            bg: "#f0fdfa",
          },
          {
            to: "/leave",
            icon: <CalendarOutlined />,
            label: "Approvals",
            color: "#dc2626",
            bg: "#fef2f2",
          },
          {
            to: "/attendance",
            icon: <ClockCircleOutlined />,
            label: "Attendance",
            color: "#059669",
            bg: "#ecfdf5",
          },
          {
            to: "/regularization",
            icon: <ClockCircleOutlined />,
            label: "Regularization",
            color: "#ca8a04",
            bg: "#fefce8",
          },
        ]}
      />

      <Card
        title="Approvals waiting on you"
        extra={
          teamPending.length > 0 && (
            <Badge count={teamPending.length} color="#d97706" />
          )
        }
      >
        {teamPending.length === 0 ? (
          <Empty
            description="No approvals pending. All caught up."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={teamPending.slice(0, 6)}
            renderItem={(r: any) => (
              <List.Item>
                <Link
                  to="/leave"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <Badge status="warning" />
                  <Text style={{ flex: 1, fontSize: 12.5 }}>
                    {empName(r.employeeId)} {"\u00B7"} {r.fromDate} {"\u2192"}{" "}
                    {r.toDate}
                  </Text>
                </Link>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────────── ADMIN / HR (org-wide) ─────────────────────────── */

function AdminHome() {
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const empList = (employees.data ?? []) as any[];
  const pending = useQuery({
    queryKey: ["pendingLeaves"],
    queryFn: leaveService.pending,
  });
  const allLeave = useQuery({
    queryKey: ["allLeave"],
    queryFn: leaveService.listAll,
  });

  const attQ = useQueries({
    queries: empList.map((m) => ({
      queryKey: ["attendance", m.id, TODAY],
      queryFn: () => attendanceService.history(m.id as string),
      enabled: empList.length > 0,
    })),
  });
  const present = attQ.filter((q) =>
    ((q.data as any[]) ?? []).some(
      (a: any) => a.attendanceDate === TODAY && a.status === "PRESENT",
    ),
  ).length;
  const onLeaveIds = new Set(
    ((allLeave.data as any[]) ?? [])
      .filter(
        (r) =>
          r.status === "APPROVED" && r.fromDate <= TODAY && r.toDate >= TODAY,
      )
      .map((r) => r.employeeId),
  );
  const onLeave = empList.filter((e) => onLeaveIds.has(e.id)).length;
  const pendingList = (pending.data as any[]) ?? [];
  const pendingCount = pendingList.length;
  const pct = empList.length ? Math.round((present / empList.length) * 100) : 0;
  const empName = (id: string) => {
    const e = empList.find((x) => x.id === id);
    return e ? e.firstName + " " + e.lastName : "Employee";
  };

  const [presentModalOpen, setPresentModalOpen] = useState(false);
  // Built entirely from data already fetched above for the existing present
  // count (empList + attQ) — no new API call, no new endpoint.
  const presentEmployeesToday = empList
    .map((e, i) => {
      const rec = ((attQ[i]?.data as any[]) ?? []).find(
        (a: any) => a.attendanceDate === TODAY && a.status === "PRESENT",
      );
      if (!rec) return null;
      return {
        key: String(e.id),
        name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || "Employee",
        code: e.employeeCode ?? "-",
        checkInTime: rec.checkInTime
          ? dayjs(rec.checkInTime).format("hh:mm A")
          : "-",
        manager: e.reportingManagerName || "Not Assigned",
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Greeting subtitle="Here's what's happening at TechNext today" />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <RingCard
            label="Today's attendance"
            pct={pct}
            valueLabel={present + "/" + empList.length + " present"}
            onClick={() => setPresentModalOpen(true)}
          />
          <AntButton
            type="link"
            size="small"
            style={{ padding: "4px 0" }}
            onClick={() => setPresentModalOpen(true)}
          >
            View Present Employees
          </AntButton>
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="Employees"
            value={empList.length}
            hint="total headcount"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard label="On leave" value={onLeave} hint="today" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label="Pending"
            value={pendingCount}
            hint="need approval"
            warn={pendingCount > 0}
          />
        </Col>
      </Row>

      <AppTiles
        tiles={[
          {
            to: "/employees",
            icon: <TeamOutlined />,
            label: "Employees",
            color: "#00a8f0",
            bg: "#f0fdfa",
          },
          {
            to: "/attendance",
            icon: <ClockCircleOutlined />,
            label: "Attendance",
            color: "#059669",
            bg: "#ecfdf5",
          },
          {
            to: "/leave",
            icon: <CalendarOutlined />,
            label: "Leave",
            color: "#dc2626",
            bg: "#fef2f2",
          },
          {
            to: "/regularization",
            icon: <ClockCircleOutlined />,
            label: "Regularization",
            color: "#ca8a04",
            bg: "#fefce8",
          },
          {
            to: "/letters/formatted",
            icon: <FileTextOutlined />,
            label: "Letters",
            color: "#2563eb",
            bg: "#eff6ff",
          },
          {
            to: "/manager",
            icon: <UsergroupAddOutlined />,
            label: "Manager Portal",
            color: "#00a8f0",
            bg: "#f0fdfa",
          },
          {
            to: "/reports",
            icon: <BarChartOutlined />,
            label: "Reports",
            color: "#db2777",
            bg: "#fdf2f8",
          },
          {
            to: "/documents/employee",
            icon: <FileTextOutlined />,
            label: "Documents",
            color: "#7c3aed",
            bg: "#f5f3ff",
          },
        ]}
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            title="Awaiting approval"
            extra={
              pendingCount > 0 && <Badge count={pendingCount} color="#d97706" />
            }
          >
            {pendingList.length === 0 ? (
              <Empty
                description="Nothing pending. All caught up."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={pendingList.slice(0, 5)}
                renderItem={(r: any) => (
                  <List.Item>
                    <Link
                      to="/leave"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                      }}
                    >
                      <Badge status="warning" />
                      <Text style={{ flex: 1, fontSize: 12.5 }}>
                        {empName(r.employeeId)}'s leave request
                      </Text>
                    </Link>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <QuickActions
            actions={[
              { to: "/employees", icon: <TeamOutlined />, label: "Employees" },
              {
                to: "/letters/formatted",
                icon: <FileTextOutlined />,
                label: "Letters",
              },
              {
                to: "/regularization",
                icon: <ClockCircleOutlined />,
                label: "Regularize",
              },
            ]}
          />
        </Col>
      </Row>

      <Modal
        title="Present Employees — Today"
        open={presentModalOpen}
        onCancel={() => setPresentModalOpen(false)}
        footer={null}
        width={720}
      >
        <Table
          size="small"
          rowKey="key"
          dataSource={presentEmployeesToday}
          pagination={false}
          scroll={{ x: true }}
          locale={{
            emptyText: "No employees are currently marked present today.",
          }}
          columns={[
            { title: "Employee Name", dataIndex: "name", key: "name" },
            { title: "Employee ID", dataIndex: "code", key: "code" },
            {
              title: "Check-in Time",
              dataIndex: "checkInTime",
              key: "checkInTime",
            },
            { title: "Manager", dataIndex: "manager", key: "manager" },
          ]}
        />
      </Modal>
    </div>
  );
}
