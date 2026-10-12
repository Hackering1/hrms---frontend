import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  planService,
  type BillingCycle,
  type CompanySubscription,
  type PlanBody,
  type SubscriptionPlan,
} from "../../services/planService";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const money = (v: number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message ?? fallback;

const emptyForm: PlanBody = {
  name: "",
  code: "",
  priceMonthly: 0,
  priceYearly: 0,
  maxEmployees: null,
  features: "",
  isActive: true,
};

export default function PlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SubscriptionPlan | "new" | null>(null);
  const [form, setForm] = useState<PlanBody>(emptyForm);
  const [subscribeTo, setSubscribeTo] = useState<SubscriptionPlan | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");

  const plans = useQuery({ queryKey: ["plans"], queryFn: planService.list });
  const current = useQuery({
    queryKey: ["plan-current"],
    queryFn: planService.current,
  });
  const history = useQuery({
    queryKey: ["plan-history"],
    queryFn: planService.history,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plans"] });
    qc.invalidateQueries({ queryKey: ["plan-current"] });
    qc.invalidateQueries({ queryKey: ["plan-history"] });
  };

  const planName = (id: number) =>
    plans.data?.find((p) => p.id === id)?.name ?? String(id);

  const openForm = (p: SubscriptionPlan | "new") => {
    setEditing(p);
    setForm(
      p === "new"
        ? emptyForm
        : {
            name: p.name,
            code: p.code,
            priceMonthly: p.priceMonthly,
            priceYearly: p.priceYearly,
            maxEmployees: p.maxEmployees ?? null,
            features: p.features ?? "",
            isActive: p.isActive,
          },
    );
  };

  const saveMut = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? planService.update(editing.id, form)
        : planService.create(form),
    onSuccess: () => {
      message.success("Plan saved");
      setEditing(null);
      refresh();
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the plan")),
  });

  const subscribeMut = useMutation({
    mutationFn: () =>
      planService.subscribe((subscribeTo as SubscriptionPlan).id, cycle),
    onSuccess: () => {
      message.success("Subscription updated");
      setSubscribeTo(null);
      refresh();
    },
    onError: (e) =>
      message.error(errMsg(e, "Couldn't change the subscription")),
  });

  const cancelMut = useMutation({
    mutationFn: planService.cancel,
    onSuccess: () => {
      message.success("Subscription cancelled");
      refresh();
    },
    onError: (e) =>
      message.error(errMsg(e, "Couldn't cancel the subscription")),
  });

  const cur = current.data;
  const sub = cur?.subscription ?? null;
  const pct =
    cur && cur.maxEmployees
      ? Math.min(100, Math.round((cur.employeeCount / cur.maxEmployees) * 100))
      : 0;

  return (
    <ConfigProvider theme={theme}>
      <div className="space-y-6 p-6">
        <Title level={3} style={{ margin: 0 }}>
          Plan &amp; Billing
        </Title>

        <div className="rounded-xl border border-slate-200 p-4">
          <Title level={5}>Current plan</Title>
          {current.isError ? (
            <Alert
              type="error"
              showIcon
              message={errMsg(current.error, "Couldn't load the current plan")}
            />
          ) : !sub || !cur?.plan ? (
            <Text type="secondary">
              No active plan. Choose one below to record your subscription.
            </Text>
          ) : (
            <div className="space-y-2">
              <Space wrap>
                <Text strong style={{ fontSize: 18 }}>
                  {cur.plan.name}
                </Text>
                <Tag color="success">{sub.status}</Tag>
                <Tag>{sub.billingCycle}</Tag>
                <Text type="secondary">
                  Since {sub.startDate}
                  {sub.endDate ? ` · renews ${sub.endDate}` : ""}
                </Text>
              </Space>
              <div style={{ maxWidth: 420 }}>
                <Text type="secondary">
                  Employees: {cur.employeeCount}
                  {cur.maxEmployees ? ` of ${cur.maxEmployees}` : " (no cap)"}
                </Text>
                {cur.maxEmployees ? (
                  <Progress
                    percent={pct}
                    status={cur.overLimit ? "exception" : "normal"}
                    size="small"
                  />
                ) : null}
              </div>
              {cur.overLimit && (
                <Alert
                  type="warning"
                  showIcon
                  message="You have more employees than this plan allows. Adding people isn't blocked, but consider a larger plan."
                />
              )}
              <Button
                danger
                loading={cancelMut.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: "Cancel the current subscription?",
                    onOk: () => cancelMut.mutateAsync().catch(() => undefined),
                  })
                }
              >
                Cancel subscription
              </Button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Title level={5} style={{ margin: 0 }}>
              Plans
            </Title>
            <Button type="primary" onClick={() => openForm("new")}>
              + New plan
            </Button>
          </div>
          <Table
            size="small"
            rowKey="id"
            loading={plans.isLoading}
            dataSource={plans.data ?? []}
            pagination={false}
            columns={[
              {
                title: "Plan",
                key: "n",
                render: (_: unknown, p: SubscriptionPlan) =>
                  `${p.name} (${p.code})`,
              },
              {
                title: "Monthly",
                dataIndex: "priceMonthly",
                key: "m",
                render: (v: number) => money(v),
              },
              {
                title: "Yearly",
                dataIndex: "priceYearly",
                key: "y",
                render: (v: number) => money(v),
              },
              {
                title: "Employees",
                dataIndex: "maxEmployees",
                key: "e",
                render: (v?: number | null) => v ?? "Unlimited",
              },
              {
                title: "Includes",
                dataIndex: "features",
                key: "f",
                ellipsis: true,
              },
              {
                title: "Status",
                dataIndex: "isActive",
                key: "a",
                render: (v: boolean) =>
                  v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
              },
              {
                title: "",
                key: "x",
                align: "right" as const,
                render: (_: unknown, p: SubscriptionPlan) => (
                  <Space>
                    <Button size="small" onClick={() => openForm(p)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      disabled={!p.isActive || cur?.plan?.id === p.id}
                      onClick={() => {
                        setSubscribeTo(p);
                        setCycle(sub?.billingCycle ?? "MONTHLY");
                      }}
                    >
                      {cur?.plan?.id === p.id ? "Current" : "Choose"}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </div>

        <div>
          <Title level={5}>Subscription history</Title>
          <Table
            size="small"
            rowKey="id"
            loading={history.isLoading}
            dataSource={history.data ?? []}
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: "Plan",
                key: "p",
                render: (_: unknown, s: CompanySubscription) =>
                  planName(s.planId),
              },
              { title: "Billing", dataIndex: "billingCycle", key: "b" },
              { title: "Start", dataIndex: "startDate", key: "s" },
              { title: "End", dataIndex: "endDate", key: "e" },
              { title: "Status", dataIndex: "status", key: "st" },
            ]}
          />
        </div>

        <Modal
          open={!!editing}
          title={editing === "new" ? "New plan" : "Edit plan"}
          okText="Save"
          okButtonProps={{ disabled: !form.name.trim() || !form.code.trim() }}
          confirmLoading={saveMut.isPending}
          onCancel={() => setEditing(null)}
          onOk={() => saveMut.mutate()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              placeholder="Plan name (e.g. Growth)"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Code (e.g. GROWTH)"
              maxLength={40}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              precision={2}
              addonBefore="₹ / month"
              value={form.priceMonthly}
              onChange={(v) => setForm({ ...form, priceMonthly: v ?? 0 })}
            />
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              precision={2}
              addonBefore="₹ / year"
              value={form.priceYearly}
              onChange={(v) => setForm({ ...form, priceYearly: v ?? 0 })}
            />
            <InputNumber
              style={{ width: "100%" }}
              min={1}
              precision={0}
              placeholder="Employee cap (empty = unlimited)"
              value={form.maxEmployees ?? null}
              onChange={(v) => setForm({ ...form, maxEmployees: v })}
            />
            <Input.TextArea
              rows={3}
              maxLength={1000}
              placeholder="Included modules, comma-separated (e.g. Payroll, Timesheets, Expenses)"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
            <Space>
              <Switch
                checked={form.isActive !== false}
                onChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Text>Active</Text>
            </Space>
          </div>
        </Modal>

        <Modal
          open={!!subscribeTo}
          title={subscribeTo ? `Switch to ${subscribeTo.name}` : ""}
          okText="Confirm"
          confirmLoading={subscribeMut.isPending}
          onCancel={() => setSubscribeTo(null)}
          onOk={() => subscribeMut.mutate()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Select
              value={cycle}
              onChange={setCycle}
              options={[
                {
                  value: "MONTHLY",
                  label: `Monthly — ${subscribeTo ? money(subscribeTo.priceMonthly) : ""}`,
                },
                {
                  value: "YEARLY",
                  label: `Yearly — ${subscribeTo ? money(subscribeTo.priceYearly) : ""}`,
                },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              This records your plan choice only. No payment is taken and no
              module is switched on or off.
            </Text>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
