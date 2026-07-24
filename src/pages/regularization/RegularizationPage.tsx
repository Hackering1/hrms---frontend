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
  Badge,
  Modal as AntModal,
  Popconfirm,
} from "antd";
import {
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRole } from "../../hooks/useRole";
import { attendanceService } from "../../services/attendanceService";
import { leaveService } from "../../services/leaveService";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;
const { TextArea } = AntInput;

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
  CANCELLED: "default",
};

function StatusTag({ status }: { status: string }) {
  return <Tag color={statusColor[status] ?? "default"}>{status}</Tag>;
}

/**
 * Dedicated Regularization page (Super Admin / HR / Managers).
 *  - Attendance tab: review & approve/reject attendance regularization requests.
 *  - Leave tab: HR back-date / edit / cancel leave records.
 * Managers are scoped to their own team; HR/Super Admin see everyone.
 */
export default function RegularizationPage() {
  const { isSuperAdmin, isManager, isHr } = useRole();
  const managerScoped = isManager && !isSuperAdmin && !isHr;
  const isAdmin = isSuperAdmin || isHr;

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Space>
          <ClockCircleOutlined style={{ color: "#0d9488", fontSize: 20 }} />
          <Title level={2} style={{ margin: 0 }}>
            Regularization
          </Title>
        </Space>

        <Tabs
          items={[
            {
              key: "attendance",
              label: "Attendance Regularization",
              children: <AttendanceRegTab managerScoped={managerScoped} isAdmin={isAdmin} />,
            },
            {
              key: "leave",
              label: "Leave Regularization",
              children: <LeaveRegTab managerScoped={managerScoped} isAdmin={isAdmin} />,
            },
          ]}
        />
      </div>
    </ConfigProvider>
  );
}

/* ----------------------- Attendance Regularization ------------------------ */

function AttendanceRegTab({
  managerScoped,
  isAdmin,
}: {
  managerScoped: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: managerScoped,
  });
  const regs = useQuery({
    queryKey: ["regularizations"],
    queryFn: attendanceService.listRegularizations,
  });
  const employees = useQuery({
    queryKey: ["employees", "includeDeleted"],
    // includeDeleted=true so a regularization tied to a since-removed employee
    // still resolves to a name + email instead of showing the raw UUID.
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });
  const teamIds = new Set((team.data ?? []).map((e) => e.id));

  const empName = (id: string) => {
    const e = (employees.data ?? []).find((x: any) => x.id === id);
    if (!e) return id;
    const name = `${e.employeeCode} — ${e.firstName} ${e.lastName}`;
    return e.email ? `${name} (${e.email})` : name;
  };

  const rows = useMemo(
    () =>
      ((regs.data ?? []) as any[]).filter((r) =>
        managerScoped ? teamIds.has(r.employeeId) : true,
      ),
    [regs.data, managerScoped, team.data],
  );

  const approve = useMutation({
    mutationFn: (id: number) =>
      attendanceService.decideRegularization(id, "APPROVED"),
    onSuccess: () => {
      toast.success("Approved — attendance corrected");
      qc.invalidateQueries({ queryKey: ["regularizations"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not approve"),
  });

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");
  const reject = useMutation({
    mutationFn: (id: number) =>
      attendanceService.decideRegularization(id, "REJECTED", rejectRemark),
    onSuccess: () => {
      toast.success("Request rejected");
      setRejectId(null);
      setRejectRemark("");
      qc.invalidateQueries({ queryKey: ["regularizations"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not reject"),
  });

  const deleteReg = useMutation({
    mutationFn: (id: number) => attendanceService.deleteRegularizationPermanent(id),
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["regularizations"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not delete"),
  });

  const pending = rows.filter((r) => r.status === "PENDING").length;

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (_: any, r: any) => empName(r.employeeId),
    },
    { title: "Date", dataIndex: "attendanceDate", key: "attendanceDate" },
    {
      title: "Requested In",
      key: "reqIn",
      render: (_: any, r: any) => r.requestedIn ?? "—",
    },
    {
      title: "Requested Out",
      key: "reqOut",
      render: (_: any, r: any) => r.requestedOut ?? "—",
    },
    { title: "Reason", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "Status",
      key: "status",
      render: (_: any, r: any) => <StatusTag status={r.status} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, r: any) => (
        <Space>
          {r.status === "PENDING" ? (
            <>
              <AntButton
                size="small"
                icon={<CheckOutlined />}
                style={{ color: "#16a34a" }}
                loading={approve.isPending}
                onClick={() => approve.mutate(r.id)}
              />
              <AntButton
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => setRejectId(r.id)}
              />
            </>
          ) : null}
          {isAdmin && (
            <Popconfirm
              title="Permanently delete this request?"
              description="This removes the row entirely — it can't be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteReg.mutate(r.id)}
            >
              <AntButton
                size="small"
                danger
                type="text"
                icon={<DeleteOutlined />}
                loading={deleteReg.isPending}
              />
            </Popconfirm>
          )}
          {r.status !== "PENDING" && !isAdmin && "—"}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          Attendance Regularization Requests
        </Title>
        {pending > 0 && <Badge count={`${pending} pending`} color="#d97706" />}
      </div>

      <Table
        loading={regs.isLoading}
        rowKey={(r: any) => r.id}
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: "No regularization requests." }}
        pagination={{ pageSize: 10 }}
      />

      <AntModal
        open={rejectId !== null}
        title="Reject regularization request"
        onCancel={() => {
          setRejectId(null);
          setRejectRemark("");
        }}
        footer={[
          <AntButton
            key="cancel"
            onClick={() => {
              setRejectId(null);
              setRejectRemark("");
            }}
          >
            Cancel
          </AntButton>,
          <AntButton
            key="reject"
            danger
            type="primary"
            loading={reject.isPending}
            disabled={!rejectRemark.trim()}
            onClick={() => rejectId !== null && reject.mutate(rejectId)}
          >
            Reject Request
          </AntButton>,
        ]}
      >
        <TextArea
          rows={3}
          placeholder="Reason for rejection (required)"
          value={rejectRemark}
          onChange={(e) => setRejectRemark(e.target.value)}
        />
      </AntModal>
    </div>
  );
}

/* -------------------------- Leave Regularization -------------------------- */

function LeaveRegTab({
  managerScoped,
  isAdmin,
}: {
  managerScoped: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: managerScoped,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  // Separate, includeDeleted=true fetch just for resolving employee names/emails
  // on existing leave rows — so a since-removed employee still shows their name
  // instead of a raw UUID. The plain `employees` list above (active only) is kept
  // for the "record a past leave" dropdown, since you can't pick a deleted employee.
  const employeesAll = useQuery({
    queryKey: ["employees", "includeDeleted"],
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  const types = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: leaveService.listTypes,
  });
  const allLeave = useQuery({
    queryKey: ["leaveAll"],
    queryFn: leaveService.listAll,
  });
  const team = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });
  const teamIds = new Set((team.data ?? []).map((e) => e.id));

  const empList = ((employees.data ?? []) as ResourceRecord[]).filter((e) =>
    managerScoped ? teamIds.has(e.id as string) : true,
  );
  const empName = (id: string) => {
    const e = (employeesAll.data ?? []).find((x: any) => x.id === id);
    if (!e) return id;
    const name = `${e.employeeCode} — ${e.firstName} ${e.lastName}`;
    return e.email ? `${name} (${e.email})` : name;
  };
  const typeName = (id: number) =>
    (types.data ?? []).find((t) => t.id === id)?.name ?? `Type ${id}`;

  // Back-date
  const [bdEmp, setBdEmp] = useState("");
  const [bdType, setBdType] = useState<number | "">("");
  const [bdFrom, setBdFrom] = useState("");
  const [bdTo, setBdTo] = useState("");
  const [bdReason, setBdReason] = useState("");

  const backdate = useMutation({
    mutationFn: () => {
      if (!bdEmp || !bdType || !bdFrom || !bdTo)
        throw new Error("Pick an employee, type, and dates.");
      if (bdTo < bdFrom)
        throw new Error("End date can't be before start date.");
      return leaveService.apply({
        employeeId: bdEmp,
        leaveTypeId: Number(bdType),
        fromDate: bdFrom,
        toDate: bdTo,
        numberOfDays: 0,
        dayType: "FULL",
        reason: bdReason.trim() || "Regularized by HR",
      });
    },
    onSuccess: () => {
      toast.success("Leave recorded");
      setBdEmp("");
      setBdType("");
      setBdFrom("");
      setBdTo("");
      setBdReason("");
      qc.invalidateQueries({ queryKey: ["leaveAll"] });
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Could not record leave",
      ),
  });

  // Edit / cancel
  const [editing, setEditing] = useState<null | {
    id: number;
    fromDate: string;
    toDate: string;
    leaveTypeId: number;
  }>(null);

  const saveEdit = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Nothing to save");
      if (editing.toDate < editing.fromDate)
        throw new Error("End date can't be before start date.");
      return leaveService.regularize(editing.id, {
        fromDate: editing.fromDate,
        toDate: editing.toDate,
        leaveTypeId: editing.leaveTypeId,
      });
    },
    onSuccess: () => {
      toast.success("Leave updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["leaveAll"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? e?.message ?? "Update failed"),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => leaveService.cancel(id),
    onSuccess: () => {
      toast.success("Leave cancelled — days returned to balance");
      qc.invalidateQueries({ queryKey: ["leaveAll"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Cancel failed"),
  });

  const deleteLeave = useMutation({
    mutationFn: (id: number) => leaveService.deletePermanent(id),
    onSuccess: () => {
      toast.success("Leave permanently deleted");
      qc.invalidateQueries({ queryKey: ["leaveAll"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not delete"),
  });

  const rows = ((allLeave.data ?? []) as any[]).filter((l) =>
    managerScoped ? teamIds.has(l.employeeId) : true,
  );

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (_: any, l: any) => empName(l.employeeId),
    },
    {
      title: "Type",
      key: "type",
      render: (_: any, l: any) => typeName(l.leaveTypeId),
    },
    { title: "From", dataIndex: "fromDate", key: "fromDate" },
    { title: "To", dataIndex: "toDate", key: "toDate" },
    { title: "Days", dataIndex: "numberOfDays", key: "numberOfDays" },
    {
      title: "Status",
      key: "status",
      render: (_: any, l: any) => <StatusTag status={l.status} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, l: any) => (
        <Space>
          {l.status !== "CANCELLED" && (
            <>
              <AntButton
                size="small"
                onClick={() =>
                  setEditing({
                    id: l.id,
                    fromDate: l.fromDate,
                    toDate: l.toDate,
                    leaveTypeId: l.leaveTypeId,
                  })
                }
              >
                Edit
              </AntButton>
              <Popconfirm
                title="Cancel this leave?"
                description="Days return to balance."
                okText="Cancel leave"
                okButtonProps={{ danger: true }}
                onConfirm={() => cancel.mutate(l.id)}
              >
                <AntButton size="small" danger>
                  Cancel
                </AntButton>
              </Popconfirm>
            </>
          )}
          {isAdmin && (
            <Popconfirm
              title="Permanently delete this leave?"
              description="This removes the row entirely — it can't be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteLeave.mutate(l.id)}
            >
              <AntButton
                size="small"
                danger
                type="text"
                icon={<DeleteOutlined />}
                loading={deleteLeave.isPending}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="Record a past leave (back-date)">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} lg={5}>
            <AntSelect
              style={{ width: "100%" }}
              value={bdEmp || undefined}
              onChange={(v) => setBdEmp(v)}
              placeholder="— Employee —"
              options={empList.map((e) => ({
                value: e.id,
                label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <AntSelect
              style={{ width: "100%" }}
              value={bdType || undefined}
              onChange={(v) => setBdType(v)}
              placeholder="— Leave type —"
              options={(types.data ?? []).map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Col>
          <Col xs={12} lg={4}>
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              value={bdFrom ? dayjs(bdFrom) : null}
              onChange={(d) => setBdFrom(d ? d.format("YYYY-MM-DD") : "")}
            />
          </Col>
          <Col xs={12} lg={4}>
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              value={bdTo ? dayjs(bdTo) : null}
              onChange={(d) => setBdTo(d ? d.format("YYYY-MM-DD") : "")}
            />
          </Col>
          <Col xs={24} lg={6}>
            <AntButton
              type="primary"
              block
              loading={backdate.isPending}
              onClick={() => backdate.mutate()}
            >
              Record leave
            </AntButton>
          </Col>
        </Row>
        <AntInput
          style={{ marginTop: 12 }}
          placeholder="Reason (optional)"
          value={bdReason}
          onChange={(e) => setBdReason(e.target.value)}
        />
      </Card>

      <div>
        <Title level={5}>Existing leaves — edit or cancel</Title>
        <Table
          loading={allLeave.isLoading}
          rowKey={(l: any) => l.id}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: "No leave records." }}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <AntModal
        open={!!editing}
        title="Edit leave"
        onCancel={() => setEditing(null)}
        footer={[
          <AntButton key="cancel" onClick={() => setEditing(null)}>
            Cancel
          </AntButton>,
          <AntButton
            key="save"
            type="primary"
            loading={saveEdit.isPending}
            onClick={() => saveEdit.mutate()}
          >
            Save changes
          </AntButton>,
        ]}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AntSelect
              value={editing.leaveTypeId}
              onChange={(v) => setEditing({ ...editing, leaveTypeId: v })}
              options={(types.data ?? []).map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
            <Row gutter={12}>
              <Col span={12}>
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: "100%" }}
                  value={dayjs(editing.fromDate)}
                  onChange={(d) =>
                    setEditing({
                      ...editing,
                      fromDate: d ? d.format("YYYY-MM-DD") : editing.fromDate,
                    })
                  }
                />
              </Col>
              <Col span={12}>
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: "100%" }}
                  value={dayjs(editing.toDate)}
                  onChange={(d) =>
                    setEditing({
                      ...editing,
                      toDate: d ? d.format("YYYY-MM-DD") : editing.toDate,
                    })
                  }
                />
              </Col>
            </Row>
          </div>
        )}
      </AntModal>
    </div>
  );
}
