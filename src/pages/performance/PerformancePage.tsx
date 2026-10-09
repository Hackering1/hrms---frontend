import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ConfigProvider,
  DatePicker,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Rate,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  performanceService,
  type GoalBody,
  type PerformanceCycle,
  type PerformanceGoal,
  type PerformanceReview,
} from "../../services/performanceService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const FMT = "YYYY-MM-DD";

const reviewColor: Record<string, string> = {
  NOT_STARTED: "default",
  SELF_SUBMITTED: "warning",
  COMPLETED: "success",
};

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message ?? fallback;

function useEmployeeName() {
  const employees = useQuery({
    queryKey: ["employees", "includeDeleted"],
    queryFn: () => resourceService.list("/employees?includeDeleted=true"),
  });
  return (id: string) => {
    const e = (employees.data ?? []).find((x: ResourceRecord) => x.id === id);
    return e ? `${e.employeeCode} — ${e.firstName} ${e.lastName}` : id;
  };
}

// ───────────────────────────── Goals ─────────────────────────────

function GoalForm({
  cycle,
  goal,
  onClose,
  onSaved,
}: {
  cycle: PerformanceCycle;
  goal: PerformanceGoal | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = goal && goal !== "new" ? goal : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<dayjs.Dayjs | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setTarget(existing?.targetDate ? dayjs(existing.targetDate) : null);
    setProgress(existing?.progress ?? 0);
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMut = useMutation({
    mutationFn: () => {
      const body: GoalBody = {
        cycleId: cycle.id,
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate: target ? target.format(FMT) : null,
        progress,
      };
      return existing
        ? performanceService.updateGoal(existing.id, body)
        : performanceService.createGoal(body);
    },
    onSuccess: () => {
      message.success("Goal saved");
      onSaved();
      onClose();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the goal")),
  });

  return (
    <Modal
      open={!!goal}
      title={existing ? "Edit goal" : "New goal"}
      okText="Save"
      okButtonProps={{ disabled: !title.trim() }}
      confirmLoading={saveMut.isPending}
      onCancel={onClose}
      onOk={() => saveMut.mutate()}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          placeholder="Goal title"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input.TextArea
          rows={3}
          maxLength={1000}
          placeholder="Details / how success is measured"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <DatePicker
          style={{ width: "100%" }}
          placeholder="Target date (optional)"
          value={target}
          onChange={setTarget}
          disabledDate={(d) =>
            d.isBefore(dayjs(cycle.startDate), "day") ||
            d.isAfter(dayjs(cycle.endDate), "day")
          }
        />
        <div>
          <Text type="secondary">Progress (%)</Text>
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            max={100}
            precision={0}
            value={progress}
            onChange={(v) => setProgress(v ?? 0)}
          />
        </div>
      </div>
    </Modal>
  );
}

function GoalsTable({
  goals,
  loading,
  editable,
  onEdit,
  onDelete,
}: {
  goals: PerformanceGoal[];
  loading: boolean;
  editable: boolean;
  onEdit?: (g: PerformanceGoal) => void;
  onDelete?: (g: PerformanceGoal) => void;
}) {
  return (
    <Table
      size="small"
      rowKey="id"
      loading={loading}
      pagination={false}
      dataSource={goals}
      locale={{ emptyText: "No goals yet" }}
      columns={[
        {
          title: "Goal",
          key: "t",
          render: (_: unknown, g: PerformanceGoal) => (
            <div>
              <b>{g.title}</b>
              {g.description && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {g.description}
                  </Text>
                </div>
              )}
            </div>
          ),
        },
        { title: "Target", dataIndex: "targetDate", key: "d", width: 110 },
        {
          title: "Progress",
          dataIndex: "progress",
          key: "p",
          width: 180,
          render: (v: number) => <Progress percent={v} size="small" />,
        },
        ...(editable
          ? [
              {
                title: "",
                key: "x",
                width: 140,
                render: (_: unknown, g: PerformanceGoal) => (
                  <Space>
                    <Button size="small" onClick={() => onEdit?.(g)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() =>
                        Modal.confirm({
                          title: "Delete this goal?",
                          onOk: () => onDelete?.(g),
                        })
                      }
                    >
                      Delete
                    </Button>
                  </Space>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}

// ───────────────────────────── My goals & review ─────────────────────────────

function MyPerformance({ cycle }: { cycle: PerformanceCycle }) {
  const qc = useQueryClient();
  const open = cycle.status === "OPEN";
  const [goal, setGoal] = useState<PerformanceGoal | "new" | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");

  const goals = useQuery({
    queryKey: ["perf-goals-me", cycle.id],
    queryFn: () => performanceService.myGoals(cycle.id),
    retry: false,
  });
  const review = useQuery({
    queryKey: ["perf-review-me", cycle.id],
    queryFn: () => performanceService.myReview(cycle.id),
    retry: false,
  });

  const refreshGoals = () =>
    qc.invalidateQueries({ queryKey: ["perf-goals-me", cycle.id] });

  const deleteMut = useMutation({
    mutationFn: (g: PerformanceGoal) => performanceService.deleteGoal(g.id),
    onSuccess: () => {
      message.success("Goal deleted");
      refreshGoals();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't delete the goal")),
  });

  const selfMut = useMutation({
    mutationFn: () =>
      performanceService.submitSelfReview({
        cycleId: cycle.id,
        rating,
        comments: comments.trim(),
      }),
    onSuccess: () => {
      message.success("Self review submitted");
      setRating(0);
      setComments("");
      qc.invalidateQueries({ queryKey: ["perf-review-me", cycle.id] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't submit your review")),
  });

  if (goals.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={errMsg(goals.error, "Couldn't load your performance data")}
      />
    );
  }

  const r: PerformanceReview | undefined = review.data;

  return (
    <div className="space-y-6">
      {!open && (
        <Alert
          type="info"
          showIcon
          message="This cycle is closed — it is read-only."
        />
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Title level={5} style={{ margin: 0 }}>
            My goals
          </Title>
          {open && (
            <Button type="primary" onClick={() => setGoal("new")}>
              + New goal
            </Button>
          )}
        </div>
        <GoalsTable
          goals={goals.data ?? []}
          loading={goals.isLoading}
          editable={open}
          onEdit={setGoal}
          onDelete={(g) => deleteMut.mutate(g)}
        />
      </div>

      <div>
        <Title level={5}>My review</Title>
        {review.isLoading ? null : r && r.status !== "NOT_STARTED" ? (
          <div className="space-y-3">
            <Tag color={reviewColor[r.status]}>
              {r.status.replace("_", " ")}
            </Tag>
            <div>
              <Text strong>Self assessment</Text>
              <div>
                <Rate disabled value={r.selfRating ?? 0} />
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{r.selfComments}</div>
            </div>
            {r.status === "COMPLETED" ? (
              <div>
                <Text strong>Manager's review</Text>
                <div>
                  <Rate disabled value={r.managerRating ?? 0} />
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {r.managerComments}
                </div>
              </div>
            ) : (
              <Text type="secondary">Waiting for your manager's review.</Text>
            )}
          </div>
        ) : open ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxWidth: 560,
            }}
          >
            <div>
              <Text type="secondary">Overall self rating</Text>
              <div>
                <Rate value={rating} onChange={setRating} />
              </div>
            </div>
            <Input.TextArea
              rows={4}
              maxLength={2000}
              placeholder="How did this period go? Achievements, challenges, what you'd improve."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <div>
              <Button
                type="primary"
                disabled={rating < 1 || !comments.trim()}
                loading={selfMut.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: "Submit your self review?",
                    content: "You can't change it after submitting.",
                    onOk: () => selfMut.mutateAsync().catch(() => undefined),
                  })
                }
              >
                Submit self review
              </Button>
            </div>
          </div>
        ) : (
          <Text type="secondary">
            No self review was submitted for this cycle.
          </Text>
        )}
      </div>

      <GoalForm
        cycle={cycle}
        goal={goal}
        onClose={() => setGoal(null)}
        onSaved={refreshGoals}
      />
    </div>
  );
}

// ───────────────────────────── Team ─────────────────────────────

function Team({ cycle }: { cycle: PerformanceCycle }) {
  const qc = useQueryClient();
  const empName = useEmployeeName();
  const open = cycle.status === "OPEN";
  const [goalsFor, setGoalsFor] = useState<string | null>(null);
  const [target, setTarget] = useState<PerformanceReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");

  const reviews = useQuery({
    queryKey: ["perf-team", cycle.id],
    queryFn: () => performanceService.teamReviews(cycle.id),
    retry: false,
  });
  const goals = useQuery({
    queryKey: ["perf-goals-emp", goalsFor, cycle.id],
    queryFn: () =>
      performanceService.employeeGoals(goalsFor as string, cycle.id),
    enabled: !!goalsFor,
  });

  const close = () => {
    setTarget(null);
    setRating(0);
    setComments("");
  };

  const completeMut = useMutation({
    mutationFn: () =>
      performanceService.completeReview(
        (target as PerformanceReview).id as number,
        {
          rating,
          comments: comments.trim(),
        },
      ),
    onSuccess: () => {
      message.success("Review completed");
      close();
      qc.invalidateQueries({ queryKey: ["perf-team", cycle.id] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't complete the review")),
  });

  return (
    <>
      <Table
        size="small"
        rowKey={(r: PerformanceReview) => r.id as number}
        loading={reviews.isLoading}
        dataSource={reviews.data ?? []}
        locale={{
          emptyText: reviews.isError
            ? errMsg(reviews.error, "Couldn't load reviews")
            : "No self reviews submitted yet",
        }}
        columns={[
          {
            title: "Employee",
            key: "e",
            render: (_: unknown, r: PerformanceReview) => empName(r.employeeId),
          },
          {
            title: "Self",
            key: "s",
            width: 150,
            render: (_: unknown, r: PerformanceReview) => (
              <Rate disabled value={r.selfRating ?? 0} />
            ),
          },
          {
            title: "Manager",
            key: "m",
            width: 150,
            render: (_: unknown, r: PerformanceReview) =>
              r.managerRating ? <Rate disabled value={r.managerRating} /> : "—",
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "st",
            render: (v: string) => (
              <Tag color={reviewColor[v]}>{v.replace("_", " ")}</Tag>
            ),
          },
          {
            title: "",
            key: "a",
            align: "right" as const,
            render: (_: unknown, r: PerformanceReview) => (
              <Space>
                <Button size="small" onClick={() => setGoalsFor(r.employeeId)}>
                  Goals
                </Button>
                <Button
                  size="small"
                  type={
                    r.status === "SELF_SUBMITTED" && open
                      ? "primary"
                      : "default"
                  }
                  onClick={() => setTarget(r)}
                >
                  {r.status === "SELF_SUBMITTED" && open ? "Review" : "View"}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={!!goalsFor}
        title={goalsFor ? `Goals — ${empName(goalsFor)}` : ""}
        footer={null}
        width={720}
        onCancel={() => setGoalsFor(null)}
      >
        <GoalsTable
          goals={goals.data ?? []}
          loading={goals.isLoading}
          editable={false}
        />
      </Modal>

      <Modal
        open={!!target}
        width={640}
        title={target ? `Review — ${empName(target.employeeId)}` : ""}
        onCancel={close}
        okText="Complete review"
        okButtonProps={{
          disabled: rating < 1 || !comments.trim(),
          style: {
            display:
              target?.status === "SELF_SUBMITTED" && open ? undefined : "none",
          },
        }}
        cancelText="Close"
        confirmLoading={completeMut.isPending}
        onOk={() => completeMut.mutate()}
      >
        {target && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Text strong>Self assessment</Text>
              <div>
                <Rate disabled value={target.selfRating ?? 0} />
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {target.selfComments}
              </div>
            </div>
            {target.status === "COMPLETED" ? (
              <div>
                <Text strong>Manager's review</Text>
                <div>
                  <Rate disabled value={target.managerRating ?? 0} />
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {target.managerComments}
                </div>
              </div>
            ) : open ? (
              <>
                <div>
                  <Text strong>Your rating</Text>
                  <div>
                    <Rate value={rating} onChange={setRating} />
                  </div>
                </div>
                <Input.TextArea
                  rows={4}
                  maxLength={2000}
                  placeholder="Feedback for the employee (they will see it)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </>
            ) : (
              <Text type="secondary">This cycle is closed.</Text>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

// ───────────────────────────── Cycles (HR) ─────────────────────────────

function Cycles() {
  const qc = useQueryClient();
  const cycles = useQuery({
    queryKey: ["perf-cycles"],
    queryFn: performanceService.cycles,
  });
  const [editing, setEditing] = useState<PerformanceCycle | "new" | null>(null);
  const [name, setName] = useState("");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const openForm = (c: PerformanceCycle | "new") => {
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setRange(c === "new" ? null : [dayjs(c.startDate), dayjs(c.endDate)]);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["perf-cycles"] });

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        startDate: (range as [dayjs.Dayjs, dayjs.Dayjs])[0].format(FMT),
        endDate: (range as [dayjs.Dayjs, dayjs.Dayjs])[1].format(FMT),
      };
      return editing && editing !== "new"
        ? performanceService.updateCycle(editing.id, body)
        : performanceService.createCycle(body);
    },
    onSuccess: () => {
      message.success("Cycle saved");
      setEditing(null);
      refresh();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the cycle")),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: number; status: "OPEN" | "CLOSED" }) =>
      performanceService.setCycleStatus(v.id, v.status),
    onSuccess: refresh,
    onError: (e) => message.error(errMsg(e, "Couldn't update the cycle")),
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="primary" onClick={() => openForm("new")}>
          + New cycle
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={cycles.isLoading}
        dataSource={cycles.data ?? []}
        columns={[
          { title: "Name", dataIndex: "name", key: "n" },
          { title: "Start", dataIndex: "startDate", key: "s" },
          { title: "End", dataIndex: "endDate", key: "e" },
          {
            title: "Status",
            dataIndex: "status",
            key: "st",
            render: (v: string) => (
              <Tag color={v === "OPEN" ? "success" : "default"}>{v}</Tag>
            ),
          },
          {
            title: "",
            key: "a",
            align: "right" as const,
            render: (_: unknown, c: PerformanceCycle) => (
              <Space>
                <Button size="small" onClick={() => openForm(c)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  danger={c.status === "OPEN"}
                  loading={statusMut.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title:
                        c.status === "OPEN"
                          ? "Close this cycle?"
                          : "Reopen this cycle?",
                      content:
                        c.status === "OPEN"
                          ? "Goals and reviews become read-only."
                          : "Goals and reviews become editable again.",
                      onOk: () =>
                        statusMut
                          .mutateAsync({
                            id: c.id,
                            status: c.status === "OPEN" ? "CLOSED" : "OPEN",
                          })
                          .catch(() => undefined),
                    })
                  }
                >
                  {c.status === "OPEN" ? "Close" : "Reopen"}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!editing}
        title={editing === "new" ? "New review cycle" : "Edit review cycle"}
        okText="Save"
        okButtonProps={{ disabled: !name.trim() || !range }}
        confirmLoading={saveMut.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => saveMut.mutate()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder="Name (e.g. FY 2026-27 H1)"
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <RangePicker
            style={{ width: "100%" }}
            value={range}
            onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
          />
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Page ─────────────────────────────

export default function PerformancePage() {
  const { isHr, isManager } = useRole();
  const canReview = isHr || isManager;
  const cycles = useQuery({
    queryKey: ["perf-cycles"],
    queryFn: performanceService.cycles,
  });
  const [cycleId, setCycleId] = useState<number | undefined>();

  useEffect(() => {
    if (cycleId == null && cycles.data && cycles.data.length > 0) {
      setCycleId(
        (cycles.data.find((c) => c.status === "OPEN") ?? cycles.data[0]).id,
      );
    }
  }, [cycles.data, cycleId]);

  const cycle = cycles.data?.find((c) => c.id === cycleId);

  const cycleSelect = (
    <Select
      style={{ minWidth: 260 }}
      placeholder="Select review cycle"
      value={cycleId}
      onChange={setCycleId}
      loading={cycles.isLoading}
      options={(cycles.data ?? []).map((c) => ({
        value: c.id,
        label: `${c.name} (${c.status})`,
      }))}
    />
  );

  const noCycle = (
    <Alert
      type="info"
      showIcon
      message={
        isHr
          ? "No review cycle yet — create one in the Cycles tab."
          : "No review cycle is open yet. HR will start one."
      }
    />
  );

  const items = [
    {
      key: "mine",
      label: "My Goals & Review",
      children: cycle ? (
        <MyPerformance key={cycle.id} cycle={cycle} />
      ) : (
        noCycle
      ),
    },
    ...(canReview
      ? [
          {
            key: "team",
            label: "Team Reviews",
            children: cycle ? <Team key={cycle.id} cycle={cycle} /> : noCycle,
          },
        ]
      : []),
    ...(isHr ? [{ key: "cycles", label: "Cycles", children: <Cycles /> }] : []),
  ];

  return (
    <ConfigProvider theme={theme}>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Title level={3} style={{ margin: 0 }}>
            Performance
          </Title>
          {cycleSelect}
        </div>
        <Tabs items={items} />
      </div>
    </ConfigProvider>
  );
}
