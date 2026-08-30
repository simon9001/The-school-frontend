export interface InventoryItem {
  id: number
  itemCode: string
  name: string
  unit: string
  category: string | null
  reorderLevel: string | null
}

export type NewInventoryItemValues = {
  itemCode: string
  name: string
  unit: string
  category?: string
  reorderLevel?: number
}

export type StockMovementType = 'receipt' | 'issue' | 'adjustment'

export interface StockMovement {
  id: number
  itemId: number
  movementDate: string
  movementType: StockMovementType
  quantity: string
  unitCost: string | null
  reference: string | null
  journalEntryId: number | null
}

export type ReceiveStockValues = {
  itemId: number
  movementDate: string
  quantity: number
  unitCost: number
  reference?: string
  periodId: number
  fundId: number
  inventoryAccountId: number
  creditAccountId: number
  recordedBy: number
}

export type IssueStockValues = {
  itemId: number
  movementDate: string
  quantity: number
  unitCost: number
  reference?: string
  periodId: number
  fundId: number
  inventoryAccountId: number
  expenseAccountId: number
  recordedBy: number
}
