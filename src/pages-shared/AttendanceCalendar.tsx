import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Spin,
  Button as AntButton,
} from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { attendanceService } from "../services/attendanceService";
import { resourceService } from "../services/resourceService";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

/**
 * Monthly attendance calendar with colour-coded cells for one employee.
 * Legend: present, absent, half-day, holiday, weekend, no-record.
 * A regularized day shows as Present with a small "Reg" badge.
 */
export default function AttendanceCalendar({
  employeeId,
}: {
  employeeId?: string;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() }; // month 0-11
  });

  const history = useQuery({
    queryKey: ["attendance", employeeId],
    queryFn: () => attendanceService.history(employeeId!),
    enabled: !!employeeId,
  });
  const holidays = useQuery({
    queryKey: ["holidays"],
    queryFn: () => resourceService.list("/holidays"),
  });

  const attByDate = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of (history.data ?? []) as any[]) {
      m.set(a.attendanceDate, a);
    }
    return m;
  }, [history.data]);

  const holidayByDate = useMemo(() => {
    const m = new Map<string, any>();
    for (const h of (holidays.data ?? []) as any[]) {
      m.set(h.holidayDate, h);
    }
    return m;
  }, [holidays.data]);

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 Sun .. 6 Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () =>
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { ...c, month: c.month - 1 },
    );
  const nextMonth = () =>
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { ...c, month: c.month + 1 },
    );

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateKey = (d: number) => year + "-" + pad(month + 1) + "-" + pad(d);

  type CellKind =
    | "present"
    | "absent"
    | "half"
    | "leave"
    | "holiday"
    | "weekend"
    | "none";

  const kindFor = (
    d: number,
  ): { kind: CellKind; label: string; regularized: boolean } => {
    const key = dateKey(d);
    const weekday = new Date(year, month, d).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const holiday = holidayByDate.get(key);
    const att = attByDate.get(key);

    if (att) {
      const s = String(att.status).toUpperCase();
      const regularized = !!att.isRegularized;
      if (s === "PRESENT")
        return { kind: "present", label: "Present", regularized };
      if (s === "ABSENT")
        return { kind: "absent", label: "Absent", regularized };
      if (s === "HALF_DAY")
        return { kind: "half", label: "Half day", regularized };
      if (s === "LEAVE") return { kind: "leave", label: "Leave", regularized };
      return { kind: "present", label: att.status, regularized };
    }
    if (holiday)
      return { kind: "holiday", label: holiday.name, regularized: false };
    if (isWeekend)
      return { kind: "weekend", label: "Weekend", regularized: false };
    return { kind: "none", label: "", regularized: false };
  };

  const CELL_STYLES: Record<
    CellKind,
    { bg: string; fg: string; border: string }
  > = {
    present: { bg: "#dcfce7", fg: "#166534", border: "#bbf7d0" },
    absent: { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
    half: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    leave: { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
    holiday: { bg: "#e0e7ff", fg: "#3730a3", border: "#c7d2fe" },
    weekend: { bg: "#f1f5f9", fg: "#94a3b8", border: "#e2e8f0" },
    none: { bg: "#ffffff", fg: "#334155", border: "#e2e8f0" },
  };

  // Build the grid cells (leading blanks + days).
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  const todayKey = (() => {
    const n = new Date();
    return (
      n.getFullYear() + "-" + pad(n.getMonth() + 1) + "-" + pad(n.getDate())
    );
  })();

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const logColumns = [
    { title: "Date", dataIndex: "attendanceDate", key: "attendanceDate" },
    {
      title: "Check In",
      key: "checkInTime",
      render: (_: any, a: any) =>
        a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : "\u2014",
    },
    {
      title: "Check Out",
      key: "checkOutTime",
      render: (_: any, a: any) =>
        a.checkOutTime
          ? new Date(a.checkOutTime).toLocaleTimeString()
          : "\u2014",
    },
    {
      title: "Status",
      key: "status",
      render: (_: any, a: any) => (
        <Space size={4}>
          <Tag
            color={
              a.status === "PRESENT"
                ? "success"
                : a.status === "ABSENT"
                  ? "error"
                  : a.status === "LEAVE"
                    ? "blue"
                    : "default"
            }
          >
            {a.status}
          </Tag>
          {a.isRegularized && <Tag color="green">Regularized</Tag>}
        </Space>
      ),
    },
  ];

  const monthLog = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .map((d) => attByDate.get(dateKey(d)))
    .filter(Boolean);

  if (!employeeId) {
    return (
      <ConfigProvider theme={theme}>
        <Card>
          <Text type="secondary">No employee selected.</Text>
        </Card>
      </ConfigProvider>
    );
  }
  if (history.isLoading || holidays.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <AntButton
              type="text"
              icon={<LeftOutlined />}
              onClick={prevMonth}
            />
            <Title level={5} style={{ margin: 0 }}>
              {monthLabel}
            </Title>
            <AntButton
              type="text"
              icon={<RightOutlined />}
              onClick={nextMonth}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  paddingBottom: 4,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#94a3b8",
                }}
              >
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={"b" + i} />;
              const { kind, label, regularized } = kindFor(cell.day);
              const key = dateKey(cell.day);
              const isToday = key === todayKey;
              const style = CELL_STYLES[kind];
              return (
                <div
                  key={key}
                  title={regularized ? label + " (Regularized)" : label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    border: "1px solid " + style.border,
                    background: style.bg,
                    color: style.fg,
                    fontSize: 14,
                    outline: isToday ? "2px solid #0d9488" : "none",
                    outlineOffset: isToday ? 1 : 0,
                    position: "relative",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{cell.day}</span>
                  {label && kind !== "none" && (
                    <span
                      style={{
                        marginTop: 2,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        padding: "0 4px",
                        fontSize: 9,
                        lineHeight: 1.1,
                      }}
                    >
                      {label}
                    </span>
                  )}
                  {regularized && (
                    <span
                      style={{
                        marginTop: 2,
                        fontSize: 8,
                        fontWeight: 700,
                        color: "#15803d",
                        background: "#bbf7d0",
                        borderRadius: 4,
                        padding: "0 4px",
                      }}
                    >
                      REG
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <Legend swatch="#bbf7d0" label="Present" />
            <Legend swatch="#fecaca" label="Absent" />
            <Legend swatch="#fde68a" label="Half day" />
            <Legend swatch="#bfdbfe" label="Leave" />
            <Legend swatch="#c7d2fe" label="Holiday" />
            <Legend swatch="#e2e8f0" label="Weekend" />
            <Legend swatch="#22c55e" label="Regularized (REG badge)" />
          </div>
        </Card>

        {/* Daily log for the visible month */}
        <div>
          <Title level={5}>
            {"Daily Log \u2014 "}
            {monthLabel}
          </Title>
          <Table
            rowKey={(a: any) => a.id}
            columns={logColumns}
            dataSource={monthLog}
            locale={{ emptyText: "No records this month." }}
            pagination={false}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          height: 12,
          width: 12,
          borderRadius: 3,
          background: swatch,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
