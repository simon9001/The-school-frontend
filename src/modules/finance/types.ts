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
