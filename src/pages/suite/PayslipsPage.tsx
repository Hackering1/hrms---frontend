import CompensationRecordsTable from "./CompensationRecordsTable";

export default function PayslipsPage() {
  return <div className="space-y-3">
    <p className="text-sm text-slate-600">Payslips are restricted to payroll administrators and Finance. Employees receive their own approved payslip by email and cannot view payroll records in the portal.</p>
    <CompensationRecordsTable endpoint="/hr-suite/payslips" queryKey="suite-payslips" title="Payslips" />
  </div>;
}
