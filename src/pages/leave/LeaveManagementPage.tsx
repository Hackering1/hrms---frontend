import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
  Table,
  Tag,
  Tabs,
  Card,
  Row,
  Col,
  Space,
  Spin,
} from "antd";
import {
  SendOutlined,
  ClearOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import FileUpload from "../../components/ui/FileUpload";
import { DonutChart, GroupedBars, pickColor } from "../../components/ui/Charts";
import { useRole } from "../../hooks/useRole";
import { leaveService } from "../../services/leaveService";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import { resourceService } from "../../services/resourceService";
import { fileService } from "../../services/fileService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;
const { TextArea } = AntInput;
const YEAR = new Date().getFullYear();

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const statusColor: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
};

function StatusTag({ status }: { status: string }) {
  return <Tag color={statusColor[status] ?? "default"}>{status}</Tag>;
}

// Helper: "CODE — First Last (email)" without template literals (paste-safe).
function personLabel(e: any) {
  const base = e.employeeCode + " \u2014 " + e.firstName + " " + e.lastName;
  return e.email ? base + " (" + e.email + ")" : base;
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

export default function LeaveManagementPage() {
  const { isSuperAdmin, isManager, isEmployee, isHr } = useRole();
  const managerScoped = isManager && !isSuperAdmin && !isHr;

  const items = useMemo(() => {
    const tabs: { key: string; label: string; children: React.ReactNode }[] =
      [];
    if (isManager) {
      tabs.push(
        {
          key: "apply",
          label: "Apply",
          children: <ApplyTab />,
        },
        {
          key: "reports",
          label: "Reports",
          children: (
            <ReportsTab selfOnly={false} managerScoped={managerScoped} />
          ),
        },
        {
          key: "approvals",
          label: "Approvals",
          children: <ApprovalsTab managerScoped={managerScoped} />,
        },
      );
    } else if (isHr || isSuperAdmin) {
      tabs.push(
        {
          key: "approvals",
          label: "Approvals",
          children: <ApprovalsTab managerScoped={false} />,
        },
        {
          key: "reports",
          label: "Reports",
          children: <ReportsTab selfOnly={false} managerScoped={false} />,
        },
      );
    } else {
      tabs.push(
        { key: "apply", label: "Apply", children: <ApplyTab /> },
        {
          key: "reports",
          label: "Reports",
          children: <ReportsTab selfOnly={isEmployee} managerScoped={false} />,
        },
      );
    }
    return tabs;
  }, [isManager, isHr, isSuperAdmin, isEmployee, managerScoped]);

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Space>
          <ClearOutlined style={{ color: "#0d9488", fontSize: 20 }} />
          <Title level={2} style={{ margin: 0 }}>
            Leave Management
          </Title>
        </Space>
        <Tabs items={items} />
      </div>
    </ConfigProvider>
  );
}

/* ----------------------------- Apply (employee / manager) ----------------------------- */
function ApplyTab() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });
  const types = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: leaveService.listTypes,
  });
  const empId = me.data?.id as string | undefined;

  const balances = useQuery({
    queryKey: ["balances", empId, YEAR],
    queryFn: () => leaveService.balances(empId!, YEAR),
    enabled: !!empId,
  });
  const myRequests = useQuery({
    queryKey: ["myLeaves", empId],
    queryFn: () => leaveService.byEmployee(empId!),
    enabled: !!empId,
  });

  const [leaveTypeId, setLeaveTypeId] = useState<number | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  const selectedType = (types.data ?? []).find((t) => t.id === leaveTypeId);
  const needsProof = selectedType?.requiresDocument;

  const days = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const d1 = new Date(fromDate);
    const d2 = new Date(toDate);
    const diff = Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }, [fromDate, toDate]);

  const apply = useMutation({
    mutationFn: () =>
      leaveService.apply({
        employeeId: empId!,
        leaveTypeId: leaveTypeId as number,
        fromDate,
        toDate,
        numberOfDays: days,
        dayType: "FULL_DAY",
        reason,
        documentUrl: documentUrl || undefined,
      }),
    onSuccess: () => {
      toast.success("Leave applied");
      setLeaveTypeId("");
      setFromDate("");
      setToDate("");
      setReason("");
      setDocumentUrl("");
      qc.invalidateQueries({ queryKey: ["myLeaves", empId] });
      qc.invalidateQueries({ queryKey: ["balances", empId, YEAR] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Apply failed"),
  });

  if (me.isLoading) return <Spin />;
  if (me.isError)
    return (
      <Card>
        <Text type="secondary">Your profile isn't set up yet. Contact HR.</Text>
      </Card>
    );

  const typeName = (id: number) =>
    (types.data ?? []).find((t) => t.id === id)?.name ?? id;

  const reqColumns = [
    {
      title: "Type",
      key: "type",
      render: (_: any, r: any) => typeName(r.leaveTypeId),
    },
    { title: "From", dataIndex: "fromDate", key: "fromDate" },
    { title: "To", dataIndex: "toDate", key: "toDate" },
    { title: "Days", dataIndex: "numberOfDays", key: "numberOfDays" },
    {
      title: "Status",
      key: "status",
      render: (_: any, r: any) => <StatusTag status={r.status} />,
    },
    {
      title: "Proof",
      key: "proof",
      render: (_: any, r: any) =>
        r.documentUrl ? (
          <a
            href={fileService.absoluteUrl(r.documentUrl)}
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        ) : (
          "\u2014"
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Title level={5}>My Leave Balances ({YEAR})</Title>
        {balances.isLoading ? (
          <Spin />
        ) : (balances.data ?? []).length === 0 ? (
          <Card>
            <Text type="secondary">No balances allocated yet.</Text>
          </Card>
        ) : (
          <Row gutter={[12, 12]}>
            {(balances.data ?? []).map((b) => (
              <Col xs={12} md={6} key={b.id}>
                <Card style={{ textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {typeName(b.leaveTypeId)}
                  </Text>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {b.balanceDays}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {b.usedDays} used / {b.allocatedDays} allocated
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Card title="Apply for Leave">
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Field label="Leave Type">
              <AntSelect
                value={leaveTypeId || undefined}
                onChange={(v) => setLeaveTypeId(v ?? "")}
                placeholder={"\u2014 Select \u2014"}
                options={(types.data ?? []).map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Days">
              <AntInput
                value={days}
                readOnly
                style={{ background: "#f8fafc" }}
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="From">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={fromDate ? dayjs(fromDate) : null}
                onChange={(d) => setFromDate(d ? d.format("YYYY-MM-DD") : "")}
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="To">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={toDate ? dayjs(toDate) : null}
                onChange={(d) => setToDate(d ? d.format("YYYY-MM-DD") : "")}
              />
            </Field>
          </Col>
          <Col span={24}>
            <Field label="Reason">
              <TextArea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </Col>
          {needsProof && (
            <Col span={24}>
              <FileUpload
                label="Proof document (required for this leave type)"
                value={documentUrl}
                onUploaded={(url) => setDocumentUrl(url)}
              />
            </Col>
          )}
        </Row>
        <div
          style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}
        >
          <AntButton
            type="primary"
            icon={<SendOutlined />}
            loading={apply.isPending}
            disabled={
              !leaveTypeId ||
              !fromDate ||
              !toDate ||
              days <= 0 ||
              !reason ||
              (needsProof && !documentUrl)
            }
            onClick={() => apply.mutate()}
          >
            Apply
          </AntButton>
        </div>
      </Card>

      <div>
        <Title level={5}>My Leave Requests</Title>
        <Table
          loading={myRequests.isLoading}
          rowKey={(r: any) => r.id}
          columns={reqColumns}
          dataSource={myRequests.data ?? []}
          locale={{ emptyText: "No requests yet." }}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Reports ----------------------------- */
function ReportsTab({
  selfOnly,
  managerScoped = false,
}: {
  selfOnly: boolean;
  managerScoped?: boolean;
}) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: selfOnly || managerScoped,
  });
  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
    enabled: !selfOnly && !managerScoped,
  });
  const types = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: leaveService.listTypes,
  });

  const [picked, setPicked] = useState("");
  const empId = selfOnly
    ? (me.data?.id as string | undefined)
    : picked || undefined;

  const pickerPeople = (
    managerScoped ? (team.data ?? []) : (employees.data ?? [])
  ) as ResourceRecord[];

  const balances = useQuery({
    queryKey: ["balances", empId, YEAR],
    queryFn: () => leaveService.balances(empId!, YEAR),
    enabled: !!empId,
  });
  const requests = useQuery({
    queryKey: ["empLeaves", empId],
    queryFn: () => leaveService.byEmployee(empId!),
    enabled: !!empId,
  });

  const typeName = (id: number) =>
    (types.data ?? []).find((t) => t.id === id)?.name ?? id;

  const balanceColumns = [
    {
      title: "Type",
      key: "type",
      render: (_: any, b: any) => typeName(b.leaveTypeId),
    },
    { title: "Allocated", dataIndex: "allocatedDays", key: "allocatedDays" },
    { title: "Used", dataIndex: "usedDays", key: "usedDays" },
    { title: "Pending", dataIndex: "pendingDays", key: "pendingDays" },
    { title: "Remaining", dataIndex: "balanceDays", key: "balanceDays" },
  ];

  const requestColumns = [
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
      key: "status",
      render: (_: any, r: any) => <StatusTag status={r.status} />,
    },
    {
      title: "Proof",
      key: "proof",
      render: (_: any, r: any) =>
        r.documentUrl ? (
          <a
            href={fileService.absoluteUrl(r.documentUrl)}
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        ) : (
          "\u2014"
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!selfOnly && (
        <Card>
          <Field
            label={
              managerScoped ? "Select team member" : "Select employee / manager"
            }
          >
            <AntSelect
              style={{ width: "100%", maxWidth: 320 }}
              value={picked || undefined}
              onChange={(v) => setPicked(v ?? "")}
              placeholder={"\u2014 Select \u2014"}
              options={pickerPeople.map((e) => ({
                value: e.id,
                label: personLabel(e),
              }))}
            />
          </Field>
        </Card>
      )}

      {!empId ? (
        <Card>
          <Text type="secondary">
            {selfOnly
              ? "Loading your report\u2026"
              : "Select someone to view their leave report."}
          </Text>
        </Card>
      ) : (
        <>
          {(balances.data ?? []).length > 0 && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Remaining Leaves by Type">
                  <DonutChart
                    data={(balances.data ?? []).map((b, i) => ({
                      label: String(typeName(b.leaveTypeId)),
                      value: b.balanceDays,
                      color: pickColor(i),
                    }))}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Allocated vs Used">
                  <GroupedBars
                    rows={(balances.data ?? []).map((b) => ({
                      label: String(typeName(b.leaveTypeId)),
                      allocated: b.allocatedDays,
                      used: b.usedDays,
                      remaining: b.balanceDays,
                    }))}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div>
            <Title level={5}>Leave Balances ({YEAR})</Title>
            <Table
              loading={balances.isLoading}
              rowKey={(b: any) => b.id}
              columns={balanceColumns}
              dataSource={balances.data ?? []}
              locale={{ emptyText: "No balances." }}
              pagination={false}
            />
          </div>

          <div>
            <Title level={5}>Leave Requests & Proofs</Title>
            <Table
              loading={requests.isLoading}
              rowKey={(r: any) => r.id}
              columns={requestColumns}
              dataSource={requests.data ?? []}
              locale={{ emptyText: "No requests." }}
              pagination={{ pageSize: 10 }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Approvals (manager / super admin) ----------------------------- */
function ApprovalsTab({ managerScoped = false }: { managerScoped?: boolean }) {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ["pendingLeaves"],
    queryFn: leaveService.pending,
  });
  const types = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: leaveService.listTypes,
  });
  const employees = useQuery({
    queryKey: ["employees", "includeDeleted"],
    // includeDeleted=true so a pending/decided leave tied to a since-removed
    // employee still resolves to a name + email instead of the raw UUID.
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: managerScoped,
  });
  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "APPROVED" | "REJECTED";
    }) => leaveService.decide(id, { approvedBy: null, status }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["pendingLeaves"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed"),
  });

  const typeName = (id: number) =>
    (types.data ?? []).find((t) => t.id === id)?.name ?? id;
  const empName = (id: string) => {
    const e = ((employees.data ?? []) as ResourceRecord[]).find(
      (x) => x.id === id,
    );
    return e ? personLabel(e) : id;
  };

  const allPending = pending.data ?? [];
  const rows = managerScoped
    ? allPending.filter((r) => {
        const teamIds = new Set((team.data ?? []).map((m) => String(m.id)));
        return teamIds.has(String(r.employeeId));
      })
    : allPending;

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
      title: "Proof",
      key: "proof",
      render: (_: any, r: any) =>
        r.documentUrl ? (
          <a
            href={fileService.absoluteUrl(r.documentUrl)}
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        ) : (
          "\u2014"
        ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, r: any) => (
        <Space>
          <AntButton
            size="small"
            icon={<CheckOutlined />}
            style={{ color: "#16a34a" }}
            onClick={() => decide.mutate({ id: r.id, status: "APPROVED" })}
          />
          <AntButton
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => decide.mutate({ id: r.id, status: "REJECTED" })}
          />
        </Space>
      ),
    },
  ];

  return (
    <Table
      loading={pending.isLoading}
      rowKey={(r: any) => r.id}
      columns={columns}
      dataSource={rows}
      locale={{ emptyText: "No pending leave requests." }}
      pagination={{ pageSize: 10 }}
    />
  );
}
