import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Table,
  Space,
  DatePicker,
} from "antd";
import {
  FileTextOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { letterService } from "../../services/letterService";
import { resourceService } from "../../services/resourceService";
import FileUpload from "../../components/ui/FileUpload";
import dayjs from "dayjs";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#00a8f0",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

type SalaryKey =
  | "basicM"
  | "basicA"
  | "hraM"
  | "hraA"
  | "ltaM"
  | "ltaA"
  | "specialM"
  | "specialA"
  | "grossM"
  | "grossA"
  | "pfEmployerM"
  | "pfEmployerA"
  | "pfAdminM"
  | "pfAdminA"
  | "gratuityM"
  | "gratuityA"
  | "employerCostM"
  | "employerCostA"
  | "ctcMonthlyTotal"
  | "ctcAnnualTotal"
  | "pfEmployeeM"
  | "pfEmployeeA"
  | "ptM"
  | "ptA"
  | "deductionsM"
  | "deductionsA"
  | "netM"
  | "netA";

const salaryRows: { label: string; m: SalaryKey; a: SalaryKey }[] = [
  { label: "Basic Salary", m: "basicM", a: "basicA" },
  { label: "HRA", m: "hraM", a: "hraA" },
  { label: "LTA", m: "ltaM", a: "ltaA" },
  { label: "Special Allowance", m: "specialM", a: "specialA" },
  { label: "Gross Salary (A)", m: "grossM", a: "grossA" },
  { label: "PF (Employer)", m: "pfEmployerM", a: "pfEmployerA" },
  { label: "PF- Admin Charges", m: "pfAdminM", a: "pfAdminA" },
  { label: "Gratuity", m: "gratuityM", a: "gratuityA" },
  { label: "Total Employer Cost", m: "employerCostM", a: "employerCostA" },
  { label: "Total CTC C=(A+B)", m: "ctcMonthlyTotal", a: "ctcAnnualTotal" },
  { label: "PF (Employee)", m: "pfEmployeeM", a: "pfEmployeeA" },
  { label: "Professional Tax", m: "ptM", a: "ptA" },
  { label: "Total Deductions (D)", m: "deductionsM", a: "deductionsA" },
  { label: "Net Take-Home (A-D)", m: "netM", a: "netA" },
];

// Indian-style number formatting (e.g. 312780 -> "3,12,780").
function inr(n: number): string {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

export default function FormattedLetterPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [letterType, setLetterType] = useState<
    "OFFER" | "APPOINTMENT" | "RELIEVING" | "EXPERIENCE"
  >("OFFER");

  const isServiceLetter =
    letterType === "RELIEVING" || letterType === "EXPERIENCE";
  const [meta, setMeta] = useState<Record<string, string>>({
    letterDate: dayjs().format("YYYY-MM-DD"),
    place: "Bangalore",
    dateOfJoining: "",
    employmentEndDate: "",
    designation: "",
    workLocation: "Bangalore",
    // NEW — employment type shown in Offer/Appointment letters. Defaults to
    // full-time; contract duration only applies (and is required) when
    // employmentType === "CONTRACT".
    employmentType: "FULL_TIME",
    contractDuration: "",
    contractDurationUnit: "MONTHS",
    ctcAnnual: "",
    ctcInWords: "",
    signatoryName: "Mohammad Noor",
    signatoryTitle: "HR Director",
    signatureFileId: "",
  });
  const [salary, setSalary] = useState<Record<string, string>>({});

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });

  const selectedEmp = (employees.data ?? []).find(
    (e: ResourceRecord) => String(e.id) === employeeId,
  );
  const employeeName = selectedEmp
    ? `${selectedEmp.firstName ?? ""} ${selectedEmp.lastName ?? ""}`.trim()
    : "";

  const setMetaField = (k: string, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));
  const setSalaryField = (k: string, v: string) =>
    setSalary((s) => ({ ...s, [k]: v }));

  /**
   * Auto-fill the entire salary structure from the Annual CTC, using TechNext's
   * standard breakup (matches the real letters exactly):
   *   Gross = CTC (simple structure), Basic = Gross / 1.5985 (~62.56%),
   *   HRA = 40% of Basic, LTA = 5% of Basic, Special = remainder,
   *   Professional Tax = ₹200/mo (₹2,400/yr), Net = Gross − PT.
   */
  const autoFillSalary = () => {
    const ctc = Number((meta.ctcAnnual || "").replace(/[^\d.]/g, ""));
    if (!ctc || ctc <= 0) {
      toast.error("Enter a valid Annual CTC first.");
      return;
    }
    const grossA = ctc;
    const basicA = Math.round(grossA / 1.5985);
    const hraA = Math.round(basicA * 0.4);
    const ltaA = Math.round(basicA * 0.05);
    const specialA = grossA - basicA - hraA - ltaA;
    const ptA = 2400;
    const netA = grossA - ptA;

    const m = (a: number) => inr(a / 12);
    setSalary({
      basicM: m(basicA),
      basicA: inr(basicA),
      hraM: m(hraA),
      hraA: inr(hraA),
      ltaM: m(ltaA),
      ltaA: inr(ltaA),
      specialM: m(specialA),
      specialA: inr(specialA),
      grossM: m(grossA),
      grossA: inr(grossA),
      ctcMonthlyTotal: m(grossA),
      ctcAnnualTotal: inr(grossA),
      ptM: inr(200),
      ptA: inr(ptA),
      deductionsM: inr(200),
      deductionsA: inr(ptA),
      netM: m(netA),
      netA: inr(netA),
    });
    toast.success("Salary structure auto-filled from CTC");
  };

  const gen = useMutation({
    mutationFn: async () => {
      const payload = {
        employeeId,
        employeeName,
        letterType,
        ...meta,
        // #11: letterDate is stored as ISO internally; the letter prints a
        // friendly "18 May 2026" style, so format it on the way out.
        letterDate: meta.letterDate
          ? dayjs(meta.letterDate).format("DD MMMM YYYY")
          : "",
        // Date of Joining and Employment End Date are also picked via calendar
        // (stored ISO) — format them to the same friendly style for the letter.
        dateOfJoining: meta.dateOfJoining
          ? dayjs(meta.dateOfJoining).format("DD MMMM YYYY")
          : "",
        employmentEndDate: meta.employmentEndDate
          ? dayjs(meta.employmentEndDate).format("DD MMMM YYYY")
          : "",
        designation: meta.designation || selectedEmp?.designationName || "",
        ...salary,
      };
      const blob = await letterService.generatePdf(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const typeLabel =
        letterType === "APPOINTMENT"
          ? "Appointment"
          : letterType === "RELIEVING"
            ? "Relieving"
            : letterType === "EXPERIENCE"
              ? "Experience_Relieving"
              : "Offer";
      a.download = `${typeLabel}_Letter_${employeeName.replace(/\s+/g, "_") || "Employee"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Letter PDF generated"),
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't generate letter"),
  });

  const contractDurationOk =
    meta.employmentType !== "CONTRACT" || !!meta.contractDuration;

  const canGenerate = isServiceLetter
    ? !!employeeId && !!meta.designation && !!meta.employmentEndDate
    : !!employeeId &&
      !!meta.designation &&
      !!meta.ctcAnnual &&
      contractDurationOk;

  const salaryColumns = [
    { title: "Component", dataIndex: "label", key: "label" },
    {
      title: "Monthly (₹)",
      key: "monthly",
      render: (_: any, r: any) => (
        <AntInput
          size="small"
          style={{ textAlign: "right", width: 120 }}
          value={salary[r.m] ?? ""}
          onChange={(e) => setSalaryField(r.m, e.target.value)}
        />
      ),
    },
    {
      title: "Annual (₹)",
      key: "annual",
      render: (_: any, r: any) => (
        <AntInput
          size="small"
          style={{ textAlign: "right", width: 120 }}
          value={salary[r.a] ?? ""}
          onChange={(e) => setSalaryField(r.a, e.target.value)}
        />
      ),
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Generate Letter
          </Title>
          <Text type="secondary">
            Official company letters on TechNext letterhead — Offer,
            Appointment, Relieving & Experience
          </Text>
        </div>

        <Card
          title={
            <Space>
              <FileTextOutlined style={{ color: "#00a8f0" }} />
              Letter Details
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Field label="Employee">
                <AntSelect
                  style={{ width: "100%" }}
                  value={employeeId || undefined}
                  onChange={(v) => setEmployeeId(v)}
                  placeholder="— Select employee —"
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  // Offer/Appointment letters: show INVITED candidates (still
                  // mid-onboarding) together with already-saved/ACTIVE employees
                  // — i.e. everyone except soft-deleted rows. Experience/Relieving
                  // keeps showing everyone for now too.
                  options={(employees.data ?? [])
                    .filter(
                      (e: ResourceRecord) =>
                        e.onboardingStatus === "INVITED" ||
                        e.onboardingStatus === "ACTIVE",
                    )
                    .map((e: ResourceRecord) => ({
                      value: String(e.id),
                      label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
                    }))}
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Letter Type">
                <AntSelect
                  style={{ width: "100%" }}
                  value={letterType}
                  onChange={(v) => setLetterType(v)}
                  options={[
                    { value: "OFFER", label: "Offer Letter" },
                    { value: "APPOINTMENT", label: "Appointment Letter" },
                    {
                      value: "EXPERIENCE",
                      label: "Experience Cum Relieving Letter",
                    },
                  ]}
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Letter Date">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  value={meta.letterDate ? dayjs(meta.letterDate) : null}
                  onChange={(d) =>
                    setMetaField("letterDate", d ? d.format("YYYY-MM-DD") : "")
                  }
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Place">
                <AntInput
                  value={meta.place}
                  onChange={(e) => setMetaField("place", e.target.value)}
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Designation">
                <AntInput
                  value={meta.designation}
                  onChange={(e) => setMetaField("designation", e.target.value)}
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Work Location">
                <AntInput
                  value={meta.workLocation}
                  onChange={(e) => setMetaField("workLocation", e.target.value)}
                />
              </Field>
            </Col>
            {!isServiceLetter && (
              <Col xs={24} sm={12}>
                <Field label="Employment Type">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={meta.employmentType}
                    onChange={(v) => setMetaField("employmentType", v)}
                    options={[
                      { value: "FULL_TIME", label: "Full-time" },
                      { value: "PART_TIME", label: "Part-time" },
                      { value: "CONTRACT", label: "Contract" },
                    ]}
                  />
                </Field>
              </Col>
            )}
            {!isServiceLetter && meta.employmentType === "CONTRACT" && (
              <Col xs={24} sm={12}>
                <Field label="Contract Duration">
                  <Space.Compact style={{ width: "100%" }}>
                    <AntInput
                      type="number"
                      min={1}
                      style={{ width: "60%" }}
                      placeholder="e.g. 6"
                      value={meta.contractDuration}
                      onChange={(e) =>
                        setMetaField("contractDuration", e.target.value)
                      }
                    />
                    <AntSelect
                      style={{ width: "40%" }}
                      value={meta.contractDurationUnit}
                      onChange={(v) => setMetaField("contractDurationUnit", v)}
                      options={[
                        { value: "DAYS", label: "Days" },
                        { value: "MONTHS", label: "Months" },
                      ]}
                    />
                  </Space.Compact>
                </Field>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Field label="Date of Joining">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  value={meta.dateOfJoining ? dayjs(meta.dateOfJoining) : null}
                  onChange={(d) =>
                    setMetaField(
                      "dateOfJoining",
                      d ? d.format("YYYY-MM-DD") : "",
                    )
                  }
                />
              </Field>
            </Col>
            {!isServiceLetter && (
              <Col xs={24} sm={12}>
                <Field label="Annual CTC (e.g. 4,22,268)">
                  <AntInput
                    value={meta.ctcAnnual}
                    onChange={(e) => setMetaField("ctcAnnual", e.target.value)}
                  />
                </Field>
                <AntButton
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  disabled={!meta.ctcAnnual}
                  onClick={autoFillSalary}
                  style={{ padding: 0, marginTop: 4 }}
                >
                  Auto-fill salary breakup from CTC
                </AntButton>
              </Col>
            )}
            {isServiceLetter && (
              <Col xs={24} sm={12}>
                <Field label="Employment End Date">
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    value={
                      meta.employmentEndDate
                        ? dayjs(meta.employmentEndDate)
                        : null
                    }
                    onChange={(d) =>
                      setMetaField(
                        "employmentEndDate",
                        d ? d.format("YYYY-MM-DD") : "",
                      )
                    }
                  />
                </Field>
              </Col>
            )}
            {letterType === "APPOINTMENT" && (
              <Col xs={24} sm={12}>
                <Field label="CTC in words">
                  <AntInput
                    value={meta.ctcInWords}
                    onChange={(e) => setMetaField("ctcInWords", e.target.value)}
                  />
                </Field>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Field label="Signatory Name">
                <AntInput
                  value={meta.signatoryName}
                  onChange={(e) =>
                    setMetaField("signatoryName", e.target.value)
                  }
                />
              </Field>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Signatory Title">
                <AntInput
                  value={meta.signatoryTitle}
                  onChange={(e) =>
                    setMetaField("signatoryTitle", e.target.value)
                  }
                />
              </Field>
            </Col>
            <Col xs={24}>
              <Field label="HR Director Signature (optional)">
                <FileUpload
                  label="Upload signature image"
                  accept=".png,.jpg,.jpeg"
                  value={meta.signatureFileId}
                  onUploaded={(url) => setMetaField("signatureFileId", url)}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  PNG/JPG with a transparent or white background works best. If
                  left empty, the default signature is used.
                </Text>
              </Field>
            </Col>
          </Row>
        </Card>

        {!isServiceLetter && (
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: "#00a8f0" }} />
                Salary Structure
              </Space>
            }
            extra={
              <AntButton
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={autoFillSalary}
              >
                Auto-fill from CTC
              </AntButton>
            }
          >
            <Table
              size="small"
              rowKey={(r: any) => r.m}
              columns={salaryColumns}
              dataSource={salaryRows}
              pagination={false}
            />
          </Card>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <AntButton
            type="primary"
            icon={<DownloadOutlined />}
            loading={gen.isPending}
            disabled={!canGenerate}
            onClick={() => gen.mutate()}
          >
            Generate & Download PDF
          </AntButton>
          {isServiceLetter && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Relieving & Experience letters are issued on letterhead without a
              salary annexure.
            </Text>
          )}
          {!canGenerate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Select an employee, designation, and CTC to enable.
            </Text>
          )}
        </div>
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
