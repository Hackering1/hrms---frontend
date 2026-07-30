import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
  Spin,
  Result,
  Divider,
  Radio,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  onboardingService,
  extractInviteError,
  type OnboardingInfo,
} from "../../services/onboardingService";
import { Section, Grid, Field, MonthYear } from "../employee/EmployeesPage";
import FileUpload from "../../components/ui/FileUpload";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const MARITAL_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

type EducationRow = {
  level: string;
  institution: string;
  specialization: string;
  percentage: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  documentUrl?: string;
};
type ExperienceRow = {
  company: string;
  designation: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
};

const blankEdu = (): EducationRow => ({
  level: "",
  institution: "",
  specialization: "",
  percentage: "",
});
const blankExp = (): ExperienceRow => ({ company: "", designation: "" });

// The 8 document upload slots from the spec. docType values must match exactly
// what EmployeeInviteService.saveDocuments() on the backend expects.
const DOC_SLOTS: { docType: string; label: string; required: boolean }[] = [
  { docType: "PROFILE_PHOTO", label: "Profile Photo", required: false },
  { docType: "RESUME", label: "Resume", required: false },
  { docType: "AADHAAR", label: "Aadhaar Card", required: true },
  { docType: "PAN", label: "PAN Card", required: true },
  {
    docType: "DEGREE_CERTIFICATE",
    label: "Degree Certificate(s)",
    required: false,
  },
  {
    docType: "EXPERIENCE_CERTIFICATE",
    label: "Experience Certificate(s)",
    required: false,
  },
  { docType: "BANK_PASSBOOK", label: "Bank Passbook", required: true },
  { docType: "OTHER", label: "Other Document", required: false },
];

export default function EmployeeOnboardingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [invalidMessage, setInvalidMessage] = useState<string>("");
  const [info, setInfo] = useState<OnboardingInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Personal
  const [dateOfBirth, setDateOfBirth] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<string>("");
  const [maritalStatus, setMaritalStatus] = useState<string>("");
  const [nationality, setNationality] = useState<string>("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  // Emergency contact
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");

  // Government IDs / bank
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [uanNumber, setUanNumber] = useState("");

  // Education / Experience
  const [isFresher, setIsFresher] = useState(true);
  const [education, setEducation] = useState<EducationRow[]>([blankEdu()]);
  const [experience, setExperience] = useState<ExperienceRow[]>([]);

  // Documents — keyed by docType
  const [docs, setDocs] = useState<Record<string, string>>({});

  // Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setInvalidReason("NOT_FOUND");
      setInvalidMessage("This invitation link is missing its token.");
      setLoading(false);
      return;
    }
    onboardingService
      .getInfo(token)
      .then((data) => setInfo(data))
      .catch((err) => {
        const { reason, message } = extractInviteError(err);
        setInvalidReason(reason);
        setInvalidMessage(message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const uploadFn = (docType: string) => async (file: File) => {
    const res = await onboardingService.uploadDocument(token, file);
    return { url: res.url, fileName: res.fileName };
  };

  const handleSubmit = async () => {
    if (
      !dateOfBirth ||
      !gender ||
      !bloodGroup ||
      !maritalStatus ||
      !nationality
    ) {
      toast.error("Please complete all required Personal Information fields.");
      return;
    }
    if (!aadhaarNumber || !panNumber) {
      toast.error("Aadhaar Number and PAN Number are required.");
      return;
    }
    if (!bankAccountNumber || !bankName || !ifscCode) {
      toast.error("Please complete all required Bank Details fields.");
      return;
    }
    const missingRequiredDocs = DOC_SLOTS.filter(
      (s) => s.required && !docs[s.docType],
    );
    if (missingRequiredDocs.length > 0) {
      toast.error(
        "Please upload: " + missingRequiredDocs.map((s) => s.label).join(", "),
      );
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Password and Confirm Password do not match.");
      return;
    }

    const documents = Object.entries(docs)
      .filter(([, url]) => !!url)
      .map(([docType, fileUrl]) => ({ docType, fileUrl }));

    setSubmitting(true);
    try {
      await onboardingService.complete(token, {
        dateOfBirth,
        gender,
        bloodGroup,
        maritalStatus,
        nationality,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        aadhaarNumber,
        panNumber,
        bankAccountNumber,
        bankName,
        ifscCode,
        uanNumber,
        isFresher,
        education: education.filter((e) => e.level && e.level.trim() !== ""),
        experience: isFresher
          ? []
          : experience.filter((e) => e.company && e.company.trim() !== ""),
        documents,
        password,
        confirmPassword,
      });
      setDone(true);
      toast.success("Registration completed! You can now log in.");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Could not complete registration",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pageShell = (children: React.ReactNode) => (
    <ConfigProvider theme={theme}>
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "40px 16px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 860 }}>{children}</div>
      </div>
    </ConfigProvider>
  );

  if (loading) {
    return pageShell(
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>,
    );
  }

  if (invalidReason) {
    const titleByReason: Record<string, string> = {
      NOT_FOUND: "Invalid Invitation",
      CANCELLED: "Invalid Invitation",
      EXPIRED: "Expired Invitation",
      ALREADY_USED: "Invitation Already Used",
    };
    return pageShell(
      <Result
        status="warning"
        title={titleByReason[invalidReason] ?? "Invalid Invitation"}
        subTitle={invalidMessage}
      />,
    );
  }

  if (done) {
    return pageShell(
      <Result
        status="success"
        title="Registration Completed"
        subTitle="Your profile is now active. You can log in with your new password. Redirecting to login…"
      />,
    );
  }

  if (!info) return null;

  return pageShell(
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 32,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <Title level={3} style={{ marginBottom: 4 }}>
        Complete Your Employee Registration
      </Title>
      <Text type="secondary">
        This link expires in {Math.max(0, Math.floor(info.minutesRemaining))}{" "}
        minutes — please finish and submit before then.
      </Text>

      <Divider />

      <Section title="Your Details (fixed by HR — cannot be edited)">
        <Grid>
          <Field label="Employee Code">
            <AntInput value={info.employeeCode} disabled />
          </Field>
          <Field label="First Name">
            <AntInput value={info.firstName} disabled />
          </Field>
          <Field label="Last Name">
            <AntInput value={info.lastName} disabled />
          </Field>
          <Field label="Login Email">
            <AntInput value={info.email} disabled />
          </Field>
          <Field label="Department">
            <AntInput value={info.departmentName ?? "—"} disabled />
          </Field>
          <Field label="Designation">
            <AntInput value={info.designationName ?? "—"} disabled />
          </Field>
          <Field label="Reporting Manager">
            <AntInput value={info.managerName ?? "—"} disabled />
          </Field>
          <Field label="Date of Joining">
            <AntInput value={info.dateOfJoining ?? "—"} disabled />
          </Field>
          <Field label="Role">
            <AntInput value={info.loginRole} disabled />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <Section title="Personal Information">
        <Grid>
          <Field label="Date of Birth *">
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              value={dateOfBirth ? dayjs(dateOfBirth) : null}
              onChange={(d) => setDateOfBirth(d ? d.format("YYYY-MM-DD") : "")}
            />
          </Field>
          <Field label="Gender *">
            <AntSelect
              style={{ width: "100%" }}
              value={gender || undefined}
              onChange={setGender}
              allowClear
              options={[
                { value: "MALE", label: "Male" },
                { value: "FEMALE", label: "Female" },
                { value: "OTHER", label: "Other" },
              ]}
            />
          </Field>
          <Field label="Blood Group *">
            <AntInput
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            />
          </Field>
          <Field label="Marital Status *">
            <AntSelect
              style={{ width: "100%" }}
              value={maritalStatus || undefined}
              onChange={setMaritalStatus}
              allowClear
              options={MARITAL_OPTIONS}
            />
          </Field>
          <Field label="Nationality *">
            <AntInput
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <Section title="Address">
        <Grid>
          <Field label="Address Line 1">
            <AntInput
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </Field>
          <Field label="Address Line 2">
            <AntInput
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </Field>
          <Field label="City">
            <AntInput value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="State">
            <AntInput
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </Field>
          <Field label="Postal Code">
            <AntInput
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </Field>
          <Field label="Country">
            <AntInput
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <Section title="Emergency Contact">
        <Grid>
          <Field label="Name">
            <AntInput
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <AntInput
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
            />
          </Field>
          <Field label="Relation">
            <AntInput
              value={emergencyContactRelation}
              onChange={(e) => setEmergencyContactRelation(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <Section title="Government IDs & Bank Details">
        <Grid>
          <Field label="Aadhaar Number *">
            <AntInput
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
            />
          </Field>
          <Field label="PAN Number *">
            <AntInput
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
            />
          </Field>
          <Field label="UAN Number">
            <AntInput
              value={uanNumber}
              onChange={(e) => setUanNumber(e.target.value)}
            />
          </Field>
          <Field label="Bank Account Number *">
            <AntInput
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
            />
          </Field>
          <Field label="Bank Name *">
            <AntInput
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
          <Field label="IFSC Code *">
            <AntInput
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <Section title="Are you a fresher (no prior work experience)?">
        <Radio.Group
          value={isFresher}
          onChange={(e) => setIsFresher(e.target.value)}
        >
          <Radio value={true}>Yes, this is my first job</Radio>
          <Radio value={false}>No, I have prior experience</Radio>
        </Radio.Group>
      </Section>

      <Divider />

      <Section
        title="Education"
        action={
          <AntButton
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setEducation((a) => [...a, blankEdu()])}
          >
            Add
          </AntButton>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {education.map((ed, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Grid>
                <Field label="Level *">
                  <AntInput
                    value={ed.level}
                    onChange={(e) =>
                      setEducation((a) =>
                        a.map((x, idx) =>
                          idx === i ? { ...x, level: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Institution">
                  <AntInput
                    value={ed.institution}
                    onChange={(e) =>
                      setEducation((a) =>
                        a.map((x, idx) =>
                          idx === i ? { ...x, institution: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Specialization">
                  <AntInput
                    value={ed.specialization}
                    onChange={(e) =>
                      setEducation((a) =>
                        a.map((x, idx) =>
                          idx === i
                            ? { ...x, specialization: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Percentage / CGPA">
                  <AntInput
                    value={ed.percentage}
                    onChange={(e) =>
                      setEducation((a) =>
                        a.map((x, idx) =>
                          idx === i ? { ...x, percentage: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <MonthYear
                  label="From"
                  m={ed.fromMonth}
                  y={ed.fromYear}
                  onM={(v) =>
                    setEducation((a) =>
                      a.map((x, idx) =>
                        idx === i ? { ...x, fromMonth: v } : x,
                      ),
                    )
                  }
                  onY={(v) =>
                    setEducation((a) =>
                      a.map((x, idx) =>
                        idx === i ? { ...x, fromYear: v } : x,
                      ),
                    )
                  }
                />
                <MonthYear
                  label="To"
                  m={ed.toMonth}
                  y={ed.toYear}
                  onM={(v) =>
                    setEducation((a) =>
                      a.map((x, idx) => (idx === i ? { ...x, toMonth: v } : x)),
                    )
                  }
                  onY={(v) =>
                    setEducation((a) =>
                      a.map((x, idx) => (idx === i ? { ...x, toYear: v } : x)),
                    )
                  }
                />
              </Grid>
              {education.length > 1 && (
                <AntButton
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setEducation((a) => a.filter((_, idx) => idx !== i))
                  }
                >
                  Remove
                </AntButton>
              )}
            </div>
          ))}
        </div>
      </Section>

      {!isFresher && (
        <>
          <Divider />
          <Section
            title="Experience"
            action={
              <AntButton
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setExperience((a) => [...a, blankExp()])}
              >
                Add
              </AntButton>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {experience.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <Grid>
                    <Field label="Company">
                      <AntInput
                        value={ex.company}
                        onChange={(e) =>
                          setExperience((a) =>
                            a.map((x, idx) =>
                              idx === i ? { ...x, company: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Designation">
                      <AntInput
                        value={ex.designation}
                        onChange={(e) =>
                          setExperience((a) =>
                            a.map((x, idx) =>
                              idx === i
                                ? { ...x, designation: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <MonthYear
                      label="From"
                      m={ex.fromMonth}
                      y={ex.fromYear}
                      onM={(v) =>
                        setExperience((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, fromMonth: v } : x,
                          ),
                        )
                      }
                      onY={(v) =>
                        setExperience((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, fromYear: v } : x,
                          ),
                        )
                      }
                    />
                    <MonthYear
                      label="To"
                      m={ex.toMonth}
                      y={ex.toYear}
                      onM={(v) =>
                        setExperience((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, toMonth: v } : x,
                          ),
                        )
                      }
                      onY={(v) =>
                        setExperience((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, toYear: v } : x,
                          ),
                        )
                      }
                    />
                  </Grid>
                  <AntButton
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={() =>
                      setExperience((a) => a.filter((_, idx) => idx !== i))
                    }
                  >
                    Remove
                  </AntButton>
                </div>
              ))}
              {experience.length === 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Click "Add" to list your work experience.
                </Text>
              )}
            </div>
          </Section>
        </>
      )}

      <Divider />

      <Section title="Documents">
        <Grid>
          {DOC_SLOTS.map((slot) => (
            <FileUpload
              key={slot.docType}
              label={slot.label + (slot.required ? " *" : "")}
              value={docs[slot.docType]}
              uploadFn={uploadFn(slot.docType)}
              onUploaded={(url) =>
                setDocs((d) => ({ ...d, [slot.docType]: url || "" }))
              }
            />
          ))}
        </Grid>
      </Section>

      <Divider />

      <Section title="Create Your Password">
        <Grid>
          <Field label="Password *">
            <AntInput.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm Password *">
            <AntInput.Password
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Divider />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AntButton
          type="primary"
          size="large"
          loading={submitting}
          onClick={handleSubmit}
        >
          Complete Registration
        </AntButton>
      </div>
    </div>,
  );
}
