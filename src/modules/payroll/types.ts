export type EmploymentType = 'permanent' | 'contract' | 'casual'
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated'
export type SalaryComponentType = 'basic' | 'allowance' | 'deduction'
export type PayrollRunStatus = 'draft' | 'processed' | 'posted'

export interface Employee {
  id: number
  staffNo: string
  fullName: string
  idNumber: string | null
  kraPin: string | null
  nssfNo: string | null
  shifNo: string | null
  jobTitle: string | null
  employmentType: EmploymentType
  bankName: string | null
  bankAccountNo: string | null
  status: EmployeeStatus
  employmentDate: string
}

export interface SalaryComponent {
  id: number
  employeeId: number
  componentType: SalaryComponentType
  name: string
  amount: string
  isPercentageOfBasic: boolean
}

export interface PayrollRun {
  id: number
  periodId: number
  monthYear: string
  status: PayrollRunStatus
  processedBy: number | null
  processedAt: string | null
  journalEntryId: number | null
}

export interface Payslip {
  id: number
  payrollRunId: number
  employeeId: number
  grossPay: string
  paye: string
  nssf: string
  shif: string
  otherDeductions: string
  netPay: string
}

export interface PayrollRunWithPayslips extends PayrollRun {
  payslips: Payslip[]
}

// ---- Create payloads ----

export type NewEmployeeValues = {
  staffNo: string
  fullName: string
  idNumber?: string
  kraPin?: string
  nssfNo?: string
  shifNo?: string
  jobTitle?: string
  employmentType: EmploymentType
  bankName?: string
  bankAccountNo?: string
  employmentDate: string
}

export type NewSalaryComponentValues = {
  componentType: SalaryComponentType
  name: string
  amount: number
  isPercentageOfBasic: boolean
}

export type NewPayrollRunValues = {
  periodId: number
  monthYear: string
}

export type ProcessPayrollRunValues = {
  fundId: number
  salariesExpenseAccountId: number
  payeAccountId: number
  nssfAccountId: number
  shifAccountId: number
  otherDeductionsAccountId?: number
  netPayAccountId: number
  entryDate: string
  processedBy: number
}
