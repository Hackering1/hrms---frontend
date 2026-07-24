import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
  Checkbox,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Spin,
  Modal as AntModal,
  Popconfirm,
} from "antd";
import { PlusOutlined, CheckOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { hropsService } from "../../services/hropsService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

type Tab = "onboarding" | "probation" | "confirmation" | "exit";

const TAB_LABEL: Record<Tab, string> = {
  onboarding: "Onboarding",
  probation: "Probation",
  confirmation: "Confirmation",
  exit: "Exit",
};

const STATUS_TAG: Record<string, string> = {
  IN_PROGRESS: "orange",
  CONFIRMED: "green",
  EXTENDED: "blue",
  TERMINATED: "red",
};

export default function HrOperationsPage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isHr, isManager } = useRole();
  const managerScoped = isManager && !isSuperAdmin && !isHr;
  const [tab, setTab] = useState<Tab>("onboarding");
  const [employeeId, setEmployeeId] = useState("");
  const [modal, setModal] = useState<null | Tab>(null);
  const [form, setForm] = useState<Record<string, any>>({});

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

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
    enabled: !managerScoped,
  });

  const pickerPeople = (
    managerScoped ? (team.data ?? []) : (employees.data ?? [])
  ) as ResourceRecord[];

  const onboarding = useQuery({
    queryKey: ["onboarding", employeeId],
    queryFn: () => hropsService.onboardingByEmployee(employeeId),
    enabled: !!employeeId && tab === "onboarding",
  });
  const probation = useQuery({
    queryKey: ["probation", employeeId],
    queryFn: () => hropsService.probationByEmployee(employeeId),
    enabled: !!employeeId && tab === "probation",
  });
  const confirmations = useQuery({
    queryKey: ["confirmations", employeeId],
    queryFn: () => hropsService.confirmationsByEmployee(employeeId),
    enabled: !!employeeId && tab === "confirmation",
  });
  const exits = useQuery({
    queryKey: ["exits", employeeId],
    queryFn: () => hropsService.exitByEmployee(employeeId),
    enabled: !!employeeId && tab === "exit",
  });

  const invalidate = (key: string) =>
    qc.invalidateQueries({ queryKey: [key, employeeId] });

  const completeTask = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      hropsService.completeTask(id, completed),
    onSuccess: () => invalidate("onboarding"),
  });
  const deleteTask = useMutation({
    mutationFn: (id: number) => hropsService.deleteTask(id),
    onSuccess: () => invalidate("onboarding"),
  });
  const reviewProbation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      hropsService.reviewProbation(id, status, ""),
    onSuccess: () => invalidate("probation"),
  });

  const addMut = useMutation({
    mutationFn: (): Promise<any> => {
      const body = { ...form, employeeId };
      if (modal === "onboarding") return hropsService.addOnboardingTask(body);
      if (modal === "probation") return hropsService.addProbation(body);
      if (modal === "confirmation") return hropsService.addConfirmation(body);
      return hropsService.addExit(body);
    },
    onSuccess: () => {
      if (modal)
        invalidate(
          modal === "onboarding"
            ? "onboarding"
            : modal === "probation"
              ? "probation"
              : modal === "confirmation"
                ? "confirmations"
                : "exits",
        );
      setModal(null);
      setForm({});
    },
  });

  const openModal = (t: Tab) => {
    setForm({});
    setModal(t);
  };
  const change = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onboardingColumns = [
    { title: "Task", dataIndex: "taskName", key: "taskName" },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Due",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Done",
      key: "done",
      render: (_: any, t: any) => (
        <Checkbox
          checked={t.isCompleted}
          onChange={(e) =>
            completeTask.mutate({ id: t.id, completed: e.target.checked })
          }
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, t: any) => (
        <Popconfirm
          title="Delete task?"
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteTask.mutate(t.id)}
        >
          <AntButton size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const probationColumns = [
    { title: "Start", dataIndex: "probationStart", key: "probationStart" },
    {
      title: "End",
      key: "end",
      render: (_: any, p: any) => p.extendedEndDate ?? p.probationEnd,
    },
    {
      title: "Status",
      key: "status",
      render: (_: any, p: any) => (
        <Tag color={STATUS_TAG[p.status] ?? "default"}>{p.status}</Tag>
      ),
    },
    {
      title: "Review",
      key: "review",
      align: "right" as const,
      render: (_: any, p: any) =>
        p.status === "IN_PROGRESS" ? (
          <Space>
            <AntButton
              size="small"
              icon={<CheckOutlined />}
              style={{ color: "#16a34a" }}
              onClick={() =>
                reviewProbation.mutate({ id: p.id, status: "CONFIRMED" })
              }
            />
            <AntButton
              size="small"
              onClick={() =>
                reviewProbation.mutate({ id: p.id, status: "EXTENDED" })
              }
            >
              Extend
            </AntButton>
            <AntButton
              size="small"
              danger
              onClick={() =>
                reviewProbation.mutate({ id: p.id, status: "TERMINATED" })
              }
            >
              Terminate
            </AntButton>
          </Space>
        ) : (
          "\u2014"
        ),
    },
  ];

  const confirmationColumns = [
    {
      title: "Confirmation Date",
      dataIndex: "confirmationDate",
      key: "confirmationDate",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Letter",
      key: "letter",
      render: (_: any, c: any) => (c.letterGenerated ? "Yes" : "No"),
    },
  ];

  const exitColumns = [
    {
      title: "Resignation",
      dataIndex: "resignationDate",
      key: "resignationDate",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Last Day",
      dataIndex: "lastWorkingDate",
      key: "lastWorkingDate",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Type",
      dataIndex: "exitType",
      key: "exitType",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Interview",
      key: "interview",
      render: (_: any, x: any) => (x.exitInterviewDone ? "Done" : "Pending"),
    },
  ];

  const tabTable = () => {
    if (tab === "onboarding")
      return (
        <Table
          loading={onboarding.isLoading}
          rowKey={(t: any) => t.id}
          columns={onboardingColumns}
          dataSource={onboarding.data ?? []}
          locale={{ emptyText: "No onboarding tasks." }}
          pagination={{ pageSize: 10 }}
        />
      );
    if (tab === "probation")
      return (
        <Table
          loading={probation.isLoading}
          rowKey={(p: any) => p.id}
          columns={probationColumns}
          dataSource={probation.data ?? []}
          locale={{ emptyText: "No probation records." }}
          pagination={{ pageSize: 10 }}
        />
      );
    if (tab === "confirmation")
      return (
        <Table
          loading={confirmations.isLoading}
          rowKey={(c: any) => c.id}
          columns={confirmationColumns}
          dataSource={confirmations.data ?? []}
          locale={{ emptyText: "No confirmation records." }}
          pagination={{ pageSize: 10 }}
        />
      );
    return (
      <Table
        loading={exits.isLoading}
        rowKey={(x: any) => x.id}
        columns={exitColumns}
        dataSource={exits.data ?? []}
        locale={{ emptyText: "No exit records." }}
        pagination={{ pageSize: 10 }}
      />
    );
  };

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          HR Operations
        </Title>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>Employee</Text>
            <AntSelect
              style={{ maxWidth: 360 }}
              showSearch
              optionFilterProp="label"
              value={employeeId || undefined}
              onChange={(v) => setEmployeeId(v)}
              placeholder={"\u2014 Select \u2014"}
              options={pickerPeople.map((e: ResourceRecord) => ({
                value: String(e.id),
                label:
                  e.employeeCode + " \u2014 " + e.firstName + " " + e.lastName,
              }))}
            />
          </div>
        </Card>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
          items={(Object.keys(TAB_LABEL) as Tab[]).map((k) => ({
            key: k,
            label: TAB_LABEL[k],
          }))}
        />

        {!employeeId ? (
          <Card>
            <Text type="secondary">
              Select an employee to manage their HR operations.
            </Text>
          </Card>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <AntButton
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal(tab)}
              >
                Add {TAB_LABEL[tab]}
              </AntButton>
            </div>
            {tabTable()}
          </>
        )}

        {/* ADD MODALS */}
        <AntModal
          open={modal === "onboarding"}
          title="Add Onboarding Task"
          onCancel={() => setModal(null)}
          footer={modalFooter(
            () => setModal(null),
            () => addMut.mutate(),
            addMut.isPending || !form.taskName,
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Task Name">
              <AntInput
                value={form.taskName ?? ""}
                onChange={(e) => change("taskName", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Category">
              <AntInput
                value={form.category ?? ""}
                onChange={(e) => change("category", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Due Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.dueDate ? dayjs(form.dueDate) : null}
                onChange={(d) =>
                  change("dueDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
          </div>
        </AntModal>

        <AntModal
          open={modal === "probation"}
          title="Add Probation"
          onCancel={() => setModal(null)}
          footer={modalFooter(
            () => setModal(null),
            () => addMut.mutate(),
            addMut.isPending || !form.probationStart || !form.probationEnd,
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Probation Start">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.probationStart ? dayjs(form.probationStart) : null}
                onChange={(d) =>
                  change("probationStart", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
            <FieldRow label="Probation End">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={form.probationEnd ? dayjs(form.probationEnd) : null}
                onChange={(d) =>
                  change("probationEnd", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
          </div>
        </AntModal>

        <AntModal
          open={modal === "confirmation"}
          title="Add Confirmation"
          onCancel={() => setModal(null)}
          footer={modalFooter(
            () => setModal(null),
            () => addMut.mutate(),
            addMut.isPending || !form.confirmationDate,
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Confirmation Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={
                  form.confirmationDate ? dayjs(form.confirmationDate) : null
                }
                onChange={(d) =>
                  change("confirmationDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
            <FieldRow label="Remarks">
              <AntInput
                value={form.remarks ?? ""}
                onChange={(e) => change("remarks", e.target.value)}
              />
            </FieldRow>
          </div>
        </AntModal>

        <AntModal
          open={modal === "exit"}
          title="Add Exit Record"
          onCancel={() => setModal(null)}
          footer={modalFooter(
            () => setModal(null),
            () => addMut.mutate(),
            addMut.isPending,
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Resignation Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={
                  form.resignationDate ? dayjs(form.resignationDate) : null
                }
                onChange={(d) =>
                  change("resignationDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
            <FieldRow label="Last Working Date">
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
                value={
                  form.lastWorkingDate ? dayjs(form.lastWorkingDate) : null
                }
                onChange={(d) =>
                  change("lastWorkingDate", d ? d.format("YYYY-MM-DD") : "")
                }
              />
            </FieldRow>
            <FieldRow label="Exit Type">
              <AntSelect
                style={{ width: "100%" }}
                value={form.exitType || undefined}
                onChange={(v) => change("exitType", v)}
                placeholder={"\u2014 Select \u2014"}
                options={[
                  { value: "RESIGNATION", label: "Resignation" },
                  { value: "TERMINATION", label: "Termination" },
                  { value: "RETIREMENT", label: "Retirement" },
                  { value: "END_OF_CONTRACT", label: "End of Contract" },
                ]}
              />
            </FieldRow>
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}

function modalFooter(
  onCancel: () => void,
  onSave: () => void,
  disabled?: boolean,
) {
  return [
    <AntButton key="cancel" onClick={onCancel}>
      Cancel
    </AntButton>,
    <AntButton key="save" type="primary" disabled={disabled} onClick={onSave}>
      Save
    </AntButton>,
  ];
}

function FieldRow({
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
