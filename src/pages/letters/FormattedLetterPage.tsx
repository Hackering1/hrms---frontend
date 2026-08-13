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
  Divider,
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
  | "insuranceM"
  | "insuranceA"
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
  { label: "HRA (40% of Basic)", m: "hraM", a: "hraA" },
  { label: "Leave Travel Allowance", m: "ltaM", a: "ltaA" },
  { label: "Special Allowance", m: "specialM", a: "specialA" },
  { label: "Gross Salary (E)", m: "grossM", a: "grossA" },
  { label: "Employee PF (Fixed)", m: "pfEmployeeM", a: "pfEmployeeA" },
  { label: "Professional Tax (KA)", m: "ptM", a: "ptA" },
  { label: "Total Deductions (D)", m: "deductionsM", a: "deductionsA" },
  { label: "Net Take Home (Before TDS)", m: "netM", a: "netA" },
  { label: "Employer PF (Fixed)", m: "pfEmployerM", a: "pfEmployerA" },
  { label: "Gratuity (4.81% of Basic)", m: "gratuityM", a: "gratuityA" },
  {
    label: "Group Health/Accident Insurance",
    m: "insuranceM",
    a: "insuranceA",
  },
  { label: "Total Employer Cost", m: "employerCostM", a: "employerCostA" },
  {
    label: "Total Cost to Company (CTC)",
    m: "ctcMonthlyTotal",
    a: "ctcAnnualTotal",
  },
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
  // employeeId is set only when the text in the field matches a saved or
  // invited employee picked from the dropdown. Free-typed text (a candidate
  // who isn't in the system at all yet — e.g. pre-offer, before any invite
  // has been sent) leaves employeeId blank and is sent as employeeName only.
  const [employeeId, setEmployeeId] = useState("");
  const [employeeNameInput, setEmployeeNameInput] = useState("");
  // Raw text currently typed into the dropdown's search box (separate from
  // the committed employeeNameInput above) — used only to build the "use
  // this as a new candidate" suggestion row while the user is typing.
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [letterType, setLetterType] = useState<
    "OFFER" | "APPOINTMENT" | "RELIEVING" | "EXPERIENCE" | "INTERNSHIP"
  >("OFFER");

  const isServiceLetter =
    letterType === "RELIEVING" ||
    letterType === "EXPERIENCE" ||
    letterType === "INTERNSHIP";
  const [meta, setMeta] = useState<Record<string, string>>({
    letterDate: dayjs().format("YYYY-MM-DD"),
    place: "Bangalore",
    dateOfJoining: "",
    employmentEndDate: "",
    // NEW — INTERNSHIP only: free text HR types per intern describing
    // responsibilities/technologies/contributions. Blank by default; never
    // hardcoded.
    internshipDetails: "",
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
  // Reuses the same /designations endpoint already used elsewhere in the app
  // (e.g. Invite Employee) — no new API, no hardcoded list.
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: () => resourceService.list("/designations"),
  });

  const selectedEmp = (employees.data ?? []).find(
    (e: ResourceRecord) => String(e.id) === employeeId,
  );
  // The name that goes on the letter: whatever is typed/selected in the
  // field — whether that resolved to a saved/invited employee or not.
  const employeeName = employeeNameInput.trim();

  // Employee dropdown options, grouped into "Saved Employees" (ACTIVE,
  // already in the system) and "Invited (Onboarding)" (invite sent, still
  // mid-onboarding). A third, dynamic group offers "use this as a new
  // candidate" whenever the typed search text doesn't match anyone already
  // listed — that's how a name like "GuruPrakash", not in the system at
  // all, still gets used to generate a letter.
  const toEmpOption = (e: ResourceRecord) => {
    const name = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
    return {
      value: String(e.id),
      label: `${name} (${e.employeeCode ?? "—"})`,
      empId: String(e.id),
      empName: name,
    };
  };
  const savedEmpOptions = (employees.data ?? [])
    .filter((e: ResourceRecord) => e.onboardingStatus === "ACTIVE")
    .map(toEmpOption);
  const invitedEmpOptions = (employees.data ?? [])
    .filter((e: ResourceRecord) => e.onboardingStatus === "INVITED")
    .map(toEmpOption);

  const knownNames = new Set(
    [...savedEmpOptions, ...invitedEmpOptions].map((o) =>
      o.empName.toLowerCase(),
    ),
  );
  const trimmedSearch = employeeSearch.trim();
  const showAddNew =
    trimmedSearch.length > 0 && !knownNames.has(trimmedSearch.toLowerCase());

  // Keeps the field showing the previously-committed manual name (if any)
  // even when the dropdown is closed and nothing is currently being typed.
  const manualOption =
    !employeeId && employeeNameInput
      ? [
          {
            value: "__manual__",
            label: employeeNameInput,
            empId: "",
            empName: employeeNameInput,
          },
        ]
      : [];

  const employeeOptions = [
    ...(savedEmpOptions.length
      ? [{ label: "Saved Employees", options: savedEmpOptions }]
      : []),
    ...(invitedEmpOptions.length
      ? [{ label: "Invited (Onboarding)", options: invitedEmpOptions }]
      : []),
    ...(showAddNew
      ? [
          {
            label: "New Candidate",
            options: [
              {
                value: "__add_new__",
                label: `Use "${trimmedSearch}" (not in system)`,
                empId: "",
                empName: trimmedSearch,
              },
            ],
          },
        ]
      : manualOption.length
        ? [{ label: "New Candidate", options: manualOption }]
        : []),
  ];

  const setMetaField = (k: string, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));
  const setSalaryField = (k: string, v: string) =>
    setSalary((s) => ({ ...s, [k]: v }));

  /**
   * Auto-fill the salary structure from Annual CTC + a manually-entered Basic
   * Salary (HR types Basic into the table first, then clicks this).
   *
   * Only formulas explicitly confirmed are applied:
   *   HRA = 40% of Basic
   *   Gratuity = 4.81% of Basic
   *   Employer PF = ₹1,800/mo fixed (₹21,600/yr)
   *   Employee PF = ₹1,800/mo fixed (₹21,600/yr)
   *   Professional Tax (KA) = ₹200/mo fixed (₹2,400/yr)
   *   Total Employer Cost = Employer PF + Gratuity + Group Insurance
   *   Gross Salary (E) = CTC − Total Employer Cost
   *   Special Allowance = Gross − Basic − HRA − LTA (remainder)
   *   Total Deductions (D) = Employee PF + Professional Tax
   *   Net Take Home = Gross − Total Deductions
   *   Total CTC = the entered target CTC
   *
   * Leave Travel Allowance and Group Health/Accident Insurance have no
   * confirmed formula — they're left as whatever is already typed in those
   * cells (0 if empty), never invented or overwritten with a guessed value.
   */
  const autoFillSalary = () => {
    const ctc = Number((meta.ctcAnnual || "").replace(/[^\d.]/g, ""));
    if (!ctc || ctc <= 0) {
      toast.error("Enter a valid Annual CTC first.");
      return;
    }
    const basicFromAnnual = Number(
      (salary.basicA || "").replace(/[^\d.]/g, ""),
    );
    const basicFromMonthly = Number(
      (salary.basicM || "").replace(/[^\d.]/g, ""),
    );
    const basicA = basicFromAnnual || basicFromMonthly * 12;
    if (!basicA || basicA <= 0) {
      toast.error(
        "Enter Basic Salary in the table first, then auto-fill the rest.",
      );
      return;
    }

    const basicM = Math.round(basicA / 12);
    const hraM = Math.round(basicM * 0.4);
    const gratuityM = Math.round(basicM * 0.0481);
    const pfEmployerM = 1800;
    const pfEmployeeM = 1800;
    const ptM = 200;
    // Not overwritten with an invented formula — keep whatever is already
    // there (0 if the cell is still empty).
    const ltaM = Math.round(
      (Number((salary.ltaA || "").replace(/[^\d.]/g, "")) || 0) / 12,
    );
    const insuranceM = Math.round(
      (Number((salary.insuranceA || "").replace(/[^\d.]/g, "")) || 0) / 12,
    );

    const employerCostM = pfEmployerM + gratuityM + insuranceM;
    const grossM = Math.round(ctc / 12) - employerCostM;
    const specialM = grossM - basicM - hraM - ltaM;
    const deductionsM = pfEmployeeM + ptM;
    const netM = grossM - deductionsM;

    const a = (mVal: number) => mVal * 12;
    setSalary({
      basicM: inr(basicM),
      basicA: inr(a(basicM)),
      hraM: inr(hraM),
      hraA: inr(a(hraM)),
      ltaM: inr(ltaM),
      ltaA: inr(a(ltaM)),
      specialM: inr(specialM),
      specialA: inr(a(specialM)),
      grossM: inr(grossM),
      grossA: inr(a(grossM)),
      pfEmployeeM: inr(pfEmployeeM),
      pfEmployeeA: inr(a(pfEmployeeM)),
      ptM: inr(ptM),
      ptA: inr(a(ptM)),
      deductionsM: inr(deductionsM),
      deductionsA: inr(a(deductionsM)),
      netM: inr(netM),
      netA: inr(a(netM)),
      pfEmployerM: inr(pfEmployerM),
      pfEmployerA: inr(a(pfEmployerM)),
      gratuityM: inr(gratuityM),
      gratuityA: inr(a(gratuityM)),
      insuranceM: inr(insuranceM),
      insuranceA: inr(a(insuranceM)),
      employerCostM: inr(employerCostM),
      employerCostA: inr(a(employerCostM)),
      ctcMonthlyTotal: inr(Math.round(ctc / 12)),
      ctcAnnualTotal: inr(ctc),
    });
    toast.success("Salary structure auto-filled from CTC + Basic");
  };

  const gen = useMutation({
    mutationFn: async () => {
      const payload = {
        // "" (unmatched/typed name) must go as null, not "" — the backend
        // parses this as a UUID and an empty string would fail to parse.
        employeeId: employeeId || null,
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
              : letterType === "INTERNSHIP"
                ? "Internship"
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

  // A typed-but-unmatched name is just as valid as a picked employee — only
  // the name text is actually required to generate a letter.
  const canGenerate = isServiceLetter
    ? !!employeeName && !!meta.designation && !!meta.employmentEndDate
    : !!employeeName &&
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
            <Col xs={24}>
              <Divider
                titlePlacement="left"
                style={{ margin: "0 0 4px" }}
                plain
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  RECIPIENT
                </Text>
              </Divider>
            </Col>
            <Col xs={24} sm={12}>
              <Field label="Employee">
                <AntSelect
                  style={{ width: "100%" }}
                  showSearch
                  value={
                    employeeId
                      ? employeeId
                      : employeeNameInput
                        ? "__manual__"
                        : undefined
                  }
                  options={employeeOptions}
                  searchValue={employeeSearch}
                  onSearch={(text) => setEmployeeSearch(text)}
                  filterOption={(input, option: any) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(_value, option: any) => {
                    setEmployeeNameInput(option.empName);
                    setEmployeeId(option.empId);
                    setEmployeeSearch("");
                  }}
                  placeholder="Select a saved/invited employee, or type a new candidate's name"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Pick from Saved Employees or Invited (Onboarding), or type a
                  name and choose "Use ... (not in system)" for a candidate who
                  isn't in the system yet.
                </Text>
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
                    {
                      value: "INTERNSHIP",
                      label: "Internship Experience Letter",
                    },
                  ]}
                />
              </Field>
            </Col>
            <Col xs={24}>
              <Divider
                titlePlacement="left"
                style={{ margin: "0 0 4px" }}
                plain
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  EMPLOYMENT DETAILS
                </Text>
              </Divider>
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
                <AntSelect
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select designation"
                  value={meta.designation || undefined}
                  onChange={(v) => setMetaField("designation", v)}
                  notFoundContent="No designations available"
                  options={((designations.data ?? []) as ResourceRecord[]).map(
                    (d) => ({
                      // Stored as the designation NAME (a plain string), same
                      // as the free-text field it replaces — this is what
                      // already flows into the letter payload/PDF unchanged.
                      value: d.name,
                      label: d.name,
                    }),
                  )}
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
              <Col xs={24}>
                <Divider
                  titlePlacement="left"
                  style={{ margin: "0 0 4px" }}
                  plain
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    COMPENSATION
                  </Text>
                </Divider>
              </Col>
            )}
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
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Enter Basic Salary in the table below first, then click
                    auto-fill.
                  </Text>
                </div>
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
            {letterType === "INTERNSHIP" && (
              <Col xs={24}>
                <Field label="Responsibilities / Technologies (optional)">
                  <AntInput.TextArea
                    rows={4}
                    placeholder="Describe the intern's responsibilities, technologies used, and contributions — this is typed per intern and included in the letter as written."
                    value={meta.internshipDetails}
                    onChange={(e) =>
                      setMetaField("internshipDetails", e.target.value)
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
            <Col xs={24}>
              <Divider
                titlePlacement="left"
                style={{ margin: "0 0 4px" }}
                plain
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AUTHORIZED SIGNATORY
                </Text>
              </Divider>
            </Col>
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
              Relieving, Experience, and Internship letters are issued on
              letterhead without a salary annexure.
            </Text>
          )}
          {!canGenerate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Enter an employee name, designation, and CTC to enable.
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
