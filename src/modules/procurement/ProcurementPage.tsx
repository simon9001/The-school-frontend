import React, { useState } from 'react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { ShoppingCart, Plus, X, SaveIcon, XCircle, Trash2, Eye, Check, Ban, Truck, Banknote } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllSuppliersQuery,
    useCreateSupplierMutation,
    useGetAllRequisitionsQuery,
    useGetRequisitionByIdQuery,
    useCreateRequisitionMutation,
    useApproveRequisitionMutation,
    useRejectRequisitionMutation,
    useGetAllPurchaseOrdersQuery,
    useGetPurchaseOrderByIdQuery,
    useCreatePurchaseOrderMutation,
    useCreateGrnMutation,
    useGetAllSupplierInvoicesQuery,
    useCreateSupplierInvoiceMutation,
    useCreateSupplierPaymentMutation,
} from './ProcurementApi'
import type { RootState } from '../../store/store'
import type {
    NewGrnItemValues,
    NewPurchaseOrderItemValues,
    NewRequisitionItemValues,
    NewSupplierValues,
    PaymentMethod,
    PurchaseOrderStatus,
    RequisitionStatus,
    SupplierInvoice,
    SupplierInvoiceStatus,
} from './types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

const REQ_BADGE: Record<RequisitionStatus, string> = {
    draft: 'badge-ghost', submitted: 'badge-warning', approved: 'badge-success', rejected: 'badge-error', converted_to_lpo: 'badge-info',
}
const PO_BADGE: Record<PurchaseOrderStatus, string> = {
    draft: 'badge-ghost', issued: 'badge-warning', partially_received: 'badge-info', received: 'badge-success', cancelled: 'badge-error',
}
const INV_BADGE: Record<SupplierInvoiceStatus, string> = {
    pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success', disputed: 'badge-error',
}

// ==================== SUPPLIERS ====================

const NewSupplierModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [createSupplier] = useCreateSupplierMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewSupplierValues>()

    const onSubmit: SubmitHandler<NewSupplierValues> = async (v) => {
        const id = toast.loading('Creating supplier...')
        try {
            await createSupplier({
                ...v,
                kraPin: blank(v.kraPin), contactPerson: blank(v.contactPerson), phone: blank(v.phone),
                email: blank(v.email), bankName: blank(v.bankName), bankAccountNo: blank(v.bankAccountNo),
            }).unwrap()
            toast.success('Supplier created', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to create supplier', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Supplier</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input className="input input-bordered w-full" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input className="input input-bordered w-full" placeholder="KRA PIN" {...register('kraPin')} />
                        <input className="input input-bordered w-full" placeholder="Contact Person" {...register('contactPerson')} />
                        <input className="input input-bordered w-full" placeholder="Phone" {...register('phone')} />
                        <input type="email" className="input input-bordered w-full" placeholder="Email" {...register('email')} />
                        <input className="input input-bordered w-full" placeholder="Bank Name" {...register('bankName')} />
                        <input className="input input-bordered w-full" placeholder="Bank Account No." {...register('bankAccountNo')} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const SuppliersPanel: React.FC = () => {
    const { data: suppliers, isLoading, isError } = useGetAllSuppliersQuery()
    return (
        <div>
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load suppliers.</p></div>
            : !suppliers || suppliers.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No suppliers yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>Name</th><th>KRA PIN</th><th>Contact</th><th>Bank</th><th>Status</th></tr></thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="font-medium text-gray-800">{s.name}</td>
                                    <td className="text-sm text-gray-600">{s.kraPin ?? '—'}</td>
                                    <td className="text-sm text-gray-600">{s.contactPerson ?? '—'}{s.phone && <div className="text-xs text-gray-400">{s.phone}</div>}</td>
                                    <td className="text-sm text-gray-600">{s.bankName ?? '—'}</td>
                                    <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-ghost'} capitalize`}>{s.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ==================== REQUISITIONS ====================

type ReqFormValues = { department?: string; requestDate: string; items: NewRequisitionItemValues[] }

const NewRequisitionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const [createRequisition] = useCreateRequisitionMutation()
    const { register, control, handleSubmit } = useForm<ReqFormValues>({
        defaultValues: { requestDate: new Date().toISOString().slice(0, 10), items: [{ description: '' } as never] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'items' })

    const onSubmit: SubmitHandler<ReqFormValues> = async (v) => {
        const id = toast.loading('Submitting requisition...')
        try {
            await createRequisition({
                requestedBy: user!.id,
                department: blank(v.department),
                requestDate: v.requestDate,
                items: v.items.map((i) => ({
                    description: i.description,
                    quantity: Number(i.quantity),
                    estimatedUnitCost: i.estimatedUnitCost ? Number(i.estimatedUnitCost) : undefined,
                    accountId: Number(i.accountId),
                })),
            }).unwrap()
            toast.success('Requisition submitted', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to submit requisition', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Requisition</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Department</label>
                            <input className="input input-bordered w-full" {...register('department')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Request Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('requestDate', { required: true })} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Items</h3>
                        <button type="button" onClick={() => append({ description: '' } as never)} className="btn btn-xs btn-ghost text-green-800"><Plus size={14} /> Add Item</button>
                    </div>
                    <div className="space-y-2 mb-6">
                        {fields.map((f, i) => (
                            <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                                <input className="input input-bordered input-sm col-span-4" placeholder="Description" {...register(`items.${i}.description`, { required: true })} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Qty" {...register(`items.${i}.quantity`, { required: true })} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Est. Unit Cost" {...register(`items.${i}.estimatedUnitCost`)} />
                                <select className="select select-bordered select-sm col-span-3" {...register(`items.${i}.accountId`, { required: true })}>
                                    <option value="">Account</option>
                                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                                <button type="button" onClick={() => remove(i)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length === 1}><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Submit</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const RequisitionDetailModal: React.FC<{ id: number; canApprove: boolean; onClose: () => void }> = ({ id, canApprove, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: req, isLoading } = useGetRequisitionByIdQuery(id)
    const { data: accounts } = useGetAllAccountsQuery()
    const [approve] = useApproveRequisitionMutation()
    const [reject] = useRejectRequisitionMutation()

    const handleApprove = async () => {
        const tid = toast.loading('Approving...')
        try { await approve({ id, approvedBy: user!.id }).unwrap(); toast.success('Requisition approved', { id: tid }); onClose() }
        catch (err) { toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to approve', { id: tid }) }
    }
    const handleReject = async () => {
        const tid = toast.loading('Rejecting...')
        try { await reject(id).unwrap(); toast.success('Requisition rejected', { id: tid }); onClose() }
        catch (err) { toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to reject', { id: tid }) }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                {isLoading || !req ? <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div> : (
                    <>
                        <div className="flex items-start justify-between mb-4">
                            <div><h2 className="text-xl font-bold text-green-800">{req.requisitionNo}</h2><p className="text-sm text-gray-500">{req.department ?? 'No department'} — {req.requestDate}</p></div>
                            <span className={`badge ${REQ_BADGE[req.status]} capitalize`}>{req.status.replace('_', ' ')}</span>
                        </div>
                        <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg mb-4">
                            <table className="table table-sm w-full">
                                <thead><tr className="bg-gray-50"><th>Description</th><th>Account</th><th className="text-right">Qty</th><th className="text-right">Est. Cost</th></tr></thead>
                                <tbody>
                                    {req.items.map((i) => (
                                        <tr key={i.id}>
                                            <td>{i.description}</td>
                                            <td>{accounts?.find((a) => a.id === i.accountId)?.name ?? i.accountId}</td>
                                            <td className="text-right font-mono">{i.quantity}</td>
                                            <td className="text-right font-mono">{i.estimatedUnitCost ? formatMoney(i.estimatedUnitCost) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {req.status === 'submitted' && canApprove && (
                            <div className="flex gap-2 border-t pt-4">
                                <button onClick={handleApprove} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Check size={14} /> Approve</button>
                                <button onClick={handleReject} className="btn btn-sm btn-ghost text-red-600"><Ban size={14} /> Reject</button>
                            </div>
                        )}
                    </>
                )}
                <div className="flex justify-end mt-4"><button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button></div>
            </div>
        </div>
    )
}

const RequisitionsPanel: React.FC<{ canApprove: boolean }> = ({ canApprove }) => {
    const { data: reqs, isLoading, isError } = useGetAllRequisitionsQuery()
    const [viewing, setViewing] = useState<number | null>(null)
    return (
        <div>
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load requisitions.</p></div>
            : !reqs || reqs.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No requisitions yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>Req No.</th><th>Department</th><th>Date</th><th>Status</th><th className="text-center">View</th></tr></thead>
                        <tbody>
                            {reqs.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="font-mono text-sm">{r.requisitionNo}</td>
                                    <td>{r.department ?? '—'}</td>
                                    <td>{r.requestDate}</td>
                                    <td><span className={`badge ${REQ_BADGE[r.status]} capitalize`}>{r.status.replace('_', ' ')}</span></td>
                                    <td className="text-center"><button onClick={() => setViewing(r.id)} className="btn btn-ghost btn-xs text-green-800"><Eye size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {viewing !== null && <RequisitionDetailModal id={viewing} canApprove={canApprove} onClose={() => setViewing(null)} />}
        </div>
    )
}

// ==================== PURCHASE ORDERS ====================

type PoFormValues = { supplierId: number; requisitionId?: number; orderDate: string; items: NewPurchaseOrderItemValues[] }

const NewPurchaseOrderModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: suppliers } = useGetAllSuppliersQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: requisitions } = useGetAllRequisitionsQuery()
    const approvedRequisitions = requisitions?.filter((r) => r.status === 'approved')
    const [createPO] = useCreatePurchaseOrderMutation()
    const { register, control, handleSubmit } = useForm<PoFormValues>({
        defaultValues: { orderDate: new Date().toISOString().slice(0, 10), items: [{ description: '' } as never] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'items' })

    const onSubmit: SubmitHandler<PoFormValues> = async (v) => {
        const id = toast.loading('Issuing purchase order...')
        try {
            await createPO({
                supplierId: Number(v.supplierId),
                requisitionId: v.requisitionId ? Number(v.requisitionId) : undefined,
                orderDate: v.orderDate,
                approvedBy: user!.id,
                items: v.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitCost: Number(i.unitCost), accountId: Number(i.accountId) })),
            }).unwrap()
            toast.success('Purchase order issued', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to issue purchase order', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Purchase Order</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Supplier</label>
                            <select className="select select-bordered w-full" {...register('supplierId', { required: true })}>
                                <option value="">Select supplier</option>
                                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">From Requisition</label>
                            <select className="select select-bordered w-full" {...register('requisitionId')}>
                                <option value="">None</option>
                                {approvedRequisitions?.map((r) => <option key={r.id} value={r.id}>{r.requisitionNo}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Order Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('orderDate', { required: true })} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Items</h3>
                        <button type="button" onClick={() => append({ description: '' } as never)} className="btn btn-xs btn-ghost text-green-800"><Plus size={14} /> Add Item</button>
                    </div>
                    <div className="space-y-2 mb-6">
                        {fields.map((f, i) => (
                            <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                                <input className="input input-bordered input-sm col-span-4" placeholder="Description" {...register(`items.${i}.description`, { required: true })} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Qty" {...register(`items.${i}.quantity`, { required: true })} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Unit Cost" {...register(`items.${i}.unitCost`, { required: true })} />
                                <select className="select select-bordered select-sm col-span-3" {...register(`items.${i}.accountId`, { required: true })}>
                                    <option value="">Account</option>
                                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                                <button type="button" onClick={() => remove(i)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length === 1}><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Issue LPO</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const PurchaseOrderDetailModal: React.FC<{ id: number; onClose: () => void }> = ({ id, onClose }) => {
    const { data: po, isLoading } = useGetPurchaseOrderByIdQuery(id)
    const { data: suppliers } = useGetAllSuppliersQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                {isLoading || !po ? <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div> : (
                    <>
                        <div className="flex items-start justify-between mb-1">
                            <div><h2 className="text-xl font-bold text-green-800">{po.lpoNo}</h2><p className="text-sm text-gray-500">{suppliers?.find((s) => s.id === po.supplierId)?.name} — {po.orderDate}</p></div>
                            <span className={`badge ${PO_BADGE[po.status]} capitalize`}>{po.status.replace('_', ' ')}</span>
                        </div>
                        <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg my-4">
                            <table className="table table-sm w-full">
                                <thead><tr className="bg-gray-50"><th>Description</th><th>Account</th><th className="text-right">Qty</th><th className="text-right">Unit Cost</th></tr></thead>
                                <tbody>
                                    {po.items.map((i) => (
                                        <tr key={i.id}>
                                            <td>{i.description}</td>
                                            <td>{accounts?.find((a) => a.id === i.accountId)?.name ?? i.accountId}</td>
                                            <td className="text-right font-mono">{i.quantity}</td>
                                            <td className="text-right font-mono">{formatMoney(i.unitCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot><tr className="bg-gray-50 font-bold"><td colSpan={3}>Total</td><td className="text-right font-mono">{formatMoney(po.totalAmount)}</td></tr></tfoot>
                            </table>
                        </div>
                    </>
                )}
                <div className="flex justify-end"><button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button></div>
            </div>
        </div>
    )
}

const PurchaseOrdersPanel: React.FC = () => {
    const { data: pos, isLoading, isError } = useGetAllPurchaseOrdersQuery()
    const { data: suppliers } = useGetAllSuppliersQuery()
    const [viewing, setViewing] = useState<number | null>(null)
    return (
        <div>
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load purchase orders.</p></div>
            : !pos || pos.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No purchase orders yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>LPO No.</th><th>Supplier</th><th>Date</th><th className="text-right">Total</th><th>Status</th><th className="text-center">View</th></tr></thead>
                        <tbody>
                            {pos.map((po) => (
                                <tr key={po.id} className="hover:bg-gray-50">
                                    <td className="font-mono text-sm">{po.lpoNo}</td>
                                    <td>{suppliers?.find((s) => s.id === po.supplierId)?.name ?? po.supplierId}</td>
                                    <td>{po.orderDate}</td>
                                    <td className="text-right font-mono">{formatMoney(po.totalAmount)}</td>
                                    <td><span className={`badge ${PO_BADGE[po.status]} capitalize`}>{po.status.replace('_', ' ')}</span></td>
                                    <td className="text-center"><button onClick={() => setViewing(po.id)} className="btn btn-ghost btn-xs text-green-800"><Eye size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {viewing !== null && <PurchaseOrderDetailModal id={viewing} onClose={() => setViewing(null)} />}
        </div>
    )
}

// ==================== GOODS RECEIVED ====================

const NewGrnModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: pos } = useGetAllPurchaseOrdersQuery()
    const receivablePOs = pos?.filter((p) => p.status === 'issued' || p.status === 'partially_received')
    const [poId, setPoId] = useState('')
    const { data: po } = useGetPurchaseOrderByIdQuery(Number(poId), { skip: !poId })
    const [createGrn] = useCreateGrnMutation()
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
    const [rows, setRows] = useState<Record<number, { checked: boolean; quantity: string }>>({})

    const toggleRow = (itemId: number, quantityReceived: string) => {
        setRows((prev) => ({ ...prev, [itemId]: { checked: true, quantity: quantityReceived } }))
    }

    const handleSubmit = async () => {
        const items: NewGrnItemValues[] = Object.entries(rows)
            .filter(([, v]) => v.checked && Number(v.quantity) > 0)
            .map(([itemId, v]) => ({ purchaseOrderItemId: Number(itemId), quantityReceived: Number(v.quantity) }))
        if (!poId || items.length === 0) {
            toast.error('Select a purchase order and enter quantities received')
            return
        }
        const id = toast.loading('Recording goods received...')
        try {
            await createGrn({ purchaseOrderId: Number(poId), receivedDate, receivedBy: user!.id, items }).unwrap()
            toast.success('Goods received recorded', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to record goods received', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">Record Goods Received</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
                        <select value={poId} onChange={(e) => { setPoId(e.target.value); setRows({}) }} className="select select-bordered w-full">
                            <option value="">Select LPO</option>
                            {receivablePOs?.map((p) => <option key={p.id} value={p.id}>{p.lpoNo}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Received Date</label>
                        <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="input input-bordered w-full" />
                    </div>
                </div>
                {po && (
                    <div className="space-y-2 mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Items Ordered</h3>
                        {po.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 border border-gray-200 rounded-lg p-2">
                                <input type="checkbox" className="checkbox checkbox-sm" checked={rows[item.id]?.checked ?? false}
                                    onChange={(e) => toggleRow(item.id, e.target.checked ? item.quantity : '0')} />
                                <span className="flex-1 text-sm">{item.description} <span className="text-gray-400">(ordered {item.quantity})</span></span>
                                <input type="number" step="0.01" className="input input-bordered input-sm w-24" placeholder="Qty received"
                                    value={rows[item.id]?.quantity ?? ''} onChange={(e) => toggleRow(item.id, e.target.value)} />
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                    <button type="button" onClick={handleSubmit} className="btn bg-green-800 hover:bg-green-900 text-white"><Truck size={16} /> Record Received</button>
                </div>
            </div>
        </div>
    )
}

const GoodsReceivedPanel: React.FC = () => {
    const { data: pos } = useGetAllPurchaseOrdersQuery()
    const receivedPOs = pos?.filter((p) => p.status === 'received' || p.status === 'partially_received')
    return (
        <div>
            {!receivedPOs || receivedPOs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No goods received yet. Use "Record Goods Received" against an issued purchase order.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>LPO No.</th><th>Receipt Status</th></tr></thead>
                        <tbody>
                            {receivedPOs.map((po) => (
                                <tr key={po.id} className="hover:bg-gray-50">
                                    <td className="font-mono text-sm">{po.lpoNo}</td>
                                    <td><span className={`badge ${PO_BADGE[po.status]} capitalize`}>{po.status.replace('_', ' ')}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ==================== INVOICES & PAYMENTS ====================

type InvFormValues = { invoiceNo: string; supplierId: number; purchaseOrderId?: number; invoiceDate: string; dueDate?: string; fundId: number; creditorsAccountId: number; periodId: number; lines: { accountId?: number; amount?: number; description: string }[] }

const NewSupplierInvoiceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: suppliers } = useGetAllSuppliersQuery()
    const { data: pos } = useGetAllPurchaseOrdersQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const creditorAccounts = accounts?.filter((a) => a.type === 'liability')
    const [createInvoice] = useCreateSupplierInvoiceMutation()
    const { register, control, handleSubmit } = useForm<InvFormValues>({
        defaultValues: { invoiceDate: new Date().toISOString().slice(0, 10), lines: [{ description: '' }] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

    const onSubmit: SubmitHandler<InvFormValues> = async (v) => {
        const id = toast.loading('Recording supplier invoice...')
        try {
            await createInvoice({
                invoiceNo: v.invoiceNo,
                supplierId: Number(v.supplierId),
                purchaseOrderId: v.purchaseOrderId ? Number(v.purchaseOrderId) : undefined,
                invoiceDate: v.invoiceDate,
                dueDate: blank(v.dueDate),
                fundId: Number(v.fundId),
                creditorsAccountId: Number(v.creditorsAccountId),
                periodId: Number(v.periodId),
                createdBy: user!.id,
                lines: v.lines.map((l) => ({ accountId: Number(l.accountId), amount: Number(l.amount), description: blank(l.description) })),
            }).unwrap()
            toast.success('Supplier invoice recorded', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to record invoice', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Supplier Invoice</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Invoice No.</label>
                            <input className="input input-bordered w-full" {...register('invoiceNo', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Supplier</label>
                            <select className="select select-bordered w-full" {...register('supplierId', { required: true })}>
                                <option value="">Select supplier</option>
                                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Purchase Order (optional)</label>
                            <select className="select select-bordered w-full" {...register('purchaseOrderId')}>
                                <option value="">None</option>
                                {pos?.map((p) => <option key={p.id} value={p.id}>{p.lpoNo}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('invoiceDate', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Due Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('dueDate')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                                <option value="">Select period</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fund</label>
                            <select className="select select-bordered w-full" {...register('fundId', { required: true })}>
                                <option value="">Select fund</option>
                                {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Creditors Account</label>
                            <select className="select select-bordered w-full" {...register('creditorsAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {creditorAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Expense Lines</h3>
                        <button type="button" onClick={() => append({ description: '' })} className="btn btn-xs btn-ghost text-green-800"><Plus size={14} /> Add Line</button>
                    </div>
                    <div className="space-y-2 mb-6">
                        {fields.map((f, i) => (
                            <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                                <select className="select select-bordered select-sm col-span-5" {...register(`lines.${i}.accountId`, { required: true })}>
                                    <option value="">Expense/Asset Account</option>
                                    {accounts?.filter((a) => a.type === 'expense' || a.type === 'asset').map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                                <input className="input input-bordered input-sm col-span-4" placeholder="Description" {...register(`lines.${i}.description`)} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Amount" {...register(`lines.${i}.amount`, { required: true })} />
                                <button type="button" onClick={() => remove(i)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length === 1}><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const RecordSupplierPaymentModal: React.FC<{ invoice: SupplierInvoice; onClose: () => void }> = ({ invoice, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const assetAccounts = accounts?.filter((a) => a.type === 'asset')
    const creditorAccounts = accounts?.filter((a) => a.type === 'liability')
    const [recordPayment] = useCreateSupplierPaymentMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<{ paymentDate: string; amount: number; paymentMethod: PaymentMethod; referenceNo?: string; fundId: number; cashAccountId: number; creditorsAccountId: number; periodId: number }>({
        defaultValues: { paymentDate: new Date().toISOString().slice(0, 10) },
    })

    const onSubmit: SubmitHandler<{ paymentDate: string; amount: number; paymentMethod: PaymentMethod; referenceNo?: string; fundId: number; cashAccountId: number; creditorsAccountId: number; periodId: number }> = async (v) => {
        const id = toast.loading('Recording payment...')
        try {
            await recordPayment({
                supplierInvoiceId: invoice.id,
                paymentDate: v.paymentDate,
                amount: Number(v.amount),
                paymentMethod: v.paymentMethod,
                referenceNo: blank(v.referenceNo),
                fundId: Number(v.fundId),
                cashAccountId: Number(v.cashAccountId),
                creditorsAccountId: Number(v.creditorsAccountId),
                periodId: Number(v.periodId),
                paidBy: user!.id,
            }).unwrap()
            toast.success('Payment recorded', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to record payment', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-1">Record Payment</h2>
                <p className="text-sm text-gray-500 mb-4">Invoice {invoice.invoiceNo} — total {formatMoney(invoice.amount)}</p>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" step="0.01" className="input input-bordered w-full" {...register('amount', { required: 'Amount is required' })} />
                            {errors.amount && <p className="text-red-500 text-sm">{errors.amount.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('paymentDate', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Method</label>
                            <select className="select select-bordered w-full" {...register('paymentMethod', { required: true })}>
                                <option value="bank">Bank</option>
                                <option value="cheque">Cheque</option>
                                <option value="mpesa">M-Pesa</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Reference No.</label>
                            <input className="input input-bordered w-full" {...register('referenceNo')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                                <option value="">Select period</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fund</label>
                            <select className="select select-bordered w-full" {...register('fundId', { required: true })}>
                                <option value="">Select fund</option>
                                {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Cash/Bank Account</label>
                            <select className="select select-bordered w-full" {...register('cashAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {assetAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Creditors Account</label>
                            <select className="select select-bordered w-full" {...register('creditorsAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {creditorAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const InvoicesPanel: React.FC<{ canManageInvoice: boolean; canPay: boolean }> = ({ canManageInvoice, canPay }) => {
    const { data: invoices, isLoading, isError } = useGetAllSupplierInvoicesQuery()
    const { data: suppliers } = useGetAllSuppliersQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [paying, setPaying] = useState<SupplierInvoice | null>(null)

    return (
        <div>
            {canManageInvoice && (
                <div className="flex justify-end mb-4">
                    <button onClick={() => setIsAddOpen(true)} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={14} /> New Invoice</button>
                </div>
            )}
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load invoices.</p></div>
            : !invoices || invoices.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No supplier invoices yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>Invoice No.</th><th>Supplier</th><th>Date</th><th className="text-right">Amount</th><th>Status</th>{canPay && <th className="text-center">Pay</th>}</tr></thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                    <td className="font-mono text-sm">{inv.invoiceNo}</td>
                                    <td>{suppliers?.find((s) => s.id === inv.supplierId)?.name ?? inv.supplierId}</td>
                                    <td>{inv.invoiceDate}</td>
                                    <td className="text-right font-mono">{formatMoney(inv.amount)}</td>
                                    <td><span className={`badge ${INV_BADGE[inv.status]} capitalize`}>{inv.status}</span></td>
                                    {canPay && (
                                        <td className="text-center">
                                            {inv.status !== 'paid' && (
                                                <button onClick={() => setPaying(inv)} className="btn btn-ghost btn-xs text-green-800" title="Record Payment"><Banknote size={14} /></button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {isAddOpen && <NewSupplierInvoiceModal onClose={() => setIsAddOpen(false)} />}
            {paying && <RecordSupplierPaymentModal invoice={paying} onClose={() => setPaying(null)} />}
        </div>
    )
}

// ==================== PAGE ====================

const ProcurementPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManageSuppliersOrLpo = user?.permissions.includes('procurement.lpo.manage') ?? false
    const canCreateRequisition = user?.permissions.includes('procurement.requisition.create') ?? false
    const canApproveRequisition = user?.permissions.includes('procurement.requisition.approve') ?? false
    const canManageInvoice = user?.permissions.includes('procurement.invoice.manage') ?? false
    const canPay = user?.permissions.includes('procurement.payment.create') ?? false

    const [tab, setTab] = useState<'suppliers' | 'requisitions' | 'purchase-orders' | 'goods-received' | 'invoices'>('requisitions')
    const [isSupplierOpen, setIsSupplierOpen] = useState(false)
    const [isReqOpen, setIsReqOpen] = useState(false)
    const [isPoOpen, setIsPoOpen] = useState(false)
    const [isGrnOpen, setIsGrnOpen] = useState(false)

    const primaryAction = () => {
        if (tab === 'suppliers' && canManageSuppliersOrLpo) return <button onClick={() => setIsSupplierOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={16} /> New Supplier</button>
        if (tab === 'requisitions' && canCreateRequisition) return <button onClick={() => setIsReqOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={16} /> New Requisition</button>
        if (tab === 'purchase-orders' && canManageSuppliersOrLpo) return <button onClick={() => setIsPoOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={16} /> New Purchase Order</button>
        if (tab === 'goods-received' && canManageSuppliersOrLpo) return <button onClick={() => setIsGrnOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Truck size={16} /> Record Goods Received</button>
        return null
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <ShoppingCart className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Procurement</h1>
                </div>
                {primaryAction()}
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit flex-wrap">
                <a role="tab" className={`tab ${tab === 'requisitions' ? 'tab-active' : ''}`} onClick={() => setTab('requisitions')}>Requisitions</a>
                <a role="tab" className={`tab ${tab === 'purchase-orders' ? 'tab-active' : ''}`} onClick={() => setTab('purchase-orders')}>Purchase Orders</a>
                <a role="tab" className={`tab ${tab === 'goods-received' ? 'tab-active' : ''}`} onClick={() => setTab('goods-received')}>Goods Received</a>
                <a role="tab" className={`tab ${tab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setTab('invoices')}>Invoices & Payments</a>
                <a role="tab" className={`tab ${tab === 'suppliers' ? 'tab-active' : ''}`} onClick={() => setTab('suppliers')}>Suppliers</a>
            </div>

            {tab === 'suppliers' && <SuppliersPanel />}
            {tab === 'requisitions' && <RequisitionsPanel canApprove={canApproveRequisition} />}
            {tab === 'purchase-orders' && <PurchaseOrdersPanel />}
            {tab === 'goods-received' && <GoodsReceivedPanel />}
            {tab === 'invoices' && <InvoicesPanel canManageInvoice={canManageInvoice} canPay={canPay} />}

            {isSupplierOpen && <NewSupplierModal onClose={() => setIsSupplierOpen(false)} />}
            {isReqOpen && <NewRequisitionModal onClose={() => setIsReqOpen(false)} />}
            {isPoOpen && <NewPurchaseOrderModal onClose={() => setIsPoOpen(false)} />}
            {isGrnOpen && <NewGrnModal onClose={() => setIsGrnOpen(false)} />}
        </DashboardLayout>
    )
}

export default ProcurementPage
