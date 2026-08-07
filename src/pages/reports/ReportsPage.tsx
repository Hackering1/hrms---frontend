import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Card,
  Row,
  Col,
  Table,
  Select as AntSelect,
  DatePicker,
  Space,
  Spin,
  Progress,
} from "antd";
import {
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  PieChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { reportService } from "../../services/reportService";
import { leaveService } from "../../services/leaveService";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import { DonutChart, GroupedBars, pickColor } from "../../components/ui/Charts";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const YEAR = new Date().getFullYear();

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function Loading() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Spin />
    </div>
  );
}

/* Top-level: pick which report to show based on role. */
export default function ReportsPage() {
  const { isHr, isManager, isSuperAdmin } = useRole();
  return (
    <ConfigProvider theme={theme}>
      {isManager && !isSuperAdmin && !isHr ? (
        <ManagerLeaveReport />
      ) : isHr || isSuperAdmin ? (
        <AdminReport />
      ) : (
        <MyLeaveReport />
      )}
    </ConfigProvider>
  );
}

/* Reusable leave-balance charts for ONE employee (pie + bars + table) */
function LeaveCharts({
  employeeId,
  heading,
  subtitle,
  emptyText,
}: {
  employeeId?: string;
  heading: string;
  subtitle: string;
  emptyText: string;
}) {
  const balances = useQuery({
    queryKey: ["balances", employeeId, YEAR],
    queryFn: () => leaveService.balances(employeeId!, YEAR),
    enabled: !!employeeId,
  });

  const types = useQuery({
    queryKey: ["leave-types"],
    queryFn: leaveService.listTypes,
  });

  const typeName = (id: number) =>
    types.data?.find((t) => t.id === id)?.name ?? "Leave type #" + id;

  const rows = balances.data ?? [];

  const totalAllocated = rows.reduce((s, b) => s + (b.allocatedDays ?? 0), 0);
  const totalUsed = rows.reduce((s, b) => s + (b.usedDays ?? 0), 0);
  const totalPending = rows.reduce((s, b) => s + (b.pendingDays ?? 0), 0);
  const totalRemaining = rows.reduce((s, b) => s + (b.balanceDays ?? 0), 0);

  const pieData = rows
    .filter((b) => (b.balanceDays ?? 0) > 0)
    .map((b, i) => ({
      label: typeName(b.leaveTypeId),
      value: b.balanceDays ?? 0,
      color: pickColor(i),
    }));

  const barRows = rows.map((b) => ({
    label: typeName(b.leaveTypeId),
    allocated: b.allocatedDays ?? 0,
    used: b.usedDays ?? 0,
    remaining: b.balanceDays ?? 0,
  }));

  const tableColumns = [
    {
      title: "Leave Type",
      key: "type",
      render: (_: any, b: any) => typeName(b.leaveTypeId),
    },
    { title: "Allocated", dataIndex: "allocatedDays", key: "allocatedDays" },
    { title: "Used", dataIndex: "usedDays", key: "usedDays" },
    { title: "Pending", dataIndex: "pendingDays", key: "pendingDays" },
    { title: "Carried", dataIndex: "carriedDays", key: "carriedDays" },
    {
      title: "Remaining",
      key: "balanceDays",
      render: (_: any, b: any) => (
        <span style={{ fontWeight: 600, color: "#047857" }}>
          {b.balanceDays}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          {heading}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <StatBox
            label="Total Allocated"
            value={totalAllocated}
            color="#4338ca"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatBox label="Used" value={totalUsed} color="#e11d48" />
        </Col>
        <Col xs={12} sm={6}>
          <StatBox label="Pending" value={totalPending} color="#d97706" />
        </Col>
        <Col xs={12} sm={6}>
          <StatBox label="Remaining" value={totalRemaining} color="#047857" />
        </Col>
      </Row>

      {balances.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Card>
          <Text type="secondary">{emptyText}</Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <PieChartOutlined />
                  Remaining balance by leave type
                </Space>
              }
            >
              <DonutChart data={pieData} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <CalendarOutlined />
                  Allocated vs used (per type)
                </Space>
              }
            >
              <GroupedBars rows={barRows} />
            </Card>
          </Col>
        </Row>
      )}

      {rows.length > 0 && (
        <Table
          rowKey={(b: any) => b.id}
          columns={tableColumns}
          dataSource={rows}
          pagination={false}
          size="small"
        />
      )}
    </div>
  );
}

/* EMPLOYEE: own personal leave report */
function MyLeaveReport() {
  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });

  if (me.isLoading) return <Loading />;
  if (me.isError)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          My Leave Report
        </Title>
        <Card>
          <Text type="secondary">
            Your employee profile isn't linked yet, so leave data can't be
            shown. Please contact HR.
          </Text>
        </Card>
      </div>
    );

  return (
    <LeaveCharts
      employeeId={me.data?.id as string}
      heading="My Leave Report"
      subtitle={"Your leave balances for " + YEAR + "."}
      emptyText="No leave balances have been allocated to you yet."
    />
  );
}

/* MANAGER: pick a team employee, see that employee's leave report */
function ManagerLeaveReport() {
  const [selectedId, setSelectedId] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });
  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: !!me.data?.id,
  });

  if (me.isLoading) return <Loading />;
  if (me.isError)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          Team Reports
        </Title>
        <Card>
          <Text type="secondary">
            Your employee profile isn't linked yet, so your team can't be shown.
            Please contact HR.
          </Text>
        </Card>
      </div>
    );

  const teamList = team.data ?? [];
  const selected = teamList.find((e) => String(e.id) === String(selectedId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          Team Reports
        </Title>
        <Text type="secondary">
          Select a team member to see their leave report.
        </Text>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>Team Member</Text>
          <AntSelect
            style={{ maxWidth: 360 }}
            showSearch
            optionFilterProp="label"
            value={selectedId || undefined}
            onChange={(v) => setSelectedId(v)}
            placeholder={"\u2014 Select \u2014"}
            options={teamList.map((e) => ({
              value: String(e.id),
              label:
                e.employeeCode + " \u2014 " + e.firstName + " " + e.lastName,
            }))}
          />
        </div>
      </Card>

      {!selectedId ? (
        <Card>
          <Text type="secondary">
            {teamList.length === 0
              ? "You don't have any team members assigned yet."
              : "Pick a team member above to view their leave report."}
          </Text>
        </Card>
      ) : (
        <LeaveCharts
          employeeId={selectedId}
          heading={
            selected
              ? selected.firstName +
                " " +
                selected.lastName +
                " \u2014 Leave Report"
              : "Leave Report"
          }
          subtitle={"Leave balances for " + YEAR + "."}
          emptyText="No leave balances allocated to this employee yet."
        />
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </Card>
  );
}

/* HR / MANAGER: company-wide report */
function Breakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div>
      <Text strong style={{ display: "block", marginBottom: 8 }}>
        {title}
      </Text>
      {entries.length === 0 ? (
        <Text type="secondary">No data.</Text>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map(([label, count]) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 128,
                  flexShrink: 0,
                  fontSize: 12,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </span>
              <div style={{ flex: 1 }}>
                <Progress
                  percent={Math.round((count / max) * 100)}
                  showInfo={false}
                  strokeColor="#00a8f0"
                  size="small"
                />
              </div>
              <span
                style={{
                  width: 32,
                  textAlign: "right",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#334155",
                }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card styles={{ body: { padding: 16 } }} style={{ background: "#f8fafc" }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#1e293b" }}>
        {value}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </Card>
  );
}

/* SUPER ADMIN: managers overview + company report */
function AdminReport() {
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: () => resourceService.list("/users"),
  });

  const empList = (employees.data ?? []) as ResourceRecord[];
  const managerUserIds = new Set(
    ((users.data ?? []) as any[])
      .filter((u) => Array.isArray(u.roles) && u.roles.includes("MANAGER"))
      .map((u) => String(u.id)),
  );
  const managerEmails = new Set(
    ((users.data ?? []) as any[])
      .filter((u) => Array.isArray(u.roles) && u.roles.includes("MANAGER"))
      .map((u) => String(u.email ?? "").toLowerCase()),
  );
  const managers = empList.filter(
    (e) =>
      ((e as any).userId && managerUserIds.has(String((e as any).userId))) ||
      managerEmails.has(String((e as any).email ?? "").toLowerCase()),
  );

  const teamQueries = useQueries({
    queries: managers.map((m) => ({
      queryKey: ["team", m.id],
      queryFn: () => managerService.team(m.id as string),
      enabled: managers.length > 0,
    })),
  });

  const managerRows = managers.map((m, i) => ({
    manager: m.firstName + " " + m.lastName,
    code: m.employeeCode,
    count: ((teamQueries[i]?.data as any[]) ?? []).length,
  }));

  const totalUnderManagers = managerRows.reduce((s, r) => s + r.count, 0);

  const pieData = managerRows
    .filter((r) => r.count > 0)
    .map((r, i) => ({
      label: r.manager,
      value: r.count,
      color: pickColor(i),
    }));

  const managerColumns = [
    { title: "Manager", dataIndex: "manager", key: "manager" },
    { title: "Code", dataIndex: "code", key: "code" },
    {
      title: "Team Size",
      key: "count",
      render: (_: any, r: any) => (
        <span style={{ fontWeight: 600, color: "#4338ca" }}>{r.count}</span>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          Reports
        </Title>
        <Text type="secondary">
          Managers, their teams, and company-wide leave & attendance.
        </Text>
      </div>

      <div>
        <Space style={{ marginBottom: 8 }}>
          <TeamOutlined />
          <Text strong>Managers & Team Sizes</Text>
        </Space>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8}>
            <StatBox label="Managers" value={managers.length} color="#4338ca" />
          </Col>
          <Col xs={12} sm={8}>
            <StatBox
              label="Employees under managers"
              value={totalUnderManagers}
              color="#047857"
            />
          </Col>
          <Col xs={12} sm={8}>
            <StatBox
              label="Total employees"
              value={empList.length}
              color="#0369a1"
            />
          </Col>
        </Row>

        {employees.isLoading ? (
          <Loading />
        ) : managers.length === 0 ? (
          <Card>
            <Text type="secondary">No managers found.</Text>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Employees per Manager">
                {pieData.length > 0 ? (
                  <DonutChart data={pieData} />
                ) : (
                  <Text type="secondary">No team members assigned yet.</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Table
                rowKey={(r: any) => r.code}
                columns={managerColumns}
                dataSource={managerRows}
                pagination={false}
                size="small"
              />
            </Col>
          </Row>
        )}
      </div>

      <CompanyReport />
    </div>
  );
}

function CompanyReport() {
  const [attDate, setAttDate] = useState(dayjs().format("YYYY-MM-DD"));

  const employees = useQuery({
    queryKey: ["report-employees"],
    queryFn: reportService.employees,
  });
  const leave = useQuery({
    queryKey: ["report-leave"],
    queryFn: reportService.leave,
  });
  const attendance = useQuery({
    queryKey: ["report-attendance", attDate],
    queryFn: () => reportService.attendance(attDate),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* EMPLOYEE REPORT */}
      <div>
        <Space style={{ marginBottom: 8 }}>
          <TeamOutlined />
          <Text strong>Employee Report</Text>
        </Space>
        <Card>
          {employees.isLoading ? (
            <Loading />
          ) : employees.isError ? (
            <Text type="danger">
              Failed to load. (Requires HR or Manager role.)
            </Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                  <Stat
                    label="Total Employees"
                    value={employees.data!.totalEmployees}
                  />
                </Col>
              </Row>
              <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                  <Breakdown
                    title="By Status"
                    data={employees.data!.byStatus}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Breakdown
                    title="By Employment Type"
                    data={employees.data!.byEmploymentType}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Breakdown
                    title="By Department"
                    data={employees.data!.byDepartment}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Breakdown
                    title="By Branch"
                    data={employees.data!.byBranch}
                  />
                </Col>
              </Row>
            </div>
          )}
        </Card>
      </div>

      {/* ATTENDANCE REPORT */}
      <div>
        <Space style={{ marginBottom: 8 }}>
          <ClockCircleOutlined />
          <Text strong>Attendance Report</Text>
        </Space>
        <Card>
          <div style={{ maxWidth: 240, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>Date</Text>
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              value={attDate ? dayjs(attDate) : null}
              onChange={(d) => setAttDate(d ? d.format("YYYY-MM-DD") : attDate)}
            />
          </div>
          {attendance.isLoading ? (
            <Loading />
          ) : attendance.isError ? (
            <Text type="danger">Failed to load.</Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={8}>
                  <Stat label="Records" value={attendance.data!.totalRecords} />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat label="Checked In" value={attendance.data!.checkedIn} />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat
                    label="Checked Out"
                    value={attendance.data!.checkedOut}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat label="Present" value={attendance.data!.present ?? 0} />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat label="Absent" value={attendance.data!.absent ?? 0} />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat
                    label="Regularized"
                    value={attendance.data!.regularized ?? 0}
                  />
                </Col>
              </Row>
              <Breakdown title="By Status" data={attendance.data!.byStatus} />
            </div>
          )}
        </Card>
      </div>

      {/* LEAVE REPORT */}
      <div>
        <Space style={{ marginBottom: 8 }}>
          <CalendarOutlined />
          <Text strong>Leave Report</Text>
        </Space>
        <Card>
          {leave.isLoading ? (
            <Loading />
          ) : leave.isError ? (
            <Text type="danger">Failed to load.</Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={8}>
                  <Stat
                    label="Total Requests"
                    value={leave.data!.totalRequests}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat
                    label="Days Requested"
                    value={leave.data!.totalDaysRequested}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Stat
                    label="Days Approved"
                    value={leave.data!.totalDaysApproved}
                  />
                </Col>
              </Row>
              <Breakdown title="By Status" data={leave.data!.byStatus} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
