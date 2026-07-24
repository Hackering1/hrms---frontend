import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Card,
  List,
  Tag,
  Badge,
  Space,
  Spin,
  Empty,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { notificationService } from "../../services/notificationService";
import { useAuthStore } from "../../store/authStore";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return d.toLocaleDateString();
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);

  const notifications = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => notificationService.getMyNotifications(),
    enabled: !!userId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
    qc.invalidateQueries({ queryKey: ["notifications-unread", userId] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: number) => notificationService.deleteNotification(id),
    onSuccess: invalidate,
  });

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => !n.isRead).length;

  if (!userId) {
    return (
      <ConfigProvider theme={theme}>
        <Card>
          <Text type="secondary">
            Could not determine the current user. Please log out and log in
            again to refresh your session.
          </Text>
        </Card>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Space>
            <BellOutlined style={{ color: "#0d9488", fontSize: 20 }} />
            <Title level={2} style={{ margin: 0 }}>
              Notifications
            </Title>
            {unread > 0 && <Badge count={unread + " new"} color="#0d9488" />}
          </Space>
          <AntButton
            icon={<CheckCircleOutlined />}
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
          >
            Mark all read
          </AntButton>
        </div>

        <Card styles={{ body: { padding: 0 } }}>
          {notifications.isLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Spin />
            </div>
          ) : notifications.isError ? (
            <div style={{ padding: 20 }}>
              <Text type="danger">Failed to load notifications.</Text>
            </div>
          ) : rows.length === 0 ? (
            <Empty
              description="You have no notifications."
              style={{ padding: 40 }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={rows}
              renderItem={(n: any) => (
                <List.Item
                  style={{
                    padding: "12px 16px",
                    background: n.isRead ? undefined : "rgba(13,148,136,0.06)",
                    alignItems: "flex-start",
                  }}
                  actions={[
                    ...(!n.isRead
                      ? [
                          <AntButton
                            key="read"
                            type="text"
                            size="small"
                            title="Mark read"
                            icon={<CheckOutlined />}
                            onClick={() => markRead.mutate(n.id)}
                          />,
                        ]
                      : []),
                    <AntButton
                      key="del"
                      type="text"
                      size="small"
                      danger
                      title="Delete"
                      icon={<DeleteOutlined />}
                      onClick={() => del.mutate(n.id)}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge
                        dot={!n.isRead}
                        color="#0d9488"
                        style={{ marginTop: 8 }}
                      />
                    }
                    title={
                      <Space>
                        <Text strong>{n.title}</Text>
                        {n.module && <Tag>{n.module}</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ color: "#475569" }}>{n.message}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {timeAgo(n.createdAt)}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    </ConfigProvider>
  );
}
