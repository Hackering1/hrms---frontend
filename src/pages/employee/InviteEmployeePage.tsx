import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Typography,
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  DatePicker,
} from "antd";
import dayjs from "dayjs";
import { resourceService } from "../../services/resourceService";
import type { ResourceRecord } from "../../utils/types";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

interface InviteForm {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  dateOfJoining?: string;
  email?: string;
  loginRole?: string;
}

/**
 * Super Admin's "Invite Employee" — deliberately tiny (8 fields only): the
 * candidate fills in everything else themselves via the emailed onboarding
 * link. This is a SEPARATE flow from the classic Add Employee form on
 * EmployeesPage.tsx, which is untouched by this feature.
 */
export default function InviteEmployeePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<InviteForm>({});

  const set = (k: keyof InviteForm, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const defaults = useQuery({
    queryKey: ["employees", "new-defaults"],
    queryFn: () =>
      resourceService.get<{ employeeCode: string }>("/employees/new-defaults"),
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => resourceService.list("/departments"),
  });
  const designations = useQuery({
    queryKey: ["designations"],
    queryFn: () => resourceService.list("/designations"),
  });

  // Managers available as "Reporting Manager" — same source list the classic
  // Add Employee form uses, filtered to people whose login role is MANAGER
  // or SUPER_ADMIN (so a Manager can be set up to report directly to a
  // Super Admin, e.g. a Chief Executive Manager).
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => resourceService.list("/employees"),
  });
  const users = useQuery({
    queryKey: ["activeUsers"],
    queryFn: () => resourceService.list("/users"),
  });
  const rolesByUserId = new Map<string, string[]>();
  const rolesByEmail = new Map<string, string[]>();
  for (const u of (users.data ?? []) as any[]) {
    const rs: string[] = Array.isArray(u.roles) ? u.roles : [];
    if (u.id != null) rolesByUserId.set(String(u.id), rs);
    if (u.email) rolesByEmail.set(String(u.email).toLowerCase(), rs);
  }
  const rowRoles = (row: any): string[] => {
    if (row.userId && rolesByUserId.has(String(row.userId)))
      return rolesByUserId.get(String(row.userId))!;
    const em = String(row.email ?? "").toLowerCase();
    return rolesByEmail.get(em) ?? [];
  };
  const managerOptions = ((employees.data ?? []) as ResourceRecord[])
    .filter(
      (r) =>
        rowRoles(r).includes("MANAGER") || rowRoles(r).includes("SUPER_ADMIN"),
    )
    .map((r) => ({
      value: r.id,
      label: r.employeeCode + " — " + r.firstName + " " + r.lastName,
    }));

  const employeeCode = form.employeeCode || defaults.data?.employeeCode || "";

  const send = useMutation({
    mutationFn: () =>
      resourceService.create("/employees/invite", {
        employeeCode: employeeCode || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        departmentId: form.departmentId,
        designationId: form.designationId,
        managerId: form.managerId,
        dateOfJoining: form.dateOfJoining,
        email: form.email,
        loginRole: form.loginRole,
      }),
    onSuccess: () => {
      toast.success(
        "Invitation sent — the candidate will receive an email shortly.",
      );
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees", "invitations"] });
      navigate("/employees/invitations");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Couldn't send the invitation",
      );
    },
  });

  const missing: string[] = [];
  const required: [unknown, string][] = [
    [form.firstName, "First Name"],
    [form.lastName, "Last Name"],
    [form.departmentId, "Department"],
    [form.designationId, "Designation"],
    [form.dateOfJoining, "Date of Joining"],
    [form.email, "Login Email"],
    [form.loginRole, "Create Login As"],
  ];
  // A Super Admin sits at the top of the reporting hierarchy, so they don't
  // need a reporting manager themselves — everyone else still does.
  if (form.loginRole !== "SUPER_ADMIN") {
    required.push([form.managerId, "Reporting Manager"]);
  }
  for (const [val, label] of required) {
    if (val === undefined || val === null || String(val).trim() === "") {
      missing.push(label);
    }
  }

  const handleSend = () => {
    if (missing.length > 0) {
      toast.error("Please fill: " + missing.join(", "));
      return;
    }
    send.mutate();
  };

  return (
    <ConfigProvider theme={theme}>
      <div style={{ padding: 24, maxWidth: 640 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Invite Employee
        </Title>
        <Text type="secondary">
          Send a secure onboarding link — the candidate fills in the rest of
          their profile themselves.
        </Text>

        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Field label="Employee Code">
            <AntInput
              value={employeeCode}
              onChange={(e) => set("employeeCode", e.target.value)}
              placeholder="Auto-generated"
            />
          </Field>
          <div />

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

          <Field label="Department *">
            <AntSelect
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="label"
              value={form.departmentId}
              onChange={(v) => set("departmentId", v)}
              options={((departments.data ?? []) as ResourceRecord[]).map(
                (d) => ({
                  value: d.id,
                  label: d.name,
                }),
              )}
            />
          </Field>
          <Field label="Designation *">
            <AntSelect
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="label"
              value={form.designationId}
              onChange={(v) => set("designationId", v)}
              options={((designations.data ?? []) as ResourceRecord[]).map(
                (d) => ({
                  value: d.id,
                  label: d.name,
                }),
              )}
            />
          </Field>

          <Field
            label={
              form.loginRole === "SUPER_ADMIN"
                ? "Reporting Manager"
                : "Reporting Manager *"
            }
          >
            <AntSelect
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="label"
              value={form.managerId}
              onChange={(v) => set("managerId", v)}
              placeholder="— Select manager —"
              options={managerOptions}
              allowClear
            />
          </Field>
          <Field label="Date of Joining *">
            <DatePicker
              style={{ width: "100%" }}
              value={form.dateOfJoining ? dayjs(form.dateOfJoining) : undefined}
              onChange={(d) =>
                set("dateOfJoining", d ? d.format("YYYY-MM-DD") : undefined)
              }
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
              value={form.loginRole}
              onChange={(v) => set("loginRole", v)}
              options={[
                { value: "EMPLOYEE", label: "Employee" },
                { value: "MANAGER", label: "Manager" },
              ]}
            />
          </Field>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <AntButton
            type="primary"
            loading={send.isPending}
            onClick={handleSend}
          >
            Send Invitation
          </AntButton>
          <AntButton onClick={() => navigate("/employees")}>Cancel</AntButton>
        </div>
      </div>
    </ConfigProvider>
  );
}
