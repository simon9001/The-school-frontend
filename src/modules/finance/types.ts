export type AccountType = 'asset' | 'liability' | 'net_assets' | 'revenue' | 'expense'
export type NormalBalance = 'debit' | 'credit'

export interface Account {
  id: number
  code: string
  name: string
  type: AccountType
  normalBalance: NormalBalance
  parentId: number | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type NewAccountValues = {
  code: string
  name: string
  type: AccountType
  normalBalance: NormalBalance
  parentId?: number
  description?: string
}

export type RestrictionType = 'unrestricted' | 'restricted'

export interface Fund {
  id: number
  code: string
  name: string
  restrictionType: RestrictionType
  restrictionNotes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type NewFundValues = {
  code: string
  name: string
  restrictionType: RestrictionType
  restrictionNotes?: string
}

export type FiscalPeriodStatus = 'open' | 'closed'

export interface FiscalPeriod {
  id: number
  name: string
  fiscalYear: number
  term: number | null
  startDate: string
  endDate: string
  status: FiscalPeriodStatus
  closedAt: string | null
  createdAt: string
}

export type NewPeriodValues = {
  name: string
  fiscalYear: number
  /** 1-3, or omitted for a full-year period. */
  term?: number
  startDate: string
  endDate: string
}

export type UpdatePeriodValues = Partial<NewPeriodValues>

export interface TrialBalanceRow {
  accountId: number
  code: string
  name: string
  type: AccountType
  normalBalance: NormalBalance
  totalDebit: number
  totalCredit: number
  balance: number
}

export interface TrialBalanceResult {
  asOfDate: string
  fundId: number | null
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
}

export type JournalStatus = 'draft' | 'pending_approval' | 'posted' | 'rejected' | 'reversed'

export interface JournalEntry {
  id: number
  entryNo: string
  periodId: number
  entryDate: string
  description: string
  sourceModule: string
  sourceReference: string | null
  status: JournalStatus
  reversalOfId: number | null
  createdBy: number
  submittedAt: string | null
  approvedBy: number | null
  approvedAt: string | null
  rejectionReason: string | null
  postedBy: number | null
  postedAt: string | null
  createdAt: string
}

export interface JournalLine {
  id: number
  journalEntryId: number
  lineNo: number
  accountId: number
  fundId: number
  debit: string
  credit: string
  description: string | null
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[]
}

export type NewJournalLineValues = {
  accountId: number
  fundId: number
  debit?: number
  credit?: number
  description?: string
}

export type NewJournalEntryValues = {
  periodId: number
  entryDate: string
  description: string
  sourceModule: string
  sourceReference?: string
  createdBy: number
  lines: NewJournalLineValues[]
}
