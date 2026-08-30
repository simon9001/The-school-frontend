export interface GrantType {
  id: number
  name: string
  fundId: number
  revenueAccountId: number
  conditionsDescription: string | null
}

export interface GrantDisbursement {
  id: number
  grantTypeId: number
  periodId: number
  expectedAmount: string | null
  amountReceived: string
  dateReceived: string
  conditionsMet: boolean
  journalEntryId: number | null
  notes: string | null
  recordedBy: number
  createdAt: string
}

export type NewGrantTypeValues = {
  name: string
  fundId: number
  revenueAccountId: number
  conditionsDescription?: string
}

export type NewDisbursementValues = {
  grantTypeId: number
  periodId: number
  cashAccountId: number
  expectedAmount?: number
  amountReceived: number
  dateReceived: string
  conditionsMet: boolean
  notes?: string
  recordedBy: number
}
