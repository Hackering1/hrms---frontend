import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Table,
  Tag,
  Modal as AntModal,
  Popconfirm,
  Empty,
  DatePicker,
  Space,
  Divider,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { resourceService } from "../../services/resourceService";
import { documentService } from "../../services/documentService";
import FileUpload from "../../components/ui/FileUpload";
import { useAuthStore } from "../../store/authStore";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { managerService } from "../../services/managerService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const PAGE_SIZE = 10;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MARITAL_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

type Education = {
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
type Experience = {
  company: string;
  designation: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
};

const blankEdu = (): Education => ({
  level: "",
  institution: "",
  specialization: "",
  percentage: "",
});
const blankExp = (): Experience => ({ company: "", designation: "" });

// #9: a document attached during employee creation.
// A single uploaded document. Its category is implied by which section it's
// uploaded in (Personal / Educational / Experience).
type DocFile = {
  documentName: string;
  fileUrl: string;
  fileType: string;
};
const blankDoc = (): DocFile => ({
  documentName: "",
  fileUrl: "",
  fileType: "",
});

const statusColor: Record<string, string> = {
  ACTIVE: "success",
  PROBATION: "processing",
  CONFIRMED: "success",
  RESIGNED: "warning",
  EXITED: "default",
};

// Address / emergency contact / phone now live in employee_contacts, exposed
// as a nested `contact` object on each employee row (null if the employee
// hasn't filled it in yet). Shows the employee's current address; permanent
// address lives in the same object for a future detail/edit view.
function formatAddress(row: any): string {
  const c = row.contact;
  if (!c) return "\u2014";
  const parts = [
    c.addressLine1,
    c.addressLine2,
    c.city,
    c.state,
    c.pincode,
    c.country,
  ].filter((p) => p != null && String(p).trim() !== "");
  return parts.length > 0 ? parts.join(", ") : "\u2014";
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles) ?? [];
  const canManage = roles.some((r) =>
    ["SUPER_ADMIN", "HR_ADMIN", "HR_EXECUTIVE"].includes(r),
  );
  // A manager (not super admin / HR) sees ONLY their own team here.
  const { isManager, isSuperAdmin, isHr } = useRole();
  const managerScoped = isManager && !isSuperAdmin && !isHr;
  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    enabled: managerScoped,
  });
  const myTeam = useQuery({
    queryKey: ["team", me.data?.id],
    queryFn: () => managerService.team(me.data!.id as string),
    enabled: managerScoped && !!me.data?.id,
  });

  // Real login roles live in the users table. We match employee rows to their
  // login account by userId (reliable) and fall back to email only if needed.
  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: () => resourceService.list("/users"),
  });

  // userId -> roles[] map, plus email -> roles[] fallback.
  const rolesByUserId = new Map<string, string[]>();
  const rolesByEmail = new Map<string, string[]>();
  for (const u of (users.data ?? []) as any[]) {
    const rs: string[] = Array.isArray(u.roles) ? u.roles : [];
    if (u.id != null) rolesByUserId.set(String(u.id), rs);
    if (u.email) rolesByEmail.set(String(u.email).toLowerCase(), rs);
  }

  // The employee row's real login roles (userId first, email fallback).
  const rowRoles = (row: any): string[] => {
    if (row.userId && rolesByUserId.has(String(row.userId)))
      return rolesByUserId.get(String(row.userId))!;
    const em = String(row.email ?? "").toLowerCase();
    return rolesByEmail.get(em) ?? [];
  };
  const isManagerRow = (row: any) => rowRoles(row).includes("MANAGER");
  const isSuperAdminRow = (row: any) => rowRoles(row).includes("SUPER_ADMIN");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);

  // form state
  const [form, setForm] = useState<ResourceRecord>({});
  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  // #9: documents attached during creation, grouped by section. The category is
  // implied by the section (Personal / Educational / Experience). TechNext docs
  // are uploaded later from My Documents.
  const [personalDocs, setPersonalDocs] = useState<DocFile[]>([]);
  const [eduDocs, setEduDocs] = useState<DocFile[]>([]);
  const [expDocs, setExpDocs] = useState<DocFile[]>([]);
  const isFresher = form.isFresher === undefined ? true : !!form.isFresher;

  // data
  const list = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  // #9: document categories, used to resolve category ids by name.
  const documentCategories = useQuery({
    queryKey: ["documentCategories"],
    queryFn: () => resourceService.list("/document-categories"),
  });
  // Resolve a category id by (case-insensitive) name.
  const categoryIdByName = (name: string): number | undefined => {
    const found = ((documentCategories.data ?? []) as any[]).find(
      (c) => String(c.name).trim().toLowerCase() === name.toLowerCase(),
    );
    return found ? (found.id as number) : undefined;
  };
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => resourceService.list("/branches"),
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => resourceService.list("/departments"),
  });
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: () => resourceService.list("/designations"),
  });
  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => resourceService.list("/shifts"),
  });

  const allRows = list.data ?? [];

  // Managers available as "reporting manager" when creating an EMPLOYEE or
  // MANAGER login (a manager can report to a senior manager too, and can
  // also report directly to a Super Admin — e.g. a Chief Executive Manager).
  const managerOptions = (allRows as ResourceRecord[])
    .filter((r) => isManagerRow(r) || isSuperAdminRow(r))
    .map((r) => ({
      value: r.id,
      label: r.employeeCode + " \u2014 " + r.firstName + " " + r.lastName,
    }));

  // Existing logins (e.g. the original seeded Super Admin) that don't have an
  // employee profile yet — used by "Link Existing Login" so you can attach a
  // profile to an account you already log in with, instead of creating a
  // brand-new duplicate login.
  const linkedUserIds = new Set(
    (allRows as ResourceRecord[])
      .map((r) => r.userId)
      .filter(Boolean)
      .map((id) => String(id)),
  );
  const existingLoginOptions = ((users.data ?? []) as any[])
    .filter((u) => u.isActive !== false && !linkedUserIds.has(String(u.id)))
    .map((u) => ({
      value: u.id,
      label:
        u.email +
        (Array.isArray(u.roles) && u.roles.length
          ? " \u2014 " + u.roles.join(", ")
          : ""),
    }));

  const rows = useMemo(() => {
    if (!managerScoped) return allRows;
    const teamIds = new Set((myTeam.data ?? []).map((m) => String(m.id)));
    return allRows.filter((r) => teamIds.has(String(r.id)));
  }, [allRows, managerScoped, myTeam.data]);
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      [
        "employeeCode",
        "firstName",
        "lastName",
        "departmentName",
        "designationName",
      ].some((k) =>
        String(r[k] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, query]);

  // mutations
  const save = useMutation({
    mutationFn: (body: ResourceRecord) =>
      editingId
        ? resourceService.update("/employees", editingId, body)
        : resourceService.create("/employees", body),
    onSuccess: (resp: any) => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });

      // #9: attach documents from each section against the new employee, tagged
      // with the matching category (Personal / Educational / Experience).
      const newId = resp?.id;

      // "Link Existing Login": the profile was created with no new account —
      // attach it to the login the admin picked (e.g. the original Super Admin).
      if (
        !editingId &&
        form.loginRole === "EXISTING" &&
        form.existingUserId &&
        newId
      ) {
        selfService
          .linkUser(String(newId), String(form.existingUserId))
          .then(() => {
            qc.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Profile linked to the existing login.");
          })
          .catch(() =>
            toast.error(
              "Employee saved, but linking the existing login failed. Try again from here, or ask an admin to link it.",
            ),
          );
      }

      const buildDocs = (list2: DocFile[], categoryName: string) =>
        list2
          .filter((d) => d.fileUrl)
          .map((d) => ({
            employeeId: String(newId),
            categoryId: categoryIdByName(categoryName),
            documentName: d.documentName || "Document",
            fileUrl: d.fileUrl,
            fileType: d.fileType,
            expiryDate: "",
            uploadedBy: null,
          }));
      const toSave = [
        ...buildDocs(personalDocs, "Personal Documents"),
        ...buildDocs(eduDocs, "Educational Documents"),
        ...buildDocs(expDocs, "Experience Documents"),
      ];
      if (!editingId && newId && toSave.length > 0) {
        Promise.all(toSave.map((d) => documentService.add(d)))
          .then(() => {
            qc.invalidateQueries({ queryKey: ["documents", String(newId)] });
            toast.success(toSave.length + " document(s) attached");
          })
          .catch(() =>
            toast.error(
              "Employee saved, but some documents couldn't be attached. You can add them from My Documents.",
            ),
          );
      }
      setPersonalDocs([]);
      setEduDocs([]);
      setExpDocs([]);

      if (resp && resp.tempPassword) {
        toast.success(
          "Employee added. Login: " +
            resp.email +
            " | Password: " +
            resp.tempPassword +
            ". A welcome email has also been sent to them.",
          { duration: 12000 },
        );
      } else if (!editingId && resp && resp.email) {
        toast.success(
          "Employee added. A welcome email has been sent to " +
            resp.email +
            ".",
        );
      } else {
        toast.success(editingId ? "Employee updated" : "Employee added");
      }
    },
    onError: () => toast.error("Couldn't save employee"),
  });
  const del = useMutation({
    mutationFn: (id: string) => resourceService.remove("/employees", id),
    onSuccess: () => {
      toast.success("Employee deleted");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });
    },
    onError: () => toast.error("Couldn't delete"),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      resourceService.updateRaw("/users/" + userId + "/role", { roleName }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["activeUsers"] });
      qc.invalidateQueries({ queryKey: ["deletedUsers"] });
    },
    onError: () =>
      toast.error("Couldn't change role (is the backend /role endpoint live?)"),
  });

  const suggestNextCode = (): string => {
    const list2 = (allRows ?? []) as ResourceRecord[];
    let prefix = "EMP-";
    let maxNum = 100;
    for (const r of list2) {
      const code = String(r.employeeCode ?? "");
      const m = code.match(/^(.*?)(\d+)\s*$/);
      if (!m) continue;
      const num = parseInt(m[2], 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
        if (m[1]) prefix = m[1];
      }
    }
    return prefix + (maxNum + 1);
  };

  const openCreate = async () => {
    setEditingId(null);
    let defaults: {
      employeeCode?: string;
      managerId?: string;
      managerName?: string;
    } = {};
    try {
      defaults = await resourceService.get("/employees/new-defaults");
    } catch {
      /* fall back to the client-side guess below */
    }
    setForm({
      isFresher: true,
      status: "ACTIVE",
      employmentType: "FULL_TIME",
      password: "User@0412",
      employeeCode: defaults.employeeCode ?? suggestNextCode(),
      managerId: defaults.managerId,
      managerName: defaults.managerName,
    });
    setEducation([]);
    setExperience([]);
    setPersonalDocs([]);
    setEduDocs([]);
    setExpDocs([]);
    setOpen(true);
  };
  const openEdit = (row: ResourceRecord) => {
    setEditingId(String(row.id));
    setForm({ ...row });
    setEducation((row.education as Education[]) ?? []);
    setExperience((row.experience as Experience[]) ?? []);
    setPersonalDocs([]);
    setEduDocs([]);
    setExpDocs([]);
    setOpen(true);
  };

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // #8: when Date of Joining changes, auto-set probation end date = DOJ + 6 months.
  const onDojChange = (d: dayjs.Dayjs | null) => {
    if (!d) {
      set("dateOfJoining", "");
      set("probationEndDate", "");
      return;
    }
    setForm((p) => ({
      ...p,
      dateOfJoining: d.format("YYYY-MM-DD"),
      probationEndDate: d.add(6, "month").format("YYYY-MM-DD"),
    }));
  };

  const submit = () => {
    // #7a: all key fields required (Middle Name is the only optional one).
    const missing: string[] = [];
    const required: [any, string][] = [
      [form.employeeCode, "Employee Code"],
      [form.firstName, "First Name"],
      [form.lastName, "Last Name"],
      [form.dateOfBirth, "Date of Birth"],
      [form.gender, "Gender"],
      [form.bloodGroup, "Blood Group"],
      [form.maritalStatus, "Marital Status"],
      [form.nationality, "Nationality"],
      [form.dateOfJoining, "Date of Joining"],
      [form.employmentType, "Employment Type"],
      [form.status, "Status"],
      [form.branchId, "Branch"],
      [form.departmentId, "Department"],
      [form.designationId, "Designation"],
      [form.shiftId, "Shift"],
      [form.email, "Login Email"],
    ];
    for (const [val, label] of required) {
      if (val === undefined || val === null || String(val).trim() === "") {
        missing.push(label);
      }
    }
    if (!editingId) {
      if (!form.loginRole) missing.push("Create Login As");
      if (form.loginRole === "EXISTING") {
        if (!form.existingUserId) missing.push("Select Login to Link");
      } else {
        if (!form.password) missing.push("Login Password");
      }
      if (
        (form.loginRole === "EMPLOYEE" || form.loginRole === "MANAGER") &&
        !form.managerId
      ) {
        missing.push("Reporting Manager");
      }
    }

    // #8: Personal Documents are all mandatory.
    const personalDocFields: [any, string][] = [
      [form.aadhaarNumber, "Aadhaar Number"],
      [form.panNumber, "PAN Number"],
      [form.bankAccountNumber, "Bank Account Number"],
      [form.bankName, "Bank Name"],
      [form.ifscCode, "IFSC Code"],
    ];
    for (const [val, label] of personalDocFields) {
      if (val === undefined || val === null || String(val).trim() === "") {
        missing.push(label);
      }
    }

    // #8: Education — at least one qualification, and every added row complete.
    if (education.length === 0) {
      missing.push("At least one Education qualification");
    } else {
      education.forEach((ed, i) => {
        const incomplete =
          !ed.level?.trim() ||
          !ed.institution?.trim() ||
          !ed.specialization?.trim() ||
          !String(ed.percentage ?? "").trim() ||
          !ed.fromMonth ||
          !ed.fromYear ||
          !ed.toMonth ||
          !ed.toYear;
        if (incomplete) missing.push("All fields in Qualification " + (i + 1));
      });
    }

    // #8: Experience (experienced hires) — at least one job, every row complete.
    if (!isFresher) {
      if (experience.length === 0) {
        missing.push("At least one Previous Employment record");
      } else {
        experience.forEach((ex, i) => {
          const incomplete =
            !ex.company?.trim() ||
            !ex.designation?.trim() ||
            !ex.fromMonth ||
            !ex.fromYear ||
            !ex.toMonth ||
            !ex.toYear;
          if (incomplete) missing.push("All fields in Job " + (i + 1));
        });
      }
    }

    // #9: at least one Personal and one Educational document; experienced
    // hires also need at least one Experience document. (Only on create.)
    if (!editingId) {
      if (!personalDocs.some((d) => d.fileUrl)) {
        missing.push("At least one Personal Document");
      }
      if (!eduDocs.some((d) => d.fileUrl)) {
        missing.push("At least one Educational Document");
      }
      if (!isFresher && !expDocs.some((d) => d.fileUrl)) {
        missing.push("At least one Experience Document");
      }
    }

    if (missing.length) {
      toast.error("Please fill: " + missing.join(", "));
      return;
    }

    const isExistingLogin = !editingId && form.loginRole === "EXISTING";
    const body: ResourceRecord = {
      ...form,
      isFresher,
      // #6: IFSC is collected for all employees now.
      ifscCode: form.ifscCode ?? null,
      education: education.filter((e) => e.level.trim()),
      experience: isFresher ? [] : experience.filter((e) => e.company.trim()),
      // "Link Existing Login" attaches an already-existing account after the
      // employee profile is created (see save.onSuccess) — it must NOT also
      // trigger the normal new-login creation on the backend.
      ...(isExistingLogin
        ? {
            loginRole: undefined,
            password: undefined,
            existingUserId: undefined,
          }
        : {}),
    };
    save.mutate(body);
  };

  const updEdu = (i: number, k: keyof Education, v: any) =>
    setEducation((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)),
    );
  const updExp = (i: number, k: keyof Experience, v: any) =>
    setExperience((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)),
    );

  const columns = [
    { title: "Code", dataIndex: "employeeCode", key: "employeeCode" },
    { title: "First Name", dataIndex: "firstName", key: "firstName" },
    { title: "Last Name", dataIndex: "lastName", key: "lastName" },
    {
      title: "Date of Joining",
      dataIndex: "dateOfJoining",
      key: "dateOfJoining",
      render: (v: string) => (v ? dayjs(v).format("DD MMM YYYY") : "\u2014"),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Department",
      dataIndex: "departmentName",
      key: "departmentName",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Designation",
      dataIndex: "designationName",
      key: "designationName",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Reporting Manager",
      key: "reportingManager",
      render: (_: any, row: any) => row.reportingManagerName ?? "\u2014",
    },
    {
      title: "Role",
      key: "role",
      render: (_: any, row: any) => {
        // Super Admin is a fixed system role — show it, never editable.
        if (isSuperAdminRow(row)) {
          return <Tag color="purple">Super Admin</Tag>;
        }
        return canManage && row.userId ? (
          <AntSelect
            size="small"
            style={{ width: 110 }}
            value={isManagerRow(row) ? "MANAGER" : "EMPLOYEE"}
            onChange={(v) =>
              changeRole.mutate({ userId: String(row.userId), roleName: v })
            }
            options={[
              { value: "EMPLOYEE", label: "Employee" },
              { value: "MANAGER", label: "Manager" },
            ]}
          />
        ) : (
          <Tag color={isManagerRow(row) ? "blue" : "default"}>
            {isManagerRow(row) ? "Manager" : "Employee"}
          </Tag>
        );
      },
    },
    {
      title: "Aadhar",
      dataIndex: "aadhaarNumber",
      key: "aadhaarNumber",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "PAN",
      dataIndex: "panNumber",
      key: "panNumber",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Account No",
      dataIndex: "bankAccountNumber",
      key: "bankAccountNumber",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "IFSC",
      dataIndex: "ifscCode",
      key: "ifscCode",
      render: (v: string) => v ?? "\u2014",
    },
    {
      title: "Address",
      key: "address",
      render: (_: any, row: any) => formatAddress(row),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) =>
        v ? <Tag color={statusColor[v] ?? "default"}>{v}</Tag> : "\u2014",
    },
    {
      title: "Actions",
      key: "actions",
      align: "right" as const,
      render: (_: any, row: any) =>
        canManage ? (
          <Space>
            <AntButton
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
            />
            <Popconfirm
              title="Delete this employee?"
              description="This also removes their education and experience records."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => del.mutate(String(row.id))}
            >
              <AntButton size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary">{"\u2014"}</Text>
        ),
    },
  ];

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
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Employees
            </Title>
            {!list.isLoading && (
              <Text type="secondary">
                {rows.length} {rows.length === 1 ? "record" : "records"}
              </Text>
            )}
          </div>
          <Space>
            {canManage && (
              <AntButton
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Add Employee
              </AntButton>
            )}
            {roles.includes("SUPER_ADMIN") && (
              <AntButton onClick={() => navigate("/employees/invite")}>
                Invite Employee
              </AntButton>
            )}
          </Space>
        </div>

        {!list.isLoading && rows.length > 0 && (
          <AntInput
            allowClear
            style={{ maxWidth: 320 }}
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Search employees…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        )}

        <Table
          loading={list.isLoading}
          rowKey={(r: any) => r.id}
          columns={columns}
          dataSource={filtered as any[]}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty description="No employees yet">
                {canManage && (
                  <AntButton
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreate}
                  >
                    Add Employee
                  </AntButton>
                )}
              </Empty>
            ),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onChange: (p) => setPage(p),
            showTotal: (total) => total + " total",
          }}
        />

        <AntModal
          open={open}
          title={(editingId ? "Edit" : "Add") + " Employee"}
          onCancel={() => setOpen(false)}
          width={800}
          footer={[
            <AntButton key="cancel" onClick={() => setOpen(false)}>
              Cancel
            </AntButton>,
            <AntButton
              key="submit"
              type="primary"
              loading={save.isPending}
              onClick={submit}
            >
              {editingId ? "Update" : "Create"}
            </AntButton>,
          ]}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              maxHeight: "70vh",
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {/* Personal */}
            <Section title="Personal">
              <Grid>
                <Field label="Employee Code *">
                  <AntInput
                    value={form.employeeCode ?? ""}
                    onChange={(e) => set("employeeCode", e.target.value)}
                    disabled={Boolean(editingId) && !isHr}
                    title={
                      Boolean(editingId) && !isHr
                        ? "Only a Super Admin / HR can change an existing Employee ID"
                        : undefined
                    }
                  />
                </Field>
                <Field label="First Name *">
                  <AntInput
                    value={form.firstName ?? ""}
                    onChange={(e) => set("firstName", e.target.value)}
                  />
                </Field>
                <Field label="Last Name *">
                  <AntInput
                    value={form.lastName ?? ""}
                    onChange={(e) => set("lastName", e.target.value)}
                  />
                </Field>
                <Field label="Middle Name">
                  <AntInput
                    value={form.middleName ?? ""}
                    onChange={(e) => set("middleName", e.target.value)}
                  />
                </Field>
                <Field label="Date of Birth *">
                  <DatePicker
                    format="DD/MM/YYYY"
                    style={{ width: "100%" }}
                    value={
                      form.dateOfBirth
                        ? dayjs(form.dateOfBirth as string)
                        : null
                    }
                    onChange={(d) =>
                      set("dateOfBirth", d ? d.format("YYYY-MM-DD") : "")
                    }
                  />
                </Field>
                <Field label="Gender *">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={form.gender || undefined}
                    onChange={(v) => set("gender", v)}
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
                    value={form.bloodGroup ?? ""}
                    onChange={(e) => set("bloodGroup", e.target.value)}
                  />
                </Field>
                <Field label="Marital Status *">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={form.maritalStatus || undefined}
                    onChange={(v) => set("maritalStatus", v)}
                    allowClear
                    options={MARITAL_OPTIONS}
                  />
                </Field>
                <Field label="Nationality *">
                  <AntInput
                    value={form.nationality ?? ""}
                    onChange={(e) => set("nationality", e.target.value)}
                  />
                </Field>
              </Grid>
            </Section>

            <Divider style={{ margin: 0 }} />

            {/* Job */}
            <Section title="Job">
              <Grid>
                <Field label="Date of Joining *">
                  <DatePicker
                    format="DD/MM/YYYY"
                    style={{ width: "100%" }}
                    value={
                      form.dateOfJoining
                        ? dayjs(form.dateOfJoining as string)
                        : null
                    }
                    onChange={onDojChange}
                  />
                </Field>
                <Field label="Probation End Date (auto: DOJ + 6 months)">
                  <DatePicker
                    format="DD/MM/YYYY"
                    style={{ width: "100%" }}
                    disabled
                    value={
                      form.probationEndDate
                        ? dayjs(form.probationEndDate as string)
                        : null
                    }
                  />
                </Field>
                <Field label="Employment Type *">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={form.employmentType || undefined}
                    onChange={(v) => set("employmentType", v)}
                    options={[
                      { value: "FULL_TIME", label: "Full Time" },
                      { value: "PART_TIME", label: "Part Time" },
                      { value: "CONTRACT", label: "Contract" },
                      { value: "INTERN", label: "Intern" },
                    ]}
                  />
                </Field>
                <Field label="Status *">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={form.status || undefined}
                    onChange={(v) => set("status", v)}
                    options={[
                      { value: "ACTIVE", label: "Active" },
                      { value: "PROBATION", label: "Probation" },
                      { value: "CONFIRMED", label: "Confirmed" },
                      { value: "RESIGNED", label: "Resigned" },
                      { value: "EXITED", label: "Exited" },
                    ]}
                  />
                </Field>
                <Field label="Branch *">
                  <AntSelect
                    style={{ width: "100%" }}
                    allowClear
                    value={form.branchId || undefined}
                    onChange={(v) => set("branchId", v ?? "")}
                    options={(branches.data ?? []).map((b: any) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                </Field>
                <Field label="Department *">
                  <AntSelect
                    style={{ width: "100%" }}
                    allowClear
                    value={form.departmentId || undefined}
                    onChange={(v) => set("departmentId", v ?? "")}
                    options={(departments.data ?? []).map((d: any) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                  />
                </Field>
                <Field label="Designation *">
                  <AntSelect
                    style={{ width: "100%" }}
                    allowClear
                    value={form.designationId || undefined}
                    onChange={(v) => set("designationId", v ?? "")}
                    options={(designations.data ?? []).map((d: any) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                  />
                </Field>
                <Field label="Shift *">
                  <AntSelect
                    style={{ width: "100%" }}
                    allowClear
                    value={form.shiftId || undefined}
                    onChange={(v) => set("shiftId", v ?? "")}
                    options={(shifts.data ?? []).map((s: any) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                  />
                </Field>
                <Field label="Login Email *">
                  <AntInput
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field label="Create Login As *">
                  <AntSelect
                    style={{ width: "100%" }}
                    value={form.loginRole || undefined}
                    onChange={(v) => set("loginRole", v)}
                    options={[
                      { value: "EMPLOYEE", label: "Employee" },
                      { value: "MANAGER", label: "Manager" },
                      // Lets a Super Admin attach a profile to an account that
                      // already has a login (e.g. the original seeded Super
                      // Admin) instead of creating a brand-new duplicate one.
                      ...(roles.includes("SUPER_ADMIN")
                        ? [{ value: "EXISTING", label: "Link Existing Login" }]
                        : []),
                    ]}
                  />
                </Field>
                {/* Reporting manager appears when creating either an EMPLOYEE or a
                    MANAGER login \u2014 a manager can report to a senior manager too. */}
                {!editingId &&
                  (form.loginRole === "EMPLOYEE" ||
                    form.loginRole === "MANAGER") && (
                    <Field label="Reporting Manager *">
                      <AntSelect
                        style={{ width: "100%" }}
                        showSearch
                        optionFilterProp="label"
                        value={form.managerId || undefined}
                        onChange={(v) => set("managerId", v)}
                        placeholder={"\u2014 Select manager \u2014"}
                        options={managerOptions}
                      />
                    </Field>
                  )}
                {!editingId && form.loginRole === "EXISTING" ? (
                  <Field label="Select Login to Link *">
                    <AntSelect
                      style={{ width: "100%" }}
                      showSearch
                      optionFilterProp="label"
                      value={form.existingUserId || undefined}
                      onChange={(v) => set("existingUserId", v)}
                      placeholder={"\u2014 Select an existing login \u2014"}
                      options={existingLoginOptions}
                    />
                  </Field>
                ) : (
                  <Field label="Login Password *">
                    <AntInput
                      value={form.password ?? "User@0412"}
                      onChange={(e) => set("password", e.target.value)}
                    />
                  </Field>
                )}
              </Grid>
            </Section>

            <Divider style={{ margin: 0 }} />

            {/* Education */}
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
              {education.length === 0 && (
                <Text type="secondary">No education added. Click "Add".</Text>
              )}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {education.map((ed, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #e5e9e9",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Qualification {i + 1}
                      </Text>
                      <AntButton
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          setEducation((a) => a.filter((_, idx) => idx !== i))
                        }
                      />
                    </div>
                    <Grid>
                      <Field label="Level (SSC / Inter / UG / PG) *">
                        <AntInput
                          value={ed.level}
                          onChange={(e) => updEdu(i, "level", e.target.value)}
                        />
                      </Field>
                      <Field label="Institution *">
                        <AntInput
                          value={ed.institution}
                          onChange={(e) =>
                            updEdu(i, "institution", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Specialization *">
                        <AntInput
                          value={ed.specialization}
                          onChange={(e) =>
                            updEdu(i, "specialization", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Percentage / CGPA *">
                        <AntInput
                          value={ed.percentage}
                          onChange={(e) =>
                            updEdu(i, "percentage", e.target.value)
                          }
                        />
                      </Field>
                      <MonthYear
                        label="From *"
                        m={ed.fromMonth}
                        y={ed.fromYear}
                        onM={(v) => updEdu(i, "fromMonth", v)}
                        onY={(v) => updEdu(i, "fromYear", v)}
                      />
                      <MonthYear
                        label="To *"
                        m={ed.toMonth}
                        y={ed.toYear}
                        onM={(v) => updEdu(i, "toMonth", v)}
                        onY={(v) => updEdu(i, "toYear", v)}
                      />
                    </Grid>
                  </div>
                ))}
              </div>
              {!editingId && (
                <DocUploadList
                  title="Educational Documents (certificates, marksheets)"
                  docs={eduDocs}
                  setDocs={setEduDocs}
                />
              )}
            </Section>

            <Divider style={{ margin: 0 }} />

            {/* Personal documents */}
            <Section title="Personal Documents">
              <Grid>
                <Field label="Aadhaar Number *">
                  <AntInput
                    value={form.aadhaarNumber ?? ""}
                    onChange={(e) => set("aadhaarNumber", e.target.value)}
                  />
                </Field>
                <Field label="PAN Number *">
                  <AntInput
                    value={form.panNumber ?? ""}
                    onChange={(e) => set("panNumber", e.target.value)}
                  />
                </Field>
                <Field label="Bank Account Number *">
                  <AntInput
                    value={form.bankAccountNumber ?? ""}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                  />
                </Field>
                <Field label="Bank Name *">
                  <AntInput
                    value={form.bankName ?? ""}
                    onChange={(e) => set("bankName", e.target.value)}
                  />
                </Field>
                {/* #6: IFSC collected for ALL employees (fresher + experienced). */}
                <Field label="IFSC Code *">
                  <AntInput
                    value={form.ifscCode ?? ""}
                    onChange={(e) => set("ifscCode", e.target.value)}
                  />
                </Field>
              </Grid>
              {!editingId && (
                <DocUploadList
                  title="Personal Documents (Aadhaar, PAN, Bank proof)"
                  docs={personalDocs}
                  setDocs={setPersonalDocs}
                />
              )}
            </Section>

            <Divider style={{ margin: 0 }} />

            {/* Fresher / Experienced */}
            <Section title="Experience">
              <Space style={{ marginBottom: 12 }}>
                <AntButton
                  type={isFresher ? "primary" : "default"}
                  onClick={() => set("isFresher", true)}
                >
                  Fresher
                </AntButton>
                <AntButton
                  type={!isFresher ? "primary" : "default"}
                  onClick={() => set("isFresher", false)}
                >
                  Experienced
                </AntButton>
              </Space>

              {!isFresher && (
                <>
                  <Grid>
                    <Field label="UAN / PF Number">
                      <AntInput
                        value={form.uanNumber ?? ""}
                        onChange={(e) => set("uanNumber", e.target.value)}
                      />
                    </Field>
                  </Grid>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      margin: "12px 0 8px",
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      Previous Employment
                    </Text>
                    <AntButton
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setExperience((a) => [...a, blankExp()])}
                    >
                      Add
                    </AntButton>
                  </div>
                  {experience.length === 0 && (
                    <Text type="secondary">
                      No experience added. Click "Add".
                    </Text>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {experience.map((ex, i) => (
                      <div
                        key={i}
                        style={{
                          border: "1px solid #e5e9e9",
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            type="secondary"
                            style={{
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Job {i + 1}
                          </Text>
                          <AntButton
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              setExperience((a) =>
                                a.filter((_, idx) => idx !== i),
                              )
                            }
                          />
                        </div>
                        <Grid>
                          <Field label="Company *">
                            <AntInput
                              value={ex.company}
                              onChange={(e) =>
                                updExp(i, "company", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Designation *">
                            <AntInput
                              value={ex.designation}
                              onChange={(e) =>
                                updExp(i, "designation", e.target.value)
                              }
                            />
                          </Field>
                          <MonthYear
                            label="From *"
                            m={ex.fromMonth}
                            y={ex.fromYear}
                            onM={(v) => updExp(i, "fromMonth", v)}
                            onY={(v) => updExp(i, "fromYear", v)}
                          />
                          <MonthYear
                            label="To *"
                            m={ex.toMonth}
                            y={ex.toYear}
                            onM={(v) => updExp(i, "toMonth", v)}
                            onY={(v) => updExp(i, "toYear", v)}
                          />
                        </Grid>
                      </div>
                    ))}
                  </div>
                  {!editingId && (
                    <DocUploadList
                      title="Experience Documents (previous company)"
                      docs={expDocs}
                      setDocs={setExpDocs}
                    />
                  )}
                </>
              )}
            </Section>
          </div>
        </AntModal>
      </div>
    </ConfigProvider>
  );
}

/* ---------- small presentational helpers ---------- */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 600,
          }}
        >
          {title}
        </Text>
        {action}
      </div>
      {children}
    </div>
  );
}
export function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}
// #9: reusable unlimited document-upload list for a section. The category is
// decided by where it's used (Personal / Educational / Experience).
function DocUploadList({
  title,
  docs,
  setDocs,
}: {
  title: string;
  docs: DocFile[];
  setDocs: React.Dispatch<React.SetStateAction<DocFile[]>>;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: 600 }}>
          {title}
          <span style={{ color: "#e11d48" }}> *</span>
        </Text>
        <AntButton
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setDocs((a) => [...a, blankDoc()])}
        >
          Add file
        </AntButton>
      </div>
      {docs.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          No files added. Click "Add file". (PDF, JPG or PNG, up to 5 MB)
        </Text>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.map((doc, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1 }}>
              <FileUpload
                label={"File " + (i + 1)}
                accept=".pdf,.jpg,.jpeg,.png"
                maxSizeMB={5}
                value={doc.fileUrl}
                onUploaded={(url, fileName) =>
                  setDocs((a) =>
                    a.map((d, idx) => {
                      if (idx !== i) return d;
                      const ext = fileName.includes(".")
                        ? (fileName.split(".").pop() ?? "")
                        : "";
                      return {
                        ...d,
                        fileUrl: url,
                        documentName: fileName || d.documentName,
                        fileType: ext || d.fileType,
                      };
                    }),
                  )
                }
              />
            </div>
            <AntButton
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDocs((a) => a.filter((_, idx) => idx !== i))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // A trailing " *" marks a required field — render the asterisk in red.
  const required = label.endsWith(" *");
  const text = required ? label.slice(0, -2) : label;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: 500 }}>
        {text}
        {required && <span style={{ color: "#e11d48" }}> *</span>}
      </Text>
      {children}
    </div>
  );
}
export function MonthYear({
  label,
  m,
  y,
  onM,
  onY,
}: {
  label: string;
  m?: number;
  y?: number;
  onM: (v: number | undefined) => void;
  onY: (v: number | undefined) => void;
}) {
  const years = Array.from(
    { length: 50 },
    (_, i) => new Date().getFullYear() - i,
  );
  return (
    <Field label={label}>
      <Space.Compact style={{ width: "100%" }}>
        <AntSelect
          style={{ width: "50%" }}
          placeholder="Month"
          allowClear
          value={m || undefined}
          onChange={(v) => onM(v)}
          options={MONTHS.map((mo, idx) => ({ value: idx + 1, label: mo }))}
        />
        <AntSelect
          style={{ width: "50%" }}
          placeholder="Year"
          allowClear
          value={y || undefined}
          onChange={(v) => onY(v)}
          options={years.map((yr) => ({ value: yr, label: yr }))}
        />
      </Space.Compact>
    </Field>
  );
}
