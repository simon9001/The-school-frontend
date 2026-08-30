export type SupplierStatus = 'active' | 'inactive'
export type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted_to_lpo'
export type PurchaseOrderStatus = 'draft' | 'issued' | 'partially_received' | 'received' | 'cancelled'
export type SupplierInvoiceStatus = 'pending' | 'approved' | 'paid' | 'disputed'
export type PaymentMethod = 'bank' | 'cheque' | 'mpesa'

export interface Supplier {
  id: number
  name: string
  kraPin: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  bankName: string | null
  bankAccountNo: string | null
  status: SupplierStatus
}

export interface RequisitionItem {
  id: number
  requisitionId: number
  description: string
  quantity: string
  estimatedUnitCost: string | null
  accountId: number
}

export interface Requisition {
  id: number
  requisitionNo: string
  requestedBy: number
  department: string | null
  requestDate: string
  status: RequisitionStatus
  approvedBy: number | null
  approvedAt: string | null
}

export interface RequisitionWithItems extends Requisition {
  items: RequisitionItem[]
}

export interface PurchaseOrderItem {
  id: number
  purchaseOrderId: number
  description: string
  quantity: string
  unitCost: string
  accountId: number
}

export interface PurchaseOrder {
  id: number
  lpoNo: string
  supplierId: number
  requisitionId: number | null
  orderDate: string
  status: PurchaseOrderStatus
  totalAmount: string
  approvedBy: number | null
  approvedAt: string | null
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[]
}

export interface GoodsReceivedNote {
  id: number
  grnNo: string
  purchaseOrderId: number
  receivedDate: string
  receivedBy: number
}

export interface SupplierInvoice {
  id: number
  invoiceNo: string
  supplierId: number
  purchaseOrderId: number | null
  grnId: number | null
  invoiceDate: string
  dueDate: string | null
  amount: string
  status: SupplierInvoiceStatus
  journalEntryId: number | null
}

export interface SupplierPayment {
  id: number
  supplierInvoiceId: number
  paymentDate: string
  amount: string
  paymentMethod: PaymentMethod
  referenceNo: string | null
  journalEntryId: number | null
  paidBy: number
  approvedBy: number | null
}

// ---- Create payloads ----

export type NewSupplierValues = {
  name: string
  kraPin?: string
  contactPerson?: string
  phone?: string
  email?: string
  bankName?: string
  bankAccountNo?: string
}

export type NewRequisitionItemValues = {
  description: string
  quantity: number
  estimatedUnitCost?: number
  accountId: number
}

export type NewRequisitionValues = {
  requestedBy: number
  department?: string
  requestDate: string
  items: NewRequisitionItemValues[]
}

export type NewPurchaseOrderItemValues = {
  description: string
  quantity: number
  unitCost: number
  accountId: number
}

export type NewPurchaseOrderValues = {
  supplierId: number
  requisitionId?: number
  orderDate: string
  items: NewPurchaseOrderItemValues[]
  approvedBy?: number
}

export type NewGrnItemValues = {
  purchaseOrderItemId: number
  quantityReceived: number
  condition?: string
}

export type NewGrnValues = {
  purchaseOrderId: number
  receivedDate: string
  receivedBy: number
  items: NewGrnItemValues[]
}

export type NewSupplierInvoiceLineValues = {
  accountId: number
  amount: number
  description?: string
}

export type NewSupplierInvoiceValues = {
  invoiceNo: string
  supplierId: number
  purchaseOrderId?: number
  grnId?: number
  invoiceDate: string
  dueDate?: string
  fundId: number
  creditorsAccountId: number
  periodId: number
  createdBy: number
  lines: NewSupplierInvoiceLineValues[]
}

export type NewSupplierPaymentValues = {
  supplierInvoiceId: number
  paymentDate: string
  amount: number
  paymentMethod: PaymentMethod
  referenceNo?: string
  fundId: number
  cashAccountId: number
  creditorsAccountId: number
  periodId: number
  paidBy: number
  approvedBy?: number
}
