import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  timesheetService,
  type ProjectBody,
  type Timesheet,
  type TimesheetEntry,
  type TimesheetProject,
} from "../../services/timesheetService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const statusColor: Record<string, string> = {
  DRAFT: "default",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "error",
};

const FMT = "YYYY-MM-DD";
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday of the week containing d (ISO week). */
function mondayOf(d: dayjs.Dayjs): dayjs.Dayjs {
  return d.startOf("day").subtract((d.day() + 6) % 7, "day");
}

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message ?? fallback;

interface Row {
  key: string;
  projectId?: number;
  note: string;
  hours: (number | null)[]; // Mon..Sun
}

let rowSeq = 0;
const newRow = (): Row => ({
  key: `r${++rowSeq}`,
  note: "",
  hours: Array(7).fill(null),
});

/** Group the server's flat entries into editable rows (one per project + note). */
function toRows(ts: Timesheet | undefined, weekStart: dayjs.Dayjs): Row[] {
  if (!ts || ts.entries.length === 0) return [newRow()];
  const byKey = new Map<string, Row>();
  for (const e of ts.entries) {
    const k = `${e.projectId}|${e.description ?? ""}`;
    let row = byKey.get(k);
    if (!row) {
      row = {
        key: `r${++rowSeq}`,
        projectId: e.projectId,
        note: e.description ?? "",
        hours: Array(7).fill(null),
      };
      byKey.set(k, row);
    }
    const idx = dayjs(e.workDate).diff(weekStart, "day");
    if (idx >= 0 && idx < 7) row.hours[idx] = (row.hours[idx] ?? 0) + e.hours;
  }
  return [...byKey.values()];
}

function toEntries(rows: Row[], weekStart: dayjs.Dayjs): TimesheetEntry[] {
  const out: TimesheetEntry[] = [];
  for (const r of rows) {
    r.hours.forEach((h, i) => {
      if (r.projectId != null && h != null && h > 0) {
        out.push({
          projectId: r.projectId,
          workDate: weekStart.add(i, "day").format(FMT),
          hours: h,
          description: r.note.trim() || undefined,
        });
      }
    });
  }
  return out;
}

// ───────────────────────────── My timesheet ─────────────────────────────

function MyTimesheet() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(mondayOf(dayjs()));
  const ws = weekStart.format(FMT);
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const projects = useQuery({
    queryKey: ["timesheet-projects"],
    queryFn: timesheetService.activeProjects,
  });
  const sheet = useQuery({
    queryKey: ["timesheet-week", ws],
    queryFn: () => timesheetService.myWeek(ws),
    retry: false,
  });

  useEffect(() => {
    if (sheet.data) setRows(toRows(sheet.data, weekStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.data]);

  const status = sheet.data?.status ?? "DRAFT";
  const editable = status === "DRAFT" || status === "REJECTED";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["timesheet-week", ws] });
    qc.invalidateQueries({ queryKey: ["timesheet-history"] });
  };

  const entries = useMemo(() => toEntries(rows, weekStart), [rows, weekStart]);
  const incomplete = rows.some(
    (r) => r.projectId == null && r.hours.some((h) => h != null && h > 0),
  );
  const dayTotals = DAY_LABELS.map((_, i) =>
    rows.reduce((s, r) => s + (r.hours[i] ?? 0), 0),
  );
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);
  const overDay = dayTotals.some((t) => t > 24);

  const saveMut = useMutation({
    mutationFn: () => timesheetService.saveMyWeek(ws, entries),
    onSuccess: () => {
      message.success("Timesheet saved");
      refresh();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the timesheet")),
  });
  const submitMut = useMutation({
    mutationFn: async () => {
      await timesheetService.saveMyWeek(ws, entries);
      return timesheetService.submitMyWeek(ws);
    },
    onSuccess: () => {
      message.success("Timesheet submitted for approval");
      refresh();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't submit the timesheet")),
  });

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setHour = (key: string, i: number, v: number | null) =>
    setRows((rs) =>
      rs.map((r) =>
        r.key === key
          ? { ...r, hours: r.hours.map((h, j) => (j === i ? v : h)) }
          : r,
      ),
    );

  const projectOptions = (projects.data ?? []).map((p: TimesheetProject) => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
  }));

  const columns = [
    {
      title: "Project",
      key: "project",
      width: 230,
      render: (_: unknown, r: Row) => (
        <Select
          style={{ width: "100%" }}
          placeholder="Select project"
          disabled={!editable}
          value={r.projectId}
          options={projectOptions.filter(
            (o) =>
              o.value === r.projectId ||
              !rows.some(
                (x) =>
                  x.key !== r.key &&
                  x.projectId === o.value &&
                  x.note === r.note,
              ),
          )}
          onChange={(v) => setRow(r.key, { projectId: v })}
          showSearch
          optionFilterProp="label"
        />
      ),
    },
    ...DAY_LABELS.map((label, i) => ({
      title: (
        <div style={{ textAlign: "center" }}>
          {label}
          <div style={{ fontSize: 11, fontWeight: 400, color: "#888" }}>
            {weekStart.add(i, "day").format("DD MMM")}
          </div>
        </div>
      ),
      key: label,
      width: 82,
      render: (_: unknown, r: Row) => (
        <InputNumber
          min={0}
          max={24}
          step={0.5}
          precision={2}
          controls={false}
          disabled={!editable}
          value={r.hours[i]}
          style={{ width: 64 }}
          onChange={(v) => setHour(r.key, i, v)}
        />
      ),
    })),
    {
      title: "Total",
      key: "total",
      width: 70,
      render: (_: unknown, r: Row) =>
        r.hours.reduce<number>((s, h) => s + (h ?? 0), 0).toFixed(2),
    },
    {
      title: "Note",
      key: "note",
      render: (_: unknown, r: Row) => (
        <Input
          maxLength={500}
          disabled={!editable}
          value={r.note}
          placeholder="What did you work on?"
          onChange={(e) => setRow(r.key, { note: e.target.value })}
        />
      ),
    },
    {
      title: "",
      key: "x",
      width: 60,
      render: (_: unknown, r: Row) =>
        editable && rows.length > 1 ? (
          <Button
            size="small"
            type="text"
            danger
            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
          >
            Remove
          </Button>
        ) : null,
    },
  ];

  if (sheet.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={errMsg(sheet.error, "Couldn't load your timesheet")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Space>
          <Button onClick={() => setWeekStart(weekStart.subtract(7, "day"))}>
            ← Prev
          </Button>
          <Text strong>
            {weekStart.format("DD MMM")} –{" "}
            {weekStart.add(6, "day").format("DD MMM YYYY")}
          </Text>
          <Button onClick={() => setWeekStart(weekStart.add(7, "day"))}>
            Next →
          </Button>
          <Button onClick={() => setWeekStart(mondayOf(dayjs()))}>
            This week
          </Button>
        </Space>
        <Space>
          <Tag color={statusColor[status]}>{status}</Tag>
          <Text type="secondary">Week total: {weekTotal.toFixed(2)} h</Text>
        </Space>
      </div>

      {status === "REJECTED" && sheet.data?.reviewerRemarks && (
        <Alert
          type="error"
          showIcon
          message="This timesheet was rejected"
          description={`Reason: ${sheet.data.reviewerRemarks}. Fix it and submit again.`}
        />
      )}
      {status === "SUBMITTED" && (
        <Alert
          type="info"
          showIcon
          message="Awaiting approval — editing is locked."
        />
      )}
      {status === "APPROVED" && (
        <Alert
          type="success"
          showIcon
          message="Approved — this week is locked."
        />
      )}
      {overDay && (
        <Alert
          type="warning"
          showIcon
          message="A day has more than 24 hours logged."
        />
      )}

      <Table
        size="small"
        loading={sheet.isLoading || projects.isLoading}
        rowKey="key"
        pagination={false}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1000 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <b>Daily total</b>
            </Table.Summary.Cell>
            {dayTotals.map((t, i) => (
              <Table.Summary.Cell key={i} index={i + 1}>
                <b style={{ color: t > 24 ? "#cf1322" : undefined }}>
                  {t.toFixed(2)}
                </b>
              </Table.Summary.Cell>
            ))}
            <Table.Summary.Cell index={8}>
              <b>{weekTotal.toFixed(2)}</b>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={9} colSpan={2} />
          </Table.Summary.Row>
        )}
      />

      {editable && (
        <Space wrap>
          <Button onClick={() => setRows((rs) => [...rs, newRow()])}>
            + Add project row
          </Button>
          <Button
            loading={saveMut.isPending}
            disabled={overDay || incomplete}
            onClick={() => saveMut.mutate()}
          >
            Save draft
          </Button>
          <Button
            type="primary"
            loading={submitMut.isPending}
            disabled={weekTotal <= 0 || overDay || incomplete}
            onClick={() =>
              Modal.confirm({
                title: "Submit this timesheet?",
                content: `You are submitting ${weekTotal.toFixed(2)} hours for approval. You can't edit it afterwards unless it is rejected.`,
                onOk: () => submitMut.mutateAsync().catch(() => undefined),
              })
            }
          >
            Submit for approval
          </Button>
          {incomplete && (
            <Text type="danger">
              Pick a project for every row that has hours.
            </Text>
          )}
        </Space>
      )}

      <History />
    </div>
  );
}

function History() {
  const history = useQuery({
    queryKey: ["timesheet-history"],
    queryFn: timesheetService.myHistory,
    retry: false,
  });
  return (
    <div className="pt-4">
      <Title level={5}>Previous weeks</Title>
      <Table
        size="small"
        rowKey={(r: Timesheet) => r.id ?? r.weekStart}
        loading={history.isLoading}
        pagination={{ pageSize: 8 }}
        dataSource={history.data ?? []}
        columns={[
          { title: "Week of", dataIndex: "weekStart", key: "w" },
          {
            title: "Hours",
            dataIndex: "totalHours",
            key: "h",
            render: (v: number) => Number(v).toFixed(2),
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "s",
            render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
          },
          {
            title: "Reviewer remarks",
            dataIndex: "reviewerRemarks",
            key: "r",
            ellipsis: true,
          },
        ]}
      />
    </div>
  );
}

// ───────────────────────────── Approvals ─────────────────────────────

function Approvals() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Timesheet | null>(null);
  const [remarks, setRemarks] = useState("");

  const pending = useQuery({
    queryKey: ["timesheet-pending"],
    queryFn: timesheetService.pending,
  });
  const employees = useQuery({
    queryKey: ["employees", "includeDeleted"],
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  const projects = useQuery({
    queryKey: ["timesheet-projects-all"],
    queryFn: timesheetService.allProjects,
  });

  const empName = (id: string) => {
    const e = (employees.data ?? []).find((x: ResourceRecord) => x.id === id);
    return e ? `${e.employeeCode} — ${e.firstName} ${e.lastName}` : id;
  };
  const projName = (id: number) => {
    const p = (projects.data ?? []).find((x) => x.id === id);
    return p ? p.code : id;
  };

  const decideMut = useMutation({
    mutationFn: (v: {
      id: number;
      status: "APPROVED" | "REJECTED";
      remarks?: string;
    }) =>
      timesheetService.decide(v.id, { status: v.status, remarks: v.remarks }),
    onSuccess: () => {
      message.success("Decision recorded");
      setTarget(null);
      setRemarks("");
      qc.invalidateQueries({ queryKey: ["timesheet-pending"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't record the decision")),
  });

  return (
    <>
      <Table
        size="small"
        rowKey={(r: Timesheet) => r.id as number}
        loading={pending.isLoading}
        dataSource={pending.data ?? []}
        locale={{ emptyText: "No timesheets waiting for approval" }}
        columns={[
          {
            title: "Employee",
            key: "e",
            render: (_: unknown, r: Timesheet) => empName(r.employeeId),
          },
          { title: "Week of", dataIndex: "weekStart", key: "w" },
          {
            title: "Hours",
            dataIndex: "totalHours",
            key: "h",
            render: (v: number) => Number(v).toFixed(2),
          },
          {
            title: "Breakdown",
            key: "b",
            render: (_: unknown, r: Timesheet) => {
              const by = new Map<number, number>();
              r.entries.forEach((e) =>
                by.set(e.projectId, (by.get(e.projectId) ?? 0) + e.hours),
              );
              return [...by.entries()]
                .map(([pid, h]) => `${projName(pid)}: ${h.toFixed(2)}h`)
                .join(", ");
            },
          },
          {
            title: "",
            key: "a",
            align: "right" as const,
            render: (_: unknown, r: Timesheet) => (
              <Space>
                <Button
                  size="small"
                  type="primary"
                  loading={decideMut.isPending}
                  onClick={() =>
                    decideMut.mutate({ id: r.id as number, status: "APPROVED" })
                  }
                >
                  Approve
                </Button>
                <Button size="small" danger onClick={() => setTarget(r)}>
                  Reject
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!target}
        title="Reject timesheet"
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !remarks.trim() }}
        confirmLoading={decideMut.isPending}
        onCancel={() => {
          setTarget(null);
          setRemarks("");
        }}
        onOk={() =>
          target &&
          decideMut.mutate({
            id: target.id as number,
            status: "REJECTED",
            remarks: remarks.trim(),
          })
        }
      >
        <Text type="secondary">
          {target
            ? `${empName(target.employeeId)} — week of ${target.weekStart}`
            : ""}
        </Text>
        <Input.TextArea
          style={{ marginTop: 12 }}
          rows={3}
          maxLength={1000}
          placeholder="Reason (required)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
}

// ───────────────────────────── Projects ─────────────────────────────

function Projects() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TimesheetProject | "new" | null>(null);
  const [form, setForm] = useState<ProjectBody>({
    name: "",
    code: "",
    isActive: true,
  });

  const projects = useQuery({
    queryKey: ["timesheet-projects-all"],
    queryFn: timesheetService.allProjects,
  });

  const open = (p: TimesheetProject | "new") => {
    setEditing(p);
    setForm(
      p === "new"
        ? { name: "", code: "", isActive: true }
        : { name: p.name, code: p.code, isActive: p.isActive },
    );
  };

  const saveMut = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? timesheetService.updateProject(editing.id, form)
        : timesheetService.createProject(form),
    onSuccess: () => {
      message.success("Project saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["timesheet-projects-all"] });
      qc.invalidateQueries({ queryKey: ["timesheet-projects"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the project")),
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="primary" onClick={() => open("new")}>
          + New project
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={projects.isLoading}
        dataSource={projects.data ?? []}
        columns={[
          { title: "Code", dataIndex: "code", key: "c" },
          { title: "Name", dataIndex: "name", key: "n" },
          {
            title: "Active",
            dataIndex: "isActive",
            key: "a",
            render: (v: boolean) =>
              v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
          },
          {
            title: "",
            key: "x",
            align: "right" as const,
            render: (_: unknown, r: TimesheetProject) => (
              <Button size="small" onClick={() => open(r)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!editing}
        title={editing === "new" ? "New project" : "Edit project"}
        okText="Save"
        okButtonProps={{ disabled: !form.name.trim() || !form.code.trim() }}
        confirmLoading={saveMut.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => saveMut.mutate()}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
          }}
        >
          <Input
            placeholder="Code (e.g. PRJ-01)"
            maxLength={40}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <Input
            placeholder="Project name"
            maxLength={150}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Space>
            <Switch
              checked={form.isActive !== false}
              onChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Text>
              Active (inactive projects can't be used for new entries)
            </Text>
          </Space>
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Page ─────────────────────────────

export default function TimesheetsPage() {
  const { isHr, isManager } = useRole();
  const canReview = isHr || isManager;

  const items = [
    { key: "mine", label: "My Timesheet", children: <MyTimesheet /> },
    ...(canReview
      ? [
          { key: "approvals", label: "Approvals", children: <Approvals /> },
          { key: "projects", label: "Projects", children: <Projects /> },
        ]
      : []),
  ];

  return (
    <ConfigProvider theme={theme}>
      <div className="space-y-4 p-6">
        <Title level={3} style={{ margin: 0 }}>
          Timesheets
        </Title>
        <Tabs items={items} />
      </div>
    </ConfigProvider>
  );
}
