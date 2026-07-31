import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  User,
  FileText,
  CalendarClock,
  CalendarCheck,
  FileSignature,
} from "lucide-react";
import Card from "../../components/ui/Card";
import ProfilePhoto from "../../components/ProfilePhoto";
import Spinner from "../../components/ui/Spinner";
import { useRole } from "../../hooks/useRole";
import { selfService } from "../../services/selfService";
import { attendanceService } from "../../services/attendanceService";
import { documentService } from "../../services/documentService";
import { letterService } from "../../services/letterService";
import { fileService } from "../../services/fileService";
import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../utils/types";

type Tab = "profile" | "documents" | "attendance" | "leave" | "letters";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "attendance", label: "Attendance", icon: CalendarClock },
  { key: "leave", label: "Leave", icon: CalendarCheck },
  { key: "letters", label: "Letters", icon: FileSignature },
];

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

const MONTHS = [
  "",
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
function monthYear(m?: number, y?: number) {
  if (!y) return "—";
  return `${m ? MONTHS[m] + " " : ""}${y}`;
}

export default function MyProfilePage() {
  const [tab, setTab] = useState<Tab>("profile");
  const { isSuperAdmin } = useRole();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: selfService.me,
    retry: false,
  });
  const employeeId = me.data?.id;

  const documents = useQuery({
    queryKey: ["my-documents", employeeId],
    queryFn: () => documentService.byEmployee(employeeId!),
    enabled: !!employeeId && tab === "documents",
  });
  const attendance = useQuery({
    queryKey: ["my-attendance", employeeId],
    queryFn: () => attendanceService.history(employeeId!),
    enabled: !!employeeId && tab === "attendance",
  });
  const leave = useQuery({
    queryKey: ["my-leave", employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<any[]>>(
        `/leave-requests/employee/${employeeId}`,
      );
      return data.data;
    },
    enabled: !!employeeId && tab === "leave",
  });
  const letters = useQuery({
    queryKey: ["my-letters", employeeId],
    queryFn: () => letterService.byEmployee(employeeId!),
    enabled: !!employeeId && tab === "letters",
  });

  if (me.isLoading) return <Spinner />;
  // #5: Super Admin is a system/CEO account with no employee profile.
  if (isSuperAdmin) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            No personal profile
          </p>
          <p className="max-w-sm text-xs text-slate-500">
            You're signed in as a Super Admin — a system account without an
            employee profile. Manage the organisation from the Admin and People
            sections instead.
          </p>
        </div>
      </Card>
    );
  }
  if (me.isError) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <User size={22} />
          </div>
          <h2 className="text-base font-semibold text-slate-800">
            Profile not set up yet
          </h2>
          <p className="max-w-md text-sm text-slate-600">
            Your login isn't connected to an employee record yet. Please contact
            your HR administrator to set up your profile.
          </p>
        </div>
      </Card>
    );
  }

  const e = me.data!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <ProfilePhoto
          photoUrl={e.profilePhotoUrl}
          name={`${e.firstName ?? ""} ${e.lastName ?? ""}`}
        />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {e.firstName} {e.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {e.employeeCode} · {e.designationName ?? "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "profile" && (
        <Card>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Employee Code" value={e.employeeCode} />
            <Field label="First Name" value={e.firstName} />
            <Field label="Last Name" value={e.lastName} />
            <Field label="Gender" value={e.gender} />
            <Field label="Date of Birth" value={e.dateOfBirth} />
            <Field label="Blood Group" value={e.bloodGroup} />
            <Field label="Marital Status" value={e.maritalStatus} />
            <Field label="Nationality" value={e.nationality} />
            <Field label="Date of Joining" value={e.dateOfJoining} />
            <Field label="Employment Type" value={e.employmentType} />
            <Field label="Status" value={e.status} />
            <Field label="Branch" value={e.branchName} />
            <Field label="Department" value={e.departmentName} />
            <Field label="Designation" value={e.designationName} />
            <Field label="Shift" value={e.shiftName} />
            <Field label="Reporting Manager" value={e.reportingManagerName} />
            <Field
              label="Type"
              value={e.isFresher ? "Fresher" : "Experienced"}
            />
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Personal Documents
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Aadhaar" value={e.aadhaarNumber} />
              <Field label="PAN" value={e.panNumber} />
              <Field label="Bank A/C" value={e.bankAccountNumber} />
              <Field label="Bank Name" value={e.bankName} />
              <Field label="IFSC" value={e.ifscCode} />
              <Field label="UAN / PF" value={e.uanNumber} />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Education
            </h3>
            {(e.education ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No education records.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Level</th>
                    <th className="py-2 pr-4 font-medium">Institution</th>
                    <th className="py-2 pr-4 font-medium">Specialization</th>
                    <th className="py-2 pr-4 font-medium">%</th>
                    <th className="py-2 pr-4 font-medium">From</th>
                    <th className="py-2 pr-4 font-medium">To</th>
                  </tr>
                </thead>
                <tbody>
                  {(e.education ?? []).map((ed: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-700">{ed.level}</td>
                      <td className="py-2 pr-4 text-slate-700">
                        {ed.institution ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {ed.specialization ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {ed.percentage ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {monthYear(ed.fromMonth, ed.fromYear)}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {monthYear(ed.toMonth, ed.toYear)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!e.isFresher && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Work Experience
              </h3>
              {(e.experience ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No experience records.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Company</th>
                      <th className="py-2 pr-4 font-medium">Designation</th>
                      <th className="py-2 pr-4 font-medium">From</th>
                      <th className="py-2 pr-4 font-medium">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(e.experience ?? []).map((ex: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 pr-4 text-slate-700">
                          {ex.company}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">
                          {ex.designation ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">
                          {monthYear(ex.fromMonth, ex.fromYear)}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">
                          {monthYear(ex.toMonth, ex.toYear)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === "documents" && (
        <Card className="p-0">
          {documents.isLoading ? (
            <Spinner />
          ) : (documents.data ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No documents.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">File</th>
                </tr>
              </thead>
              <tbody>
                {(documents.data ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {d.documentName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {d.fileType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {d.expiryDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => fileService.openFile(d.fileUrl)}
                        className="text-indigo-600 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "attendance" && (
        <Card className="p-0">
          {attendance.isLoading ? (
            <Spinner />
          ) : (attendance.data ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No attendance records.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">In</th>
                  <th className="px-4 py-3 font-medium">Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(attendance.data ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {a.attendanceDate}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.checkInTime
                        ? new Date(a.checkInTime).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.checkOutTime
                        ? new Date(a.checkOutTime).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {a.workingHours ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "leave" && (
        <Card className="p-0">
          {leave.isLoading ? (
            <Spinner />
          ) : (leave.data ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No leave requests.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(leave.data ?? []).map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{l.fromDate}</td>
                    <td className="px-4 py-3 text-slate-700">{l.toDate}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {l.numberOfDays}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{l.reason}</td>
                    <td className="px-4 py-3 text-slate-700">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "letters" && (
        <Card className="p-0">
          {letters.isLoading ? (
            <Spinner />
          ) : (letters.data ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No letters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(letters.data ?? []).map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{l.letterType}</td>
                    <td className="px-4 py-3 text-slate-700">{l.letterDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
