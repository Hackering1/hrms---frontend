import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Card,
  Row,
  Col,
  Tag,
  Space,
  Segmented,
  Spin,
  Empty,
  Modal as AntModal,
} from "antd";
import { ReloadOutlined, PlusOutlined, TagOutlined } from "@ant-design/icons";
import { ticketService } from "../../services/ticketService";
import type { Ticket } from "../../services/ticketService";
import { useAuthStore } from "../../store/authStore";
import { useRole } from "../../hooks/useRole";

const { Title, Text } = Typography;
const { TextArea } = AntInput;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "CLOSED"] as const;
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  CLOSED: "Closed",
};
const STATUS_TAG: Record<string, string> = {
  OPEN: "blue",
  IN_PROGRESS: "purple",
  ON_HOLD: "orange",
  CLOSED: "green",
};
const PRIORITY_TAG: Record<string, string> = {
  LOW: "default",
  MEDIUM: "orange",
  HIGH: "red",
};

export default function TicketsPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useRole();
  const userId = useAuthStore((s) => s.userId);
  const email = useAuthStore((s) => s.email);

  const [filter, setFilter] = useState<"ALL" | (typeof STATUSES)[number]>(
    "ALL",
  );
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const tickets = useQuery({
    queryKey: ["tickets"],
    queryFn: ticketService.list,
  });

  const raise = useMutation({
    mutationFn: () => {
      if (!userId) {
        return Promise.reject(new Error("Not signed in"));
      }
      return ticketService.raise({
        subject,
        description,
        priority,
        raisedById: userId,
        raisedByEmail: email ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Ticket raised");
      setFormOpen(false);
      setSubject("");
      setDescription("");
      setPriority("MEDIUM");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not raise ticket"),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ticketService.updateStatus(id, status, userId ?? ""),
    onSuccess: () => {
      toast.success("Ticket updated");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Could not update ticket"),
  });

  const all = tickets.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      CLOSED: 0,
    };
    for (const t of all) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [all]);

  const visible =
    filter === "ALL" ? all : all.filter((t) => t.status === filter);

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Support Tickets
            </Title>
            <Text type="secondary">
              {isSuperAdmin
                ? "Track and resolve support requests"
                : "Raise a request and track its status"}
            </Text>
          </div>
          <Space>
            <AntButton
              icon={<ReloadOutlined />}
              onClick={() => qc.invalidateQueries({ queryKey: ["tickets"] })}
            >
              Refresh
            </AntButton>
            {/* Only managers / employees raise; super admin resolves. */}
            {!isSuperAdmin && (
              <AntButton
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setFormOpen(true)}
              >
                Raise Ticket
              </AntButton>
            )}
          </Space>
        </div>

        {/* Stat cards */}
        <Row gutter={[12, 12]}>
          {STATUSES.map((s) => (
            <Col xs={12} lg={6} key={s}>
              <Card>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {STATUS_LABEL[s]}
                </Text>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                  {counts[s] ?? 0}
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Filter tabs */}
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as any)}
          options={[
            { value: "ALL", label: "All" },
            ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          ]}
        />

        {/* Ticket list */}
        {tickets.isLoading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spin />
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                filter === "ALL"
                  ? "No tickets have been raised yet."
                  : "No " + STATUS_LABEL[filter].toLowerCase() + " tickets."
              }
            />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                canResolve={isSuperAdmin}
                onSetStatus={(status) => setStatus.mutate({ id: t.id, status })}
              />
            ))}
          </div>
        )}

        {/* Raise ticket modal */}
        <AntModal
          open={formOpen}
          title="Raise a New Ticket"
          onCancel={() => setFormOpen(false)}
          footer={[
            <AntButton key="cancel" onClick={() => setFormOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              loading={raise.isPending}
              disabled={!subject.trim() || !description.trim()}
              onClick={() => raise.mutate()}
            >
              Submit Ticket
            </AntButton>,
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row gutter={12}>
              <Col span={16}>
                <AntInput
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Col>
              <Col span={8}>
                <AntSelect
                  style={{ width: "100%" }}
                  value={priority}
                  onChange={(v) => setPriority(v)}
                  options={[
                    { value: "LOW", label: "Low" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "HIGH", label: "High" },
                  ]}
                />
              </Col>
            </Row>
            <TextArea
              rows={4}
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}

function TicketCard({
  ticket,
  canResolve,
  onSetStatus,
}: {
  ticket: Ticket;
  canResolve: boolean;
  onSetStatus: (status: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Space>
            <Text strong style={{ fontSize: 15 }}>
              {ticket.subject}
            </Text>
            <Tag>
              <TagOutlined /> #{ticket.id}
            </Tag>
          </Space>
          <p
            style={{
              marginTop: 6,
              whiteSpace: "pre-line",
              color: "#475569",
              fontSize: 14,
            }}
          >
            {ticket.description}
          </p>
          <Space wrap style={{ marginTop: 8 }}>
            <Tag color={STATUS_TAG[ticket.status] ?? "default"}>
              {STATUS_LABEL[ticket.status]}
            </Tag>
            <Tag color={PRIORITY_TAG[ticket.priority] ?? "default"}>
              Priority:{" "}
              {ticket.priority.charAt(0) +
                ticket.priority.slice(1).toLowerCase()}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Raised by {ticket.raisedByEmail ?? "user"} {"\u00B7"}{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </Text>
          </Space>
        </div>

        {canResolve && (
          <div style={{ flexShrink: 0 }}>
            {!managing ? (
              <AntButton onClick={() => setManaging(true)}>Manage</AntButton>
            ) : (
              <Space direction="vertical">
                <AntSelect
                  style={{ width: 150 }}
                  value={ticket.status}
                  onChange={(v) => onSetStatus(v)}
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  }))}
                />
                <AntButton type="text" onClick={() => setManaging(false)}>
                  Done
                </AntButton>
              </Space>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
