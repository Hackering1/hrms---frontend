import { useQuery } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Space,
  Spin,
  Empty,
} from "antd";
import { CalendarOutlined, StarOutlined } from "@ant-design/icons";
import ResourcePage from "../../components/ResourcePage";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import type { ResourceConfig, ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const config: ResourceConfig = {
  title: "Holidays",
  endpoint: "/holidays",
  queryKey: "holidays",
  columns: [
    { key: "name", label: "Name" },
    { key: "holidayDate", label: "Date" },
    { key: "type", label: "Type" },
  ],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "holidayDate", label: "Date", type: "date", required: true },
    { name: "type", label: "Type (PUBLIC / RESTRICTED)", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};

export default function HolidaysPage() {
  const { isSuperAdmin } = useRole();
  // Super admin keeps full CRUD; everyone else gets the read-only split view.
  if (isSuperAdmin) return <ResourcePage config={config} />;
  return <HolidaysView />;
}

function DateTile({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const valid = !isNaN(d.getTime());
  const day = valid ? d.getDate() : "\u2014";
  const month = valid
    ? d.toLocaleDateString(undefined, { month: "short" })
    : "";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 12,
        background: "#f0fdfa",
        color: "#0d9488",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
        {day}
      </span>
      <span
        style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase" }}
      >
        {month}
      </span>
    </div>
  );
}

function HolidayCard({
  rows,
  title,
  icon,
  color,
  tagColor,
}: {
  rows: ResourceRecord[];
  title: string;
  icon: React.ReactNode;
  color: string;
  tagColor: string;
}) {
  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <Text strong>
          {title} ({rows.length})
        </Text>
      </Space>
      {rows.length === 0 ? (
        <Card>
          <Text type="secondary">None listed.</Text>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((h) => (
            <Card key={h.id as string} styles={{ body: { padding: 16 } }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <DateTile dateStr={h.holidayDate as string} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Space>
                    <Text strong>{h.name as string}</Text>
                    <Tag color={tagColor}>{(h.type as string) ?? "\u2014"}</Tag>
                  </Space>
                  {h.description ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginTop: 2,
                      }}
                    >
                      {h.description as string}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    {new Date(h.holidayDate as string).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HolidaysView() {
  const holidays = useQuery({
    queryKey: ["holidays"],
    queryFn: () => resourceService.list("/holidays"),
  });

  if (holidays.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const all = (holidays.data ?? []) as ResourceRecord[];
  const sorted = [...all].sort((a, b) =>
    String(a.holidayDate) < String(b.holidayDate) ? -1 : 1,
  );
  const national = sorted.filter(
    (h) => String(h.type).toUpperCase() === "PUBLIC",
  );
  const festivals = sorted.filter(
    (h) => String(h.type).toUpperCase() !== "PUBLIC",
  );

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Holidays
          </Title>
          <Text type="secondary">{all.length} holidays this year</Text>
        </div>
        {all.length === 0 ? (
          <Card>
            <Empty
              description="No holidays listed."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <HolidayCard
                rows={national}
                title="National Holidays"
                icon={<CalendarOutlined />}
                color="#0d9488"
                tagColor="cyan"
              />
            </Col>
            <Col xs={24} lg={12}>
              <HolidayCard
                rows={festivals}
                title="Festivals / Optional"
                icon={<StarOutlined />}
                color="#d97706"
                tagColor="orange"
              />
            </Col>
          </Row>
        )}
      </div>
    </ConfigProvider>
  );
}
