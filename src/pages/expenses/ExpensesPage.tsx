import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ConfigProvider,
  DatePicker,
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
  expenseService,
  type ExpenseCategory,
  type ExpenseCategoryBody,
  type ExpenseClaim,
} from "../../services/expenseService";
import { fileService } from "../../services/fileService";
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
  SUBMITTED: "warning",
  APPROVED: "processing",
  REJECTED: "error",
  PAID: "success",
  CANCELLED: "default",
};

const money = (v: number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message ?? fallback;

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

function useCategoryName(cats: ExpenseCategory[] | undefined) {
  return (id: number) => cats?.find((c) => c.id === id)?.name ?? String(id);
}

function ReceiptLink({ claim }: { claim: ExpenseClaim }) {
  if (!claim.receiptUrl) return <Text type="secondary">—</Text>;
  return (
    <Button
      size="small"
      type="link"
      onClick={() =>
        fileService
          .openFile(claim.receiptUrl as string)
          .catch(() => message.error("Couldn't open the receipt"))
      }
    >
      View
    </Button>
  );
}

// ───────────────────────────── My claims ─────────────────────────────

function MyClaims() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [date, setDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const cats = useQuery({
    queryKey: ["expense-categories"],
    queryFn: expenseService.activeCategories,
  });
  const allCats = useQuery({
    queryKey: ["expense-categories-lookup"],
    queryFn: expenseService.activeCategories,
  });
  const claims = useQuery({
    queryKey: ["expense-claims-me"],
    queryFn: expenseService.myClaims,
    retry: false,
  });
  const catName = useCategoryName(allCats.data);
  const selected = cats.data?.find((c) => c.id === categoryId);

  const reset = () => {
    setCategoryId(undefined);
    setDate(dayjs());
    setAmount(null);
    setDescription("");
    setFile(null);
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      let receiptFileId: string | null = null;
      if (file) {
        const up = await fileService.upload(file);
        receiptFileId = up.id;
      }
      return expenseService.submit({
        categoryId: categoryId as number,
        expenseDate: (date as dayjs.Dayjs).format("YYYY-MM-DD"),
        amount: amount as number,
        description: description.trim(),
        receiptFileId,
      });
    },
    onSuccess: () => {
      message.success("Claim submitted");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["expense-claims-me"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't submit the claim")),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => expenseService.cancel(id),
    onSuccess: () => {
      message.success("Claim cancelled");
      qc.invalidateQueries({ queryKey: ["expense-claims-me"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't cancel the claim")),
  });

  const onPickFile = (f: File | null) => {
    if (f && !RECEIPT_TYPES.includes(f.type)) {
      message.error("Receipt must be a PDF, PNG or JPG file.");
      return;
    }
    if (f && f.size > MAX_RECEIPT_BYTES) {
      message.error("Receipt must be smaller than 10 MB.");
      return;
    }
    setFile(f);
  };

  const needsReceipt = !!selected?.requiresReceipt;
  const valid =
    categoryId != null &&
    !!date &&
    amount != null &&
    amount > 0 &&
    description.trim().length > 0 &&
    (!needsReceipt || !!file);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="primary" onClick={() => setOpen(true)}>
          + New claim
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={claims.isLoading}
        dataSource={claims.data ?? []}
        locale={{
          emptyText: claims.isError
            ? errMsg(claims.error, "Couldn't load your claims")
            : "No claims yet",
        }}
        columns={[
          { title: "Date", dataIndex: "expenseDate", key: "d" },
          {
            title: "Category",
            key: "c",
            render: (_: unknown, r: ExpenseClaim) => catName(r.categoryId),
          },
          {
            title: "Amount",
            dataIndex: "amount",
            key: "a",
            render: (v: number) => money(v),
          },
          {
            title: "Description",
            dataIndex: "description",
            key: "x",
            ellipsis: true,
          },
          {
            title: "Receipt",
            key: "r",
            render: (_: unknown, r: ExpenseClaim) => <ReceiptLink claim={r} />,
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "s",
            render: (v: string, r: ExpenseClaim) => (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Tag color={statusColor[v]}>{v}</Tag>
                {r.status === "REJECTED" && r.reviewerRemarks && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {r.reviewerRemarks}
                  </Text>
                )}
                {r.status === "PAID" && r.paymentReference && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Ref: {r.paymentReference}
                  </Text>
                )}
              </div>
            ),
          },
          {
            title: "",
            key: "z",
            align: "right" as const,
            render: (_: unknown, r: ExpenseClaim) =>
              r.status === "SUBMITTED" ? (
                <Button
                  size="small"
                  danger
                  loading={cancelMut.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title: "Cancel this claim?",
                      onOk: () =>
                        cancelMut.mutateAsync(r.id).catch(() => undefined),
                    })
                  }
                >
                  Cancel
                </Button>
              ) : null,
          },
        ]}
      />

      <Modal
        open={open}
        title="New expense claim"
        okText="Submit claim"
        okButtonProps={{ disabled: !valid }}
        confirmLoading={submitMut.isPending}
        onCancel={() => {
          setOpen(false);
          reset();
        }}
        onOk={() => submitMut.mutate()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Select
            placeholder="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={(cats.data ?? []).map((c) => ({
              value: c.id,
              label: c.maxAmount
                ? `${c.name} (max ${money(c.maxAmount)})`
                : c.name,
            }))}
          />
          <DatePicker
            style={{ width: "100%" }}
            value={date}
            onChange={setDate}
            disabledDate={(d) =>
              d.isAfter(dayjs(), "day") ||
              d.isBefore(dayjs().subtract(365, "day"))
            }
          />
          <InputNumber
            style={{ width: "100%" }}
            min={0.01}
            max={selected?.maxAmount ?? 10000000}
            precision={2}
            placeholder="Amount (₹)"
            value={amount}
            onChange={setAmount}
          />
          <Input.TextArea
            rows={3}
            maxLength={1000}
            placeholder="What was the expense for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {needsReceipt
                  ? "Receipt required (PDF, PNG or JPG, up to 10 MB)."
                  : "Receipt optional for this category."}
              </Text>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Approvals ─────────────────────────────

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

function Approvals() {
  const qc = useQueryClient();
  const empName = useEmployeeName();
  const cats = useQuery({
    queryKey: ["expense-categories-all"],
    queryFn: expenseService.allCategories,
  });
  const catName = useCategoryName(cats.data);
  const [target, setTarget] = useState<ExpenseClaim | null>(null);
  const [remarks, setRemarks] = useState("");

  const pending = useQuery({
    queryKey: ["expense-pending"],
    queryFn: expenseService.pending,
  });

  const decideMut = useMutation({
    mutationFn: (v: {
      id: number;
      status: "APPROVED" | "REJECTED";
      remarks?: string;
    }) => expenseService.decide(v.id, { status: v.status, remarks: v.remarks }),
    onSuccess: () => {
      message.success("Decision recorded");
      setTarget(null);
      setRemarks("");
      qc.invalidateQueries({ queryKey: ["expense-pending"] });
      qc.invalidateQueries({ queryKey: ["expense-payable"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't record the decision")),
  });

  return (
    <>
      <Table
        size="small"
        rowKey="id"
        loading={pending.isLoading}
        dataSource={pending.data ?? []}
        locale={{ emptyText: "No claims waiting for review" }}
        columns={[
          {
            title: "Employee",
            key: "e",
            render: (_: unknown, r: ExpenseClaim) => empName(r.employeeId),
          },
          { title: "Date", dataIndex: "expenseDate", key: "d" },
          {
            title: "Category",
            key: "c",
            render: (_: unknown, r: ExpenseClaim) => catName(r.categoryId),
          },
          {
            title: "Amount",
            dataIndex: "amount",
            key: "a",
            render: (v: number) => money(v),
          },
          {
            title: "Description",
            dataIndex: "description",
            key: "x",
            ellipsis: true,
          },
          {
            title: "Receipt",
            key: "r",
            render: (_: unknown, r: ExpenseClaim) => <ReceiptLink claim={r} />,
          },
          {
            title: "",
            key: "z",
            align: "right" as const,
            render: (_: unknown, r: ExpenseClaim) => (
              <Space>
                <Button
                  size="small"
                  type="primary"
                  loading={decideMut.isPending}
                  onClick={() =>
                    decideMut.mutate({ id: r.id, status: "APPROVED" })
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
        title="Reject claim"
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
            id: target.id,
            status: "REJECTED",
            remarks: remarks.trim(),
          })
        }
      >
        <Text type="secondary">
          {target
            ? `${empName(target.employeeId)} — ${money(target.amount)}`
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

// ───────────────────────────── Payouts (HR) ─────────────────────────────

function Payouts() {
  const qc = useQueryClient();
  const empName = useEmployeeName();
  const cats = useQuery({
    queryKey: ["expense-categories-all"],
    queryFn: expenseService.allCategories,
  });
  const catName = useCategoryName(cats.data);
  const [target, setTarget] = useState<ExpenseClaim | null>(null);
  const [reference, setReference] = useState("");

  const payable = useQuery({
    queryKey: ["expense-payable"],
    queryFn: expenseService.payable,
  });

  const payMut = useMutation({
    mutationFn: (v: { id: number; reference?: string }) =>
      expenseService.markPaid(v.id, v.reference),
    onSuccess: () => {
      message.success("Marked as paid");
      setTarget(null);
      setReference("");
      qc.invalidateQueries({ queryKey: ["expense-payable"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't mark the claim as paid")),
  });

  return (
    <>
      <Table
        size="small"
        rowKey="id"
        loading={payable.isLoading}
        dataSource={payable.data ?? []}
        locale={{ emptyText: "No approved claims waiting for payment" }}
        columns={[
          {
            title: "Employee",
            key: "e",
            render: (_: unknown, r: ExpenseClaim) => empName(r.employeeId),
          },
          { title: "Date", dataIndex: "expenseDate", key: "d" },
          {
            title: "Category",
            key: "c",
            render: (_: unknown, r: ExpenseClaim) => catName(r.categoryId),
          },
          {
            title: "Amount",
            dataIndex: "amount",
            key: "a",
            render: (v: number) => money(v),
          },
          {
            title: "Receipt",
            key: "r",
            render: (_: unknown, r: ExpenseClaim) => <ReceiptLink claim={r} />,
          },
          {
            title: "",
            key: "z",
            align: "right" as const,
            render: (_: unknown, r: ExpenseClaim) => (
              <Button size="small" type="primary" onClick={() => setTarget(r)}>
                Mark paid
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!target}
        title="Mark claim as paid"
        okText="Confirm paid"
        confirmLoading={payMut.isPending}
        onCancel={() => {
          setTarget(null);
          setReference("");
        }}
        onOk={() =>
          target &&
          payMut.mutate({
            id: target.id,
            reference: reference.trim() || undefined,
          })
        }
      >
        <Text type="secondary">
          {target
            ? `${empName(target.employeeId)} — ${money(target.amount)}`
            : ""}
        </Text>
        <Input
          style={{ marginTop: 12 }}
          maxLength={100}
          placeholder="Payment reference (UTR / transaction id, optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            This only records the payment. Transfer the money first.
          </Text>
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Categories ─────────────────────────────

function Categories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ExpenseCategory | "new" | null>(null);
  const [form, setForm] = useState<ExpenseCategoryBody>({
    name: "",
    maxAmount: null,
    requiresReceipt: true,
    isActive: true,
  });

  const cats = useQuery({
    queryKey: ["expense-categories-all"],
    queryFn: expenseService.allCategories,
  });

  const open = (c: ExpenseCategory | "new") => {
    setEditing(c);
    setForm(
      c === "new"
        ? { name: "", maxAmount: null, requiresReceipt: true, isActive: true }
        : {
            name: c.name,
            maxAmount: c.maxAmount ?? null,
            requiresReceipt: c.requiresReceipt,
            isActive: c.isActive,
          },
    );
  };

  const saveMut = useMutation({
    mutationFn: () =>
      editing && editing !== "new"
        ? expenseService.updateCategory(editing.id, form)
        : expenseService.createCategory(form),
    onSuccess: () => {
      message.success("Category saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["expense-categories-all"] });
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      qc.invalidateQueries({ queryKey: ["expense-categories-lookup"] });
    },
    onError: (e) => message.error(errMsg(e, "Couldn't save the category")),
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="primary" onClick={() => open("new")}>
          + New category
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={cats.isLoading}
        dataSource={cats.data ?? []}
        columns={[
          { title: "Name", dataIndex: "name", key: "n" },
          {
            title: "Max per claim",
            dataIndex: "maxAmount",
            key: "m",
            render: (v?: number | null) => (v ? money(v) : "No limit"),
          },
          {
            title: "Receipt",
            dataIndex: "requiresReceipt",
            key: "r",
            render: (v: boolean) => (v ? "Required" : "Optional"),
          },
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
            render: (_: unknown, r: ExpenseCategory) => (
              <Button size="small" onClick={() => open(r)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!editing}
        title={editing === "new" ? "New category" : "Edit category"}
        okText="Save"
        okButtonProps={{ disabled: !form.name.trim() }}
        confirmLoading={saveMut.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => saveMut.mutate()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder="Name (e.g. Travel, Meals, Internet)"
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <InputNumber
            style={{ width: "100%" }}
            min={0.01}
            precision={2}
            placeholder="Max amount per claim (₹, empty = no limit)"
            value={form.maxAmount ?? null}
            onChange={(v) => setForm({ ...form, maxAmount: v })}
          />
          <Space>
            <Switch
              checked={form.requiresReceipt !== false}
              onChange={(v) => setForm({ ...form, requiresReceipt: v })}
            />
            <Text>Receipt required</Text>
          </Space>
          <Space>
            <Switch
              checked={form.isActive !== false}
              onChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Text>Active</Text>
          </Space>
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Page ─────────────────────────────

export default function ExpensesPage() {
  const { isHr, isManager } = useRole();
  const canReview = isHr || isManager;

  const items = [
    { key: "mine", label: "My Claims", children: <MyClaims /> },
    ...(canReview
      ? [{ key: "approvals", label: "Approvals", children: <Approvals /> }]
      : []),
    ...(isHr
      ? [{ key: "payouts", label: "Payouts", children: <Payouts /> }]
      : []),
    ...(canReview
      ? [{ key: "categories", label: "Categories", children: <Categories /> }]
      : []),
  ];

  return (
    <ConfigProvider theme={theme}>
      <div className="space-y-4 p-6">
        <Title level={3} style={{ margin: 0 }}>
          Expense Claims
        </Title>
        <Tabs items={items} />
      </div>
    </ConfigProvider>
  );
}
