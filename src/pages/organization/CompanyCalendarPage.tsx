import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Card,
  Calendar,
  Table,
  Tag,
  Space,
  Badge,
} from "antd";
import { UploadOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

interface Holiday {
  id: number;
  name: string;
  holidayDate: string; // yyyy-mm-dd
  type: string;
  description?: string;
}

export default function CompanyCalendarPage() {
  const qc = useQueryClient();
  const { isHr, isSuperAdmin } = useRole();
  const canManage = isHr || isSuperAdmin;

  const [panelDate, setPanelDate] = useState<Dayjs>(dayjs());
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const holidays = useQuery({
    queryKey: ["holidays"],
    queryFn: () => resourceService.list("/holidays") as Promise<Holiday[]>,
  });

  const holidayMap = useMemo(() => {
    const m: Record<string, Holiday> = {};
    (holidays.data ?? []).forEach((h) => {
      m[h.holidayDate] = h;
    });
    return m;
  }, [holidays.data]);

  const importMut = useMutation({
    mutationFn: async (
      rows: {
        holidayDate: string;
        name: string;
        type: string;
        description: string;
      }[],
    ) => {
      let ok = 0;
      let failed = 0;
      for (const r of rows) {
        try {
          await resourceService.create(
            "/holidays",
            r as unknown as ResourceRecord,
          );
          ok++;
        } catch {
          failed++; // duplicates (unique date) or bad rows are skipped
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      toast.success(
        `Imported ${ok} holiday(s)${failed ? `, skipped ${failed}` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: () => toast.error("Import failed"),
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const start = /date/i.test(lines[0]) && /name/i.test(lines[0]) ? 1 : 0;
      const rows = lines
        .slice(start)
        .map((line) => {
          const [date, name, type, description] = line
            .split(",")
            .map((s) => (s ?? "").trim());
          return {
            holidayDate: date,
            name: name || "Holiday",
            type: type || "PUBLIC",
            description: description || "",
          };
        })
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.holidayDate));
      if (rows.length === 0) {
        toast.error("No valid rows found. Use: date,name,type,description");
      } else {
        importMut.mutate(rows);
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const monthHolidays = (holidays.data ?? []).filter((h) => {
    const d = new Date(h.holidayDate);
    return (
      d.getFullYear() === panelDate.year() && d.getMonth() === panelDate.month()
    );
  });

  const cellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const holiday = holidayMap[dateStr];
    const isWeekend = value.day() === 0 || value.day() === 6;
    if (holiday) {
      return (
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.2,
            color: "#be123c",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {holiday.name}
        </div>
      );
    }
    if (isWeekend) {
      return <div style={{ fontSize: 10, color: "#94a3b8" }}>Weekend</div>;
    }
    return null;
  };

  const holidayColumns = [
    { title: "Date", dataIndex: "holidayDate", key: "holidayDate" },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Type",
      key: "type",
      render: (_: any, h: any) => <Tag>{h.type}</Tag>,
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Space>
          <CalendarOutlined style={{ color: "#0d9488", fontSize: 20 }} />
          <Title level={2} style={{ margin: 0 }}>
            Company Calendar
          </Title>
        </Space>

        {canManage && (
          <Card>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  Upload Company Calendar
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    CSV format: <code>date,name,type,description</code> — e.g.{" "}
                    <code>2026-01-26,Republic Day,PUBLIC,National holiday</code>
                  </Text>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={onFile}
              />
              <AntButton
                icon={<UploadOutlined />}
                loading={importing || importMut.isPending}
                onClick={() => fileRef.current?.click()}
              >
                Upload CSV
              </AntButton>
            </div>
          </Card>
        )}

        <Card>
          <Calendar
            fullscreen={false}
            value={panelDate}
            onPanelChange={(d) => setPanelDate(d)}
            onSelect={(d) => setPanelDate(d)}
            cellRender={cellRender}
          />
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              fontSize: 12,
              color: "#475569",
            }}
          >
            <Space size={6}>
              <Badge color="white" style={{ border: "1px solid #cbd5e1" }} />
              Working day
            </Space>
            <Space size={6}>
              <Badge color="#f1f5f9" />
              Weekend
            </Space>
            <Space size={6}>
              <Badge color="#fecdd3" />
              Holiday
            </Space>
          </div>
        </Card>

        <div>
          <Title level={5}>Holidays in {panelDate.format("MMMM YYYY")}</Title>
          <Table
            rowKey={(h: any) => h.id}
            columns={holidayColumns}
            dataSource={monthHolidays}
            locale={{ emptyText: "No holidays this month." }}
            pagination={false}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
