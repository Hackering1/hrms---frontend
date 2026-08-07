import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Select as AntSelect,
  DatePicker,
  Table,
  Card,
  Row,
  Col,
  Modal as AntModal,
  Popconfirm,
} from "antd";
import {
  EyeOutlined,
  FileTextOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { letterService } from "../../services/letterService";
import { resourceService } from "../../services/resourceService";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export default function GeneratedLettersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isHr, isManager } = useRole();
  const managerScoped = isManager && !isSuperAdmin && !isHr;
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [letterDate, setLetterDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [previewText, setPreviewText] = useState<string | null>(null);

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

  const pickerPeople = managerScoped
    ? [
        ...(me.data ? [me.data as ResourceRecord] : []),
        ...((team.data ?? []) as ResourceRecord[]),
      ]
    : ((employees.data ?? []) as ResourceRecord[]);
  const templates = useQuery({
    queryKey: ["letterTemplates"],
    queryFn: () => resourceService.list("/letter-templates"),
  });
  const letters = useQuery({
    queryKey: ["generatedLetters", employeeId],
    queryFn: () => letterService.byEmployee(employeeId),
    enabled: !!employeeId,
  });

  const previewMut = useMutation({
    mutationFn: () => letterService.preview(Number(templateId), employeeId),
    onSuccess: (data) => setPreviewText(data.content),
    onError: (e: any) => alert(e?.response?.data?.message ?? "Preview failed"),
  });

  const generateMut = useMutation({
    mutationFn: () =>
      letterService.generate(employeeId, Number(templateId), letterDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generatedLetters", employeeId] });
      setPreviewText(null);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => letterService.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["generatedLetters", employeeId] }),
  });

  const canPreview = !!employeeId && templateId !== "";
  const rows = letters.data ?? [];

  const columns = [
    { title: "Type", dataIndex: "letterType", key: "letterType" },
    { title: "Date", dataIndex: "letterDate", key: "letterDate" },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, l: any) => (
        <Popconfirm
          title="Delete this letter?"
          onConfirm={() => delMut.mutate(l.id)}
        >
          <AntButton size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          Generated Letters
        </Title>

        <Card>
          <Row gutter={[12, 12]} align="bottom">
            <Col xs={24} md={6}>
              <Field label="Employee">
                <AntSelect
                  style={{ width: "100%" }}
                  value={employeeId || undefined}
                  onChange={(v) => setEmployeeId(v)}
                  placeholder="— Select —"
                  options={pickerPeople.map((e: ResourceRecord) => ({
                    value: e.id,
                    label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
                  }))}
                />
              </Field>
            </Col>
            <Col xs={24} md={6}>
              <Field label="Template">
                <AntSelect
                  style={{ width: "100%" }}
                  value={templateId || undefined}
                  onChange={(v) => setTemplateId(v ?? "")}
                  placeholder="— Select —"
                  options={(templates.data ?? []).map((t: ResourceRecord) => ({
                    value: t.id,
                    label: `${t.name} (${t.letterType})`,
                  }))}
                />
              </Field>
            </Col>
            <Col xs={24} md={6}>
              <Field label="Letter Date">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: "100%" }}
                  value={dayjs(letterDate)}
                  onChange={(d) =>
                    setLetterDate(d ? d.format("YYYY-MM-DD") : letterDate)
                  }
                />
              </Field>
            </Col>
            <Col xs={24} md={6}>
              <div style={{ display: "flex", gap: 8 }}>
                <AntButton
                  icon={<EyeOutlined />}
                  loading={previewMut.isPending}
                  disabled={!canPreview}
                  onClick={() => previewMut.mutate()}
                >
                  Preview
                </AntButton>
                <AntButton
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={generateMut.isPending}
                  disabled={!canPreview}
                  onClick={() => generateMut.mutate()}
                >
                  Generate
                </AntButton>
              </div>
            </Col>
          </Row>
        </Card>

        <AntModal
          open={previewText !== null}
          title="Letter Preview"
          onCancel={() => setPreviewText(null)}
          width={640}
          footer={[
            <AntButton key="close" onClick={() => setPreviewText(null)}>
              Close
            </AntButton>,
            <AntButton
              key="generate"
              type="primary"
              icon={<FileTextOutlined />}
              loading={generateMut.isPending}
              onClick={() => generateMut.mutate()}
            >
              Generate This Letter
            </AntButton>,
          ]}
        >
          <pre
            style={{
              maxHeight: 384,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              background: "#f8fafc",
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
            }}
          >
            {previewText}
          </pre>
        </AntModal>

        <Table
          loading={letters.isLoading}
          rowKey={(l: any) => l.id}
          columns={columns}
          dataSource={rows}
          locale={{
            emptyText: !employeeId
              ? "Select an employee to see their letters."
              : "No letters generated yet.",
          }}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </ConfigProvider>
  );
}

function Field({
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
