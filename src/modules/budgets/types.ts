export type BudgetStatus = 'draft' | 'approved' | 'revised'

export interface Budget {
  id: number
  fiscalYear: number
  name: string
  status: BudgetStatus
  createdBy: number
  approvedBy: number | null
  approvedAt: string | null
  createdAt: string
}

export interface BudgetLineRow {
  line: {
    id: number
    budgetId: number
    accountId: number
    fundId: number
    periodId: number | null
    amount: string
  }
  accountCode: string
  accountName: string
  accountNormalBalance: 'debit' | 'credit'
  fundCode: string
  periodStart: string | null
  periodEnd: string | null
}

export interface BudgetWithLines extends Budget {
  lines: BudgetLineRow[]
}

export interface BudgetVsActualRow {
  accountId: number
  accountCode: string
  accountName: string
  fundId: number
  fundCode: string
  budgeted: number
  actual: number
  variance: number
}

export type NewBudgetLineValues = {
  accountId: number
  fundId: number
  periodId?: number
  amount: number
}

export type NewBudgetValues = {
  fiscalYear: number
  name: string
  createdBy: number
  lines: NewBudgetLineValues[]
}
