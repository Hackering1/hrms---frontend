import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Select as AntSelect,
  Table,
  Tag,
  Card,
  Segmented,
  Modal as AntModal,
  Input as AntInput,
  DatePicker,
  TimePicker,
  Row,
  Col,
  Space,
  Spin,
  Alert,
} from "antd";
import {
  LoginOutlined,
  LogoutOutlined,
  CheckOutlined,
  TeamOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import CheckInModal from "../../components/CheckInModal";
import CheckOutModal from "../../components/CheckOutModal";
import AuthedImage from "../../components/AuthedImage";
import AttendanceCalendar from "../../pages-shared/AttendanceCalendar";
import { attendanceService } from "../../services/attendanceService";
import { leaveService } from "../../services/leaveService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;
const { TextArea } = AntInput;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const BULK_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "ON_DUTY", "WFH"];

const REG_TYPES = [
  { value: "MISSED_CHECK_IN", label: "Missed Check-in" },
  { value: "MISSED_CHECK_OUT", label: "Missed Check-out" },
  { value: "WRONG_TIME", label: "Wrong Time Recorded" },
  { value: "ON_DUTY", label: "On Duty / Client Site" },
  { value: "WORK_FROM_HOME", label: "Work From Home" },
];

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

function formatSecs(totalSecs: number) {
  if (totalSecs < 0) totalSecs = 0;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return (
    h +
    "h " +
    String(m).padStart(2, "0") +
    "m " +
    String(s).padStart(2, "0") +
    "s"
  );
}

function durationHMS(inT?: string, outT?: string) {
  if (!inT || !outT) return "—";
  const start = new Date(inT).getTime();
  const end = new Date(outT).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return "—";
  return formatSecs(Math.floor((end - start) / 1000));
}

function LiveDuration({
  checkInTime,
  checkOutTime,
}: {
  checkInTime?: string;
  checkOutTime?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const isRunning = !!checkInTime && !checkOutTime;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!checkInTime) return <Text type="secondary">Not checked in</Text>;
  const start = new Date(checkInTime).getTime();
  const end = checkOutTime ? new Date(checkOutTime).getTime() : now;
  const secs = Math.floor((end - start) / 1000);
  return (
    <span style={{ color: isRunning ? "#059669" : "#1e293b" }}>
      {formatSecs(secs)}
      {isRunning && (
        <span
          style={{
            marginLeft: 8,
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#10b981",
            verticalAlign: "middle",
          }}
        />
      )}
    </span>
  );
}

// Standard workday length used to compute "time remaining" while checked in.
// Office hours 10-6 = 8 hours. Change this ONE value if the workday length
// changes. (If shifts ever carry per-employee durations, pass it in as a prop
// instead of using this constant.)
const STANDARD_WORKDAY_HOURS = 8;
const STANDARD_WORKDAY_SECONDS = STANDARD_WORKDAY_HOURS * 3600;

function RemainingTime({
  checkInTime,
  checkOutTime,
}: {
  checkInTime?: string;
  checkOutTime?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const isRunning = !!checkInTime && !checkOutTime;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!checkInTime) return null;
  const start = new Date(checkInTime).getTime();
  const end = checkOutTime ? new Date(checkOutTime).getTime() : now;
  const workedSecs = Math.floor((end - start) / 1000);
  const remainingSecs = STANDARD_WORKDAY_SECONDS - workedSecs;

  if (remainingSecs > 0) {
    return (
      <span style={{ color: "#0f766e" }}>
        {formatSecs(remainingSecs)}
        <Text
          type="secondary"
          style={{ fontSize: 12, fontWeight: 400, marginLeft: 6 }}
        >
          left of {STANDARD_WORKDAY_HOURS}h
        </Text>
      </span>
    );
  }
  return (
    <span style={{ color: "#16a34a" }}>
      <CheckOutlined /> Target met
      <Text
        style={{
          fontSize: 12,
          fontWeight: 400,
          marginLeft: 6,
          color: "#d97706",
        }}
      >
        +{formatSecs(Math.abs(remainingSecs))} over {STANDARD_WORKDAY_HOURS}h
      </Text>
    </span>
  );
}

export default function AttendancePage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isHr, isManager } = useRole();

  const ownOnly = !isSuperAdmin && !isHr && !isManager;
  const managerScoped = isManager && !isSuperAdmin && !isHr;

  const [employeeId, setEmployeeId] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Use the browser's LOCAL date (IST here), not UTC. new Date().toISOString()
  // returns a UTC date, which is the PREVIOUS day between 00:00-05:30 IST and
  // caused check-out to fail with "No check-in found for today" (the backend
  // uses IST LocalDate.now()).
  const today = dayjs().format("YYYY-MM-DD");

  // Bulk-mark state (super admin only)
  const [bulkDate, setBulkDate] = useState(today);
  const [bulkStatus, setBulkStatus] = useState("PRESENT");
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);

  // Check-in / check-out modals (location + selfie required)
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  // Regularization modal state
  const [regOpen, setRegOpen] = useState(false);
  const [regDate, setRegDate] = useState(today);
  const [regType, setRegType] = useState("MISSED_CHECK_IN");
  const [regIn, setRegIn] = useState("");
  const [regOut, setRegOut] = useState("");
  const [regReason, setRegReason] = useState("");

  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: ownOnly || managerScoped,
  });
  useEffect(() => {
    if (ownOnly && me.data?.id) setEmployeeId(me.data.id as string);
  }, [ownOnly, me.data]);

  const myTeam = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
    enabled: !ownOnly && !managerScoped,
  });

  const pickerOptions: ResourceRecord[] = managerScoped
    ? [
        ...(me.data ? [me.data as ResourceRecord] : []),
        ...((myTeam.data ?? []) as ResourceRecord[]),
      ]
    : ((employees.data ?? []) as ResourceRecord[]);

  const history = useQuery({
    queryKey: ["attendance", employeeId],
    queryFn: () => attendanceService.history(employeeId),
    enabled: !!employeeId,
  });

  // #4: the selected employee's own regularization requests (with status).
  const myReg = useQuery({
    queryKey: ["myRegularizations", employeeId],
    queryFn: () => attendanceService.myRegularizations(employeeId),
    enabled: !!employeeId,
  });

  // #9: this employee's leave requests, used to block regularizing a leave day.
  const empLeaves = useQuery({
    queryKey: ["empLeaves", employeeId],
    queryFn: () => leaveService.byEmployee(employeeId),
    enabled: !!employeeId,
  });

  const regTypeLabel = (v: string) =>
    REG_TYPES.find((t) => t.value === v)?.label ?? v;

  const raiseReg = useMutation({
    mutationFn: () => {
      if (!regReason.trim()) throw new Error("Please enter a reason");
      if (regBlocked) throw new Error(regBlockedReason);
      return attendanceService.raiseRegularization({
        employeeId,
        attendanceDate: regDate,
        requestedIn: regIn || null,
        requestedOut: regOut || null,
        reason: "[" + regTypeLabel(regType) + "] " + regReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Regularization request submitted");
      setRegOpen(false);
      setRegIn("");
      setRegOut("");
      setRegReason("");
      qc.invalidateQueries({ queryKey: ["regularizations"] });
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Could not submit request",
      ),
  });

  const bulkMark = useMutation({
    mutationFn: () =>
      attendanceService.bulkMark(
        bulkDate,
        bulkStatus,
        bulkRemarks,
        bulkSelected,
      ),
    onSuccess: (count) => {
      toast.success(
        "Marked " + count + " employee(s) as " + bulkStatus + " on " + bulkDate,
      );
      setBulkSelected([]);
      setBulkRemarks("");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Bulk marking failed"),
  });

  const allEmployees = (employees.data ?? []) as ResourceRecord[];

  const rows = history.data ?? [];
  const todayRec = rows.find((r) => r.attendanceDate === today);
  const checkedInToday = !!todayRec?.checkInTime;
  const checkedOutToday = !!todayRec?.checkOutTime;

  // #1: an ABSENT day CAN be regularized (that's the point of regularization).
  // Only an approved/pending LEAVE day is blocked.
  const regDayOnLeave = ((empLeaves.data ?? []) as any[]).some((l) => {
    const s = String(l.status).toUpperCase();
    const active = s === "APPROVED" || s === "PENDING";
    return active && l.fromDate <= regDate && regDate <= l.toDate;
  });
  const regBlocked = regDayOnLeave;
  const regBlockedReason = regDayOnLeave
    ? "You were on leave that day \u2014 attendance can't be regularized for a leave date."
    : "";

  const mapsUrl = (lat: number, lng: number) =>
    "https://www.google.com/maps?q=" + lat + "," + lng;

  const historyColumns = [
    { title: "Date", dataIndex: "attendanceDate", key: "attendanceDate" },
    {
      title: "In Selfie",
      key: "checkInPhoto",
      render: (_: any, r: any) =>
        r.checkInPhotoId ? (
          <AuthedImage
            fileId={r.checkInPhotoId}
            alt="Check-in selfie"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
            fallback={<Text type="secondary">—</Text>}
          />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Check In",
      key: "checkInTime",
      render: (_: any, r: any) => fmt(r.checkInTime),
    },
    {
      title: "Check Out",
      key: "checkOutTime",
      render: (_: any, r: any) => fmt(r.checkOutTime),
    },
    {
      title: "Out Selfie",
      key: "checkOutPhoto",
      render: (_: any, r: any) =>
        r.checkOutPhotoId ? (
          <AuthedImage
            fileId={r.checkOutPhotoId}
            alt="Check-out selfie"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
            fallback={<Text type="secondary">—</Text>}
          />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Hours",
      key: "hours",
      render: (_: any, r: any) =>
        r.workingHours != null ? r.workingHours + "h" : "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag
          color={
            v === "PRESENT" ? "success" : v === "LEAVE" ? "blue" : "default"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Location",
      key: "location",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          {r.checkInLatitude != null && r.checkInLongitude != null ? (
            <a
              href={mapsUrl(r.checkInLatitude, r.checkInLongitude)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <EnvironmentOutlined /> In
            </a>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              In —
            </Text>
          )}
          {r.checkOutLatitude != null && r.checkOutLongitude != null ? (
            <a
              href={mapsUrl(r.checkOutLatitude, r.checkOutLongitude)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <EnvironmentOutlined /> Out
            </a>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Out —
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Note",
      key: "note",
      render: (_: any, r: any) =>
        r.isRegularized ? <Tag color="blue">Regularized</Tag> : "—",
    },
  ];

  const bulkColumns = [
    { title: "Code", dataIndex: "employeeCode", key: "employeeCode" },
    {
      title: "Name",
      key: "name",
      render: (_: any, e: any) => e.firstName + " " + e.lastName,
    },
    {
      title: "Department",
      dataIndex: "departmentName",
      key: "departmentName",
      render: (v: string) => v ?? "—",
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
              Attendance
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Check in, check out, and review attendance history.
            </Text>
          </div>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as "list" | "calendar")}
            options={[
              { label: "List", value: "list", icon: <UnorderedListOutlined /> },
              {
                label: "Calendar",
                value: "calendar",
                icon: <CalendarOutlined />,
              },
            ]}
          />
        </div>

        {viewMode === "calendar" && (
          <AttendanceCalendar employeeId={employeeId} />
        )}

        {/* Check-in / Check-out card */}
        <Card>
          <Space wrap align="end" size="middle">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 220,
                maxWidth: "100%",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: 500 }}>Employee</Text>
              {ownOnly ? (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                    minWidth: 220,
                  }}
                >
                  {me.data
                    ? me.data.employeeCode +
                      " — " +
                      me.data.firstName +
                      " " +
                      me.data.lastName
                    : "Loading…"}
                </div>
              ) : (
                <AntSelect
                  style={{ width: "100%", minWidth: 220, maxWidth: 320 }}
                  value={employeeId || undefined}
                  onChange={(v) => setEmployeeId(v)}
                  placeholder="— Select —"
                  options={pickerOptions.map((e: ResourceRecord) => ({
                    value: e.id,
                    label:
                      e.employeeCode + " — " + e.firstName + " " + e.lastName,
                  }))}
                />
              )}
            </div>
            <AntButton
              type="primary"
              icon={<LoginOutlined />}
              disabled={!employeeId || checkedInToday}
              onClick={() => setCheckInOpen(true)}
            >
              Check In
            </AntButton>
            <AntButton
              icon={<LogoutOutlined />}
              disabled={!employeeId || !checkedInToday || checkedOutToday}
              onClick={() => setCheckOutOpen(true)}
            >
              Check Out
            </AntButton>
            <AntButton
              icon={<CalendarOutlined />}
              disabled={!employeeId}
              onClick={() => setRegOpen(true)}
            >
              Regularize
            </AntButton>
          </Space>

          {employeeId && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                background: "var(--surface-2)",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <Text type="secondary">Time left today:</Text>
              <span style={{ fontSize: 24, fontWeight: 700 }}>
                {checkedInToday ? (
                  <RemainingTime
                    checkInTime={todayRec?.checkInTime}
                    checkOutTime={todayRec?.checkOutTime}
                  />
                ) : (
                  <Text type="secondary">
                    Not checked in — {STANDARD_WORKDAY_HOURS}h 0m 0s
                  </Text>
                )}
              </span>
              {checkedInToday && !checkedOutToday && (
                <Text style={{ color: "#059669", fontSize: 12 }}>
                  (running…)
                </Text>
              )}
              {checkedOutToday && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (final)
                </Text>
              )}
              {checkedInToday && (
                <span style={{ marginLeft: "auto" }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Worked:{" "}
                    <LiveDuration
                      checkInTime={todayRec?.checkInTime}
                      checkOutTime={todayRec?.checkOutTime}
                    />
                  </Text>
                </span>
              )}
            </div>
          )}
        </Card>

        {/* Bulk-mark card (super admin only) */}
        {isSuperAdmin && (
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: "#00a8f0" }} />
                Mark Attendance for All
                <Tag color="blue">Super Admin</Tag>
              </Space>
            }
          >
            <Text type="secondary">
              Mark the same status for many employees at once. Already-marked
              employees for that date are skipped.
            </Text>
            <Row gutter={12} style={{ marginTop: 16, marginBottom: 16 }}>
              <Col>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>Date</Text>
                  <DatePicker
                    format="DD/MM/YYYY"
                    value={dayjs(bulkDate)}
                    onChange={(d) =>
                      setBulkDate(d ? d.format("YYYY-MM-DD") : today)
                    }
                  />
                </div>
              </Col>
              <Col>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>Status</Text>
                  <AntSelect
                    style={{ width: 160 }}
                    value={bulkStatus}
                    onChange={setBulkStatus}
                    options={BULK_STATUSES.map((s) => ({
                      value: s,
                      label: s.replace("_", " "),
                    }))}
                  />
                </div>
              </Col>
              <Col flex="auto">
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>
                    Remarks (optional)
                  </Text>
                  <AntInput
                    placeholder="e.g. Client site visit"
                    value={bulkRemarks}
                    onChange={(e) => setBulkRemarks(e.target.value)}
                  />
                </div>
              </Col>
            </Row>

            <Table
              size="small"
              rowKey={(e: any) => e.id}
              columns={bulkColumns}
              dataSource={allEmployees}
              pagination={false}
              scroll={{ x: true, y: 240 }}
              rowSelection={{
                selectedRowKeys: bulkSelected,
                onChange: (keys) => setBulkSelected(keys as string[]),
              }}
              style={{ marginBottom: 12 }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text type="secondary">{bulkSelected.length} selected</Text>
              <AntButton
                type="primary"
                icon={<CheckOutlined />}
                disabled={bulkSelected.length === 0}
                loading={bulkMark.isPending}
                onClick={() => bulkMark.mutate()}
              >
                Mark {bulkSelected.length || ""} as{" "}
                {bulkStatus.replace("_", " ")}
              </AntButton>
            </div>
          </Card>
        )}

        {/* Last 5 days summary */}
        {viewMode === "list" && employeeId && rows.length > 0 && (
          <div>
            <Title level={5}>Last 5 Days</Title>
            <Row gutter={[12, 12]}>
              {[...rows]
                .sort((a, b) => (a.attendanceDate < b.attendanceDate ? 1 : -1))
                .slice(0, 5)
                .map((r) => {
                  const isToday = r.attendanceDate === today;
                  const running = isToday && r.checkInTime && !r.checkOutTime;
                  return (
                    <Col xs={12} sm={8} lg={24 / 5} key={r.id}>
                      <Card
                        size="small"
                        className="card-hover"
                        style={{ textAlign: "center" }}
                      >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(r.attendanceDate).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            },
                          )}
                        </Text>
                        <div
                          style={{
                            fontSize: 17,
                            fontWeight: 600,
                            margin: "4px 0",
                          }}
                        >
                          {running ? (
                            <LiveDuration
                              checkInTime={r.checkInTime}
                              checkOutTime={r.checkOutTime}
                            />
                          ) : (
                            durationHMS(r.checkInTime, r.checkOutTime)
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {fmt(r.checkInTime)} → {fmt(r.checkOutTime)}
                        </Text>
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                            justifyContent: "center",
                          }}
                        >
                          <Tag
                            color={
                              r.status === "PRESENT"
                                ? "success"
                                : r.status === "LEAVE"
                                  ? "blue"
                                  : "default"
                            }
                            style={{ fontSize: 10 }}
                          >
                            {r.status}
                          </Tag>
                          {r.isRegularized && (
                            <Tag color="blue" style={{ fontSize: 10 }}>
                              Regularized
                            </Tag>
                          )}
                        </div>
                      </Card>
                    </Col>
                  );
                })}
            </Row>
          </div>
        )}

        {/* Full attendance history table */}
        {viewMode === "list" && (
          <div>
            <Title level={5}>Attendance History</Title>
            <Card styles={{ body: { padding: 0 } }}>
              {!employeeId ? (
                <Text
                  type="secondary"
                  style={{ padding: 20, display: "block" }}
                >
                  Select an employee to see history.
                </Text>
              ) : history.isLoading ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <Spin />
                </div>
              ) : rows.length === 0 ? (
                <Text
                  type="secondary"
                  style={{ padding: 20, display: "block" }}
                >
                  No attendance records.
                </Text>
              ) : (
                <Table
                  rowKey={(r: any) => r.id}
                  columns={historyColumns}
                  dataSource={rows}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                />
              )}
            </Card>
          </div>
        )}

        {/* #4: My Regularization Requests — the employee sees their own
            requests and whether each was approved / rejected. */}
        {viewMode === "list" && employeeId && (
          <div>
            <Title level={5}>My Regularization Requests</Title>
            <Card styles={{ body: { padding: 0 } }}>
              {myReg.isLoading ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <Spin />
                </div>
              ) : (myReg.data ?? []).length === 0 ? (
                <Text
                  type="secondary"
                  style={{ padding: 20, display: "block" }}
                >
                  No regularization requests yet.
                </Text>
              ) : (
                <Table
                  rowKey={(r: any) => r.id}
                  dataSource={myReg.data ?? []}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: true }}
                  columns={[
                    {
                      title: "Date",
                      dataIndex: "attendanceDate",
                      key: "attendanceDate",
                    },
                    {
                      title: "Requested In",
                      key: "reqIn",
                      render: (_: any, r: any) => r.requestedIn ?? "\u2014",
                    },
                    {
                      title: "Requested Out",
                      key: "reqOut",
                      render: (_: any, r: any) => r.requestedOut ?? "\u2014",
                    },
                    {
                      title: "Reason",
                      dataIndex: "reason",
                      key: "reason",
                      ellipsis: true,
                    },
                    {
                      title: "Status",
                      key: "status",
                      render: (_: any, r: any) => {
                        const s = String(r.status).toUpperCase();
                        const color =
                          s === "APPROVED"
                            ? "success"
                            : s === "REJECTED"
                              ? "error"
                              : s === "CANCELLED"
                                ? "default"
                                : "warning";
                        return <Tag color={color}>{r.status}</Tag>;
                      },
                    },
                    {
                      title: "Reviewer Note",
                      key: "reviewerRemarks",
                      render: (_: any, r: any) => r.reviewerRemarks ?? "\u2014",
                    },
                  ]}
                />
              )}
            </Card>
          </div>
        )}

        {/* Check-in modal (location + selfie required) */}
        <CheckInModal
          open={checkInOpen}
          employeeId={employeeId}
          onClose={() => setCheckInOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["attendance"] });
            qc.invalidateQueries({ queryKey: ["attendance", employeeId] });
          }}
        />

        {/* Check-out modal (location + selfie required) */}
        <CheckOutModal
          open={checkOutOpen}
          employeeId={employeeId}
          onClose={() => setCheckOutOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["attendance"] });
            qc.invalidateQueries({ queryKey: ["attendance", employeeId] });
          }}
        />

        {/* Raise regularization modal */}
        <AntModal
          open={regOpen}
          title="Request Attendance Regularization"
          onCancel={() => setRegOpen(false)}
          footer={[
            <AntButton key="cancel" onClick={() => setRegOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              disabled={!regReason.trim() || regBlocked}
              loading={raiseReg.isPending}
              onClick={() => raiseReg.mutate()}
            >
              Submit Request
            </AntButton>,
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "#eff6ff",
                color: "#1d4ed8",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              Forgot to check in or out? Request a correction. Your manager / HR
              will review and if approved, your attendance record will be
              automatically updated.
            </div>
            {regBlocked && (
              <Alert type="warning" showIcon message={regBlockedReason} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>Date</Text>
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={dayjs(regDate)}
                maxDate={dayjs(today)}
                onChange={(d) => setRegDate(d ? d.format("YYYY-MM-DD") : today)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>Type</Text>
              <AntSelect
                value={regType}
                onChange={setRegType}
                options={REG_TYPES}
              />
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>
                    Actual Check-in Time
                  </Text>
                  <TimePicker
                    style={{ width: "100%" }}
                    format="HH:mm"
                    value={regIn ? dayjs(regIn, "HH:mm") : null}
                    onChange={(t) => setRegIn(t ? t.format("HH:mm") : "")}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>
                    Actual Check-out Time
                  </Text>
                  <TimePicker
                    style={{ width: "100%" }}
                    format="HH:mm"
                    value={regOut ? dayjs(regOut, "HH:mm") : null}
                    onChange={(t) => setRegOut(t ? t.format("HH:mm") : "")}
                  />
                </div>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Leave blank if not applicable (e.g. only missed check-in — just
              enter the check-in time).
            </Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                Reason <span style={{ color: "#dc2626" }}>*</span>
              </Text>
              <TextArea
                rows={3}
                placeholder="e.g. Was at client site, forgot to check in on the app"
                value={regReason}
                onChange={(e) => setRegReason(e.target.value)}
              />
            </div>
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}
