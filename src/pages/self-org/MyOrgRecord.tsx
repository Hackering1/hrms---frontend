import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Spin, Typography } from "antd";
import { selfService } from "../../services/selfService";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

interface FieldRow {
  key: string;
  label: string;
  // optional formatter for the value
  format?: (v: any) => string;
}

/**
 * Reusable read-only "my own record" viewer.
 * Reads the logged-in employee's profile, finds which org record applies to
 * them (by `idField` on their profile, e.g. branchId), fetches that record from
 * `endpoint`, and shows the chosen fields. No edit / delete — view only.
 *
 * Pass `hideHeader` when embedding inside a page that already shows a title
 * (e.g. the tabbed My Organization page).
 */
export default function MyOrgRecord({
  title,
  subtitle,
  endpoint,
  queryKey,
  idField,
  fields,
  emptyText,
  hideHeader = false,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  queryKey: string;
  idField: string;
  fields: FieldRow[];
  emptyText: string;
  hideHeader?: boolean;
}) {
  const me = useQuery({ queryKey: ["me"], queryFn: selfService.me });

  const records = useQuery({
    queryKey: [queryKey],
    queryFn: () => resourceService.list(endpoint),
    enabled: !!me.data,
  });

  if (me.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  if (me.isError) {
    return (
      <Wrapper title={title} subtitle={subtitle} hideHeader={hideHeader}>
        <Card>
          <Text type="secondary">
            Your employee profile isn't linked yet, so this can't be shown.
            Please contact HR.
          </Text>
        </Card>
      </Wrapper>
    );
  }

  const myId = (me.data as ResourceRecord)?.[idField];

  if (myId === undefined || myId === null) {
    return (
      <Wrapper title={title} subtitle={subtitle} hideHeader={hideHeader}>
        <Card>
          <Text type="secondary">{emptyText}</Text>
        </Card>
      </Wrapper>
    );
  }

  if (records.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const record = (records.data ?? []).find(
    (r: ResourceRecord) => String(r.id) === String(myId),
  );

  return (
    <Wrapper title={title} subtitle={subtitle} hideHeader={hideHeader}>
      {!record ? (
        <Card>
          <Text type="secondary">{emptyText}</Text>
        </Card>
      ) : (
        <Card>
          <Descriptions column={1} size="middle" bordered>
            {fields.map((f) => {
              const raw = (record as ResourceRecord)[f.key];
              const value =
                raw === undefined || raw === null || raw === ""
                  ? "\u2014"
                  : f.format
                    ? f.format(raw)
                    : String(raw);
              return (
                <Descriptions.Item key={f.key} label={f.label}>
                  {value}
                </Descriptions.Item>
              );
            })}
          </Descriptions>
        </Card>
      )}
    </Wrapper>
  );
}

function Wrapper({
  title,
  subtitle,
  hideHeader,
  children,
}: {
  title: string;
  subtitle: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  if (hideHeader) {
    return <div style={{ maxWidth: 640 }}>{children}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>
      <div style={{ maxWidth: 640 }}>{children}</div>
    </div>
  );
}

const yesNo = (v: any) => (v ? "Yes" : "No");
export { yesNo };
