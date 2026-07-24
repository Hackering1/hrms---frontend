// Matches the Spring Boot ApiResponse envelope: { success, message, data, timestamp }
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  roles: string[];
  mustChangePassword: boolean;
}

// ----- Organization entities (mirror the backend JPA entities) -----
export interface Branch {
  id?: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isActive?: boolean;
}

export interface Department {
  id?: number;
  name: string;
  code: string;
  branchId?: number;
  description?: string;
  isActive?: boolean;
}

export interface Designation {
  id?: number;
  name: string;
  code: string;
  departmentId?: number;
  level?: number;
  isActive?: boolean;
}

export interface Shift {
  id?: number;
  name: string;
  startTime: string; // "09:00:00"
  endTime: string;
  graceMinutes?: number;
  isNightShift?: boolean;
  isActive?: boolean;
}

export interface Holiday {
  id?: number;
  name: string;
  holidayDate: string; // "2026-01-26"
  type?: string;
  description?: string;
}

// ----- Education & Experience (nested under an employee) -----
export interface Education {
  id?: number;
  level: string; // SSC / Intermediate / UG / PG ...
  institution?: string;
  specialization?: string;
  percentage?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  documentUrl?: string;
}

export interface Experience {
  id?: number;
  company: string;
  designation?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
}

// ----- Employee entity (mirrors the backend Employee response) -----
export interface Employee {
  id?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  profilePhotoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  nationality?: string;
  dateOfJoining: string;
  employmentType?: string;
  status?: string;
  branchId?: number;
  branchName?: string;
  departmentId?: number;
  departmentName?: string;
  designationId?: number;
  designationName?: string;
  shiftId?: number;
  shiftName?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  // reporting manager (resolved from employee_managers on the backend)
  reportingManagerId?: string;
  reportingManagerName?: string;
  // personal documents + fresher flag
  isFresher?: boolean;
  aadhaarNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  uanNumber?: string;
  // auto-login
  email?: string;
  loginRole?: string; // EMPLOYEE | MANAGER (request only)
  tempPassword?: string; // returned once after auto-creating a login
  // nested
  education?: Education[];
  experience?: Experience[];
}

// Generic record used by the reusable resource table/form
export type ResourceRecord = Record<string, any> & { id?: number | string };

export type FieldType =
  | "text"
  | "number"
  | "time"
  | "date"
  | "textarea"
  | "checkbox"
  | "select";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  // when a select should send a numeric value (e.g. a foreign-key id), set true
  numeric?: boolean;
  // optional group heading for sectioned forms (e.g. "Personal", "Job")
  section?: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
}

export interface ResourceConfig {
  title: string;
  endpoint: string; // e.g. "/branches"
  queryKey: string; // e.g. "branches"
  columns: ColumnConfig[];
  fields: FieldConfig[];
}
