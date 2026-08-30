export type DepreciationMethod = 'straight_line' | 'reducing_balance'
export type AssetStatus = 'in_use' | 'disposed' | 'written_off'

export interface AssetCategory {
  id: number
  name: string
  defaultUsefulLifeYears: number
  depreciationMethod: DepreciationMethod
  assetAccountId: number
  depreciationExpenseAccountId: number
  accumulatedDepreciationAccountId: number
}

export type NewAssetCategoryValues = {
  name: string
  defaultUsefulLifeYears: number
  depreciationMethod: DepreciationMethod
  assetAccountId: number
  depreciationExpenseAccountId: number
  accumulatedDepreciationAccountId: number
}

export interface Asset {
  id: number
  assetTag: string
  categoryId: number
  name: string
  description: string | null
  acquisitionDate: string
  acquisitionCost: string
  fundId: number
  location: string | null
  status: AssetStatus
  journalEntryId: number | null
}

export type AcquireAssetValues = {
  assetTag: string
  categoryId: number
  name: string
  description?: string
  acquisitionDate: string
  acquisitionCost: number
  fundId: number
  location?: string
  periodId: number
  creditAccountId: number
  createdBy: number
}

export interface DepreciationEntry {
  id: number
  assetId: number
  periodId: number
  amount: string
  journalEntryId: number | null
}

export type RunDepreciationValues = {
  periodId: number
  asOfDate: string
  createdBy: number
}

export interface AssetDisposal {
  id: number
  assetId: number
  disposalDate: string
  proceeds: string
  netBookValueAtDisposal: string
  journalEntryId: number | null
}

export type DisposeAssetValues = {
  disposalDate: string
  periodId: number
  proceeds: number
  cashAccountId: number
  gainLossAccountId: number
  recordedBy: number
}
