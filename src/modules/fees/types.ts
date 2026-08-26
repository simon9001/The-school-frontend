export type FeeStructureStatus = 'draft' | 'active'
export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'
export type PaymentMethod = 'cash' | 'bank' | 'mpesa' | 'cheque'

export interface FeeStructureItem {
  id: number
  feeStructureId: number
  accountId: number
  fundId: number
  description: string
  amount: string
}

export interface FeeStructure {
  id: number
  fiscalYear: number
  periodId: number
  classId: number
  boardingStatus: 'day' | 'boarder'
  status: FeeStructureStatus
  createdAt: string
}

export interface FeeStructureWithItems extends FeeStructure {
  items: FeeStructureItem[]
}

export interface FeeInvoiceItem {
  id: number
  invoiceId: number
  accountId: number
  fundId: number
  description: string
  amount: string
}

export interface FeeInvoice {
  id: number
  invoiceNo: string
  studentId: number
  periodId: number
  feeStructureId: number | null
  invoiceDate: string
  totalAmount: string
  status: InvoiceStatus
  journalEntryId: number | null
  createdAt: string
}

export interface FeeInvoiceWithItems extends FeeInvoice {
  items: FeeInvoiceItem[]
}

export interface FeePayment {
  id: number
  receiptNo: string
  studentId: number
  paymentDate: string
  amount: string
  paymentMethod: PaymentMethod
  referenceNo: string | null
  journalEntryId: number | null
  receivedBy: number
  createdAt: string
}

// ---- Create payloads ----

export type NewFeeStructureItemValues = {
  accountId: number
  fundId: number
  description: string
  amount: number
}

export type NewFeeStructureValues = {
  fiscalYear: number
  periodId: number
  classId: number
  boardingStatus: 'day' | 'boarder'
  items: NewFeeStructureItemValues[]
}

export type NewInvoiceValues = {
  studentId: number
  periodId: number
  feeStructureId: number
  invoiceDate: string
  debtorsAccountId: number
  createdBy: number
}

export type NewPaymentValues = {
  studentId: number
  invoiceId: number
  paymentDate: string
  amount: number
  paymentMethod: PaymentMethod
  referenceNo?: string
  cashAccountId: number
  debtorsAccountId: number
  periodId: number
  receivedBy: number
}
