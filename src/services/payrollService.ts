import { apiClient } from "./apiClient";
import type { ApiResponse } from "../utils/types";

// ── Types (mirror backend DTOs in com.technnext.hrms.payroll.dto) ─────────

export interface SalaryComponent {
  id?: number;
  name: string;
  code: string;
  componentType: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
  calculationType: "FLAT" | "PERCENT_OF_CTC" | "PERCENT_OF_BASIC" | "REMAINDER";
  defaultPercentage?: number | null;
  isTaxable?: boolean;
  isStatutory?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export interface SalaryStructureComponentLine {
  salaryComponentId: number;
  componentName?: string;
  componentCode?: string;
  componentType?: string;
  calculationType: string;
  percentage?: number | null;
  flatAmount?: number | null;
  isStatutory?: boolean;
  displayOrder?: number;
}

export interface SalaryStructure {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  components: SalaryStructureComponentLine[];
}

export interface EmployeeSalaryComponentBreakup {
  componentName: string;
  componentType: string;
  monthlyAmount: number;
  annualAmount: number;
}

export interface EmployeeSalary {
  id: number;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  salaryStructureId: number;
  salaryStructureName?: string;
  annualCtc: number;
  monthlyGross: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  taxRegime: "NEW" | "OLD";
  pfApplicable: boolean;
  ptApplicable: boolean;
  tdsOverrideMonthly?: number | null;
  components: EmployeeSalaryComponentBreakup[];
}

export interface EmployeeSalaryAssignRequest {
  employeeId: string;
  salaryStructureId: number;
  annualCtc: number;
  effectiveFrom: string;
  taxRegime?: "NEW" | "OLD";
  pfApplicable?: boolean;
  ptApplicable?: boolean;
  tdsOverrideMonthly?: number | null;
  bankAccountNumber?: string;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: "DRAFT" | "PROCESSED" | "APPROVED" | "PAID" | "CANCELLED";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  processedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  remarks?: string | null;
}

export interface PayslipLine {
  name: string;
  amount: number;
}

export interface Payslip {
  id: number;
  payrollRunId: number;
  month: number;
  year: number;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
  pfEmployee: number;
  pfEmployer: number;
  ptAmount: number;
  tdsAmount: number;
  status: "GENERATED" | "PAID" | "HELD";
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  employerContributions: PayslipLine[];
}

export interface PayrollAdjustment {
  id?: number;
  employeeId: string;
  month: number;
  year: number;
  adjustmentType: "EARNING" | "DEDUCTION";
  label: string;
  amount: number;
  isTaxable?: boolean;
  remarks?: string;
  appliedInRunId?: number | null;
}

export interface PfSettings {
  id?: number;
  isEnabled: boolean;
  employeeRatePercent: number;
  employerRatePercent: number;
  epsRatePercent: number;
  wageCeiling: number;
  epsWageCeiling: number;
  effectiveFrom: string;
}

export interface PtSlab {
  id?: number;
  state: string;
  gender: "ALL" | "MALE" | "FEMALE";
  minSalary: number;
  maxSalary?: number | null;
  monthlyAmount: number;
  februaryAmount?: number | null;
  effectiveFrom?: string;
  isActive?: boolean;
}

export interface ComplianceReportRow {
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  grossEarnings: number;
  pfEmployee: number;
  pfEmployer: number;
  ptAmount: number;
  tdsAmount: number;
  netPay: number;
}

export interface ComplianceReport {
  payrollRunId: number;
  month: number;
  year: number;
  totalPfEmployee: number;
  totalPfEmployer: number;
  totalPt: number;
  totalTds: number;
  rows: ComplianceReportRow[];
}

export interface PayoutTransactionRow {
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  transferId: string;
  status: "RECEIVED" | "PENDING" | "SUCCESS" | "FAILED" | "REVERSED" | string;
  statusDescription?: string;
  amount: number;
  utr?: string;
}

export interface PayoutSkippedRow {
  employeeId: string;
  employeeCode?: string;
  reason: string;
}

export interface PayoutBatch {
  id: number;
  payrollRunId: number;
  batchTransferId: string;
  cfBatchTransferId?: string;
  status:
    | "INITIATED"
    | "RECEIVED"
    | "PROCESSING"
    | "COMPLETED"
    | "PARTIALLY_FAILED"
    | "FAILED"
    | string;
  totalAmount: number;
  employeeCount: number;
  environment: "TEST" | "PROD" | string;
  initiatedAt: string;
  lastStatusCheckAt?: string;
  transactions: PayoutTransactionRow[];
  skipped: PayoutSkippedRow[];
}

export interface TaxSlab {
  id?: number;
  financialYear: string; // e.g. "2026-27"
  regime: "NEW" | "OLD";
  fromAmount: number;
  toAmount?: number | null;
  ratePercent: number;
}

export interface TaxSettings {
  id?: number;
  financialYear: string;
  standardDeduction: number;
  rebate87aIncomeLimit: number;
  rebate87aAmount: number;
  cessPercent: number;
}

// ── API calls ───────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const { data } = await apiClient.get<ApiResponse<T>>(path);
  return data.data;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post<ApiResponse<T>>(path, body);
  return data.data;
}
async function put<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.put<ApiResponse<T>>(path, body);
  return data.data;
}
async function del<T>(path: string): Promise<T> {
  const { data } = await apiClient.delete<ApiResponse<T>>(path);
  return data.data;
}

export const payrollService = {
  // Salary structures (custom endpoints — nested components, not plain CRUD)
  listStructures: () => get<SalaryStructure[]>("/payroll/salary-structures"),
  getStructure: (id: number) =>
    get<SalaryStructure>(`/payroll/salary-structures/${id}`),
  createStructure: (body: SalaryStructure) =>
    post<SalaryStructure>("/payroll/salary-structures", body),
  updateStructure: (id: number, body: SalaryStructure) =>
    put<SalaryStructure>(`/payroll/salary-structures/${id}`, body),
  deleteStructure: (id: number) =>
    del<void>(`/payroll/salary-structures/${id}`),

  // Employee salary assignment
  salaryHistory: (employeeId: string) =>
    get<EmployeeSalary[]>(`/payroll/employee-salaries/employee/${employeeId}`),
  currentSalary: (employeeId: string, asOf?: string) =>
    get<EmployeeSalary | null>(
      `/payroll/employee-salaries/employee/${employeeId}/current${asOf ? `?asOf=${asOf}` : ""}`,
    ),
  assignSalary: (body: EmployeeSalaryAssignRequest) =>
    post<EmployeeSalary>("/payroll/employee-salaries", body),

  // Payroll runs
  listRuns: () => get<PayrollRun[]>("/payroll/runs"),
  getRun: (id: number) => get<PayrollRun>(`/payroll/runs/${id}`),
  processRun: (month: number, year: number) =>
    post<PayrollRun>("/payroll/runs/process", { month, year }),
  approveRun: (id: number) => put<PayrollRun>(`/payroll/runs/${id}/approve`),
  markRunPaid: (id: number) => put<PayrollRun>(`/payroll/runs/${id}/mark-paid`),
  cancelRun: (id: number) => del<void>(`/payroll/runs/${id}`),

  // Payslips
  payslipsForRun: (runId: number) =>
    get<Payslip[]>(`/payroll/payslips/run/${runId}`),
  payslipsForEmployee: (employeeId: string) =>
    get<Payslip[]>(`/payroll/payslips/employee/${employeeId}`),
  getPayslip: (id: number) => get<Payslip>(`/payroll/payslips/${id}`),
  resendPayslipEmail: (id: number) =>
    post<void>(`/payroll/payslips/${id}/resend-email`),
  payslipPdfUrl: (id: number) =>
    `${apiClient.defaults.baseURL}/payroll/payslips/${id}/pdf`,
  downloadPayslipPdf: async (id: number, filename: string) => {
    const response = await apiClient.get(`/payroll/payslips/${id}/pdf`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Adjustments (bonus / one-off deduction / reimbursement)
  adjustmentsForEmployeeMonth: (
    employeeId: string,
    year: number,
    month: number,
  ) =>
    get<PayrollAdjustment[]>(
      `/payroll/adjustments/employee/${employeeId}?year=${year}&month=${month}`,
    ),
  createAdjustment: (body: PayrollAdjustment) =>
    post<PayrollAdjustment>("/payroll/adjustments", body),
  deleteAdjustment: (id: number) => del<void>(`/payroll/adjustments/${id}`),

  // Compliance reports
  complianceReport: (runId: number) =>
    get<ComplianceReport>(`/payroll/reports/run/${runId}/compliance`),

  // Excel export
  exportRunUrl: (runId: number) =>
    `${apiClient.defaults.baseURL}/payroll/runs/${runId}/export`,
  downloadRunExcel: async (runId: number, filename: string) => {
    const response = await apiClient.get(`/payroll/runs/${runId}/export`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Bank payout (Cashfree Payouts) — only for APPROVED runs
  initiatePayout: (runId: number) =>
    post<PayoutBatch>(`/payroll/runs/${runId}/payout`),
  getPayoutStatus: (runId: number) =>
    get<PayoutBatch>(`/payroll/runs/${runId}/payout`),
  refreshPayoutStatus: (runId: number) =>
    post<PayoutBatch>(`/payroll/runs/${runId}/payout/refresh`),

  // Statutory settings
  pfCurrent: () => get<PfSettings>("/payroll/statutory/pf/current"),
  pfHistory: () => get<PfSettings[]>("/payroll/statutory/pf"),
  updatePf: (body: PfSettings) =>
    post<PfSettings>("/payroll/statutory/pf", body),
  ptSlabs: () => get<PtSlab[]>("/payroll/statutory/pt"),

  // Income tax (TDS) slabs + settings, per financial year
  taxSlabs: (financialYear: string, regime: "NEW" | "OLD" = "NEW") =>
    get<TaxSlab[]>(
      `/payroll/statutory/tax-slabs?financialYear=${financialYear}&regime=${regime}`,
    ),
  replaceTaxSlabs: (
    financialYear: string,
    regime: "NEW" | "OLD",
    slabs: TaxSlab[],
  ) =>
    put<TaxSlab[]>(
      `/payroll/statutory/tax-slabs?financialYear=${financialYear}&regime=${regime}`,
      slabs,
    ),
  taxSettings: (financialYear: string) =>
    get<TaxSettings>(
      `/payroll/statutory/tax-settings?financialYear=${financialYear}`,
    ),
  upsertTaxSettings: (body: TaxSettings) =>
    put<TaxSettings>("/payroll/statutory/tax-settings", body),
};
