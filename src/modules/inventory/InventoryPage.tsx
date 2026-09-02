import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Package, Plus, X, SaveIcon, XCircle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllInventoryItemsQuery,
    useCreateInventoryItemMutation,
    useGetMovementsByItemQuery,
    useReceiveStockMutation,
    useIssueStockMutation,
} from './InventoryApi'
import type { RootState } from '../../store/store'
import type { StockMovementType } from './types'

const MOVEMENT_BADGE: Record<StockMovementType, string> = {
    receipt: 'badge-success',
    issue: 'badge-warning',
    adjustment: 'badge-ghost',
}

const formatMoney = (amount: string | number | null) =>
    amount == null ? '—' : Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---- New Item modal ----

type ItemFormValues = { itemCode: string; name: string; unit: string; category?: string; reorderLevel?: number }

const NewItemModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [createItem] = useCreateInventoryItemMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<ItemFormValues>()

    const onSubmit: SubmitHandler<ItemFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating item...')
        try {
            await createItem({
                itemCode: formValues.itemCode,
                name: formValues.name,
                unit: formValues.unit,
                category: formValues.category || undefined,
                reorderLevel: formValues.reorderLevel ? Number(formValues.reorderLevel) : undefined,
            }).unwrap()
            toast.success('Item created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create item'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Inventory Item</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Item Code</label>
                            <input className="input input-bordered w-full" placeholder="e.g. STA-001" {...register('itemCode', { required: 'Item code is required' })} />
                            {errors.itemCode && <p className="text-red-500 text-sm">{errors.itemCode.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Unit</label>
                            <input className="input input-bordered w-full" placeholder="e.g. ream, kg, box" {...register('unit', { required: 'Unit is required' })} />
                            {errors.unit && <p className="text-red-500 text-sm">{errors.unit.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input className="input input-bordered w-full" placeholder="e.g. A4 Printing Paper" {...register('name', { required: 'Name is required' })} />
                            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Category (optional)</label>
                            <input className="input input-bordered w-full" placeholder="e.g. Stationery" {...register('category')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Reorder Level (optional)</label>
                            <input type="number" step="0.01" className="input input-bordered w-full" {...register('reorderLevel', { min: 0 })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Receive / Issue forms shared shape ----

type MovementFormValues = {
    movementDate: string
    quantity: number
    unitCost: number
    reference?: string
    periodId?: number
    fundId?: number
    inventoryAccountId?: number
    otherAccountId?: number
}

const MovementForm: React.FC<{ mode: 'receive' | 'issue'; itemId: number; onDone: () => void }> = ({ mode, itemId, onDone }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const [receiveStock] = useReceiveStockMutation()
    const [issueStock] = useIssueStockMutation()
    const { register, handleSubmit, reset } = useForm<MovementFormValues>()

    const onSubmit: SubmitHandler<MovementFormValues> = async (formValues) => {
        const loadingToastId = toast.loading(mode === 'receive' ? 'Recording receipt...' : 'Recording issue...')
        try {
            const base = {
                itemId,
                movementDate: formValues.movementDate,
                quantity: Number(formValues.quantity),
                unitCost: Number(formValues.unitCost),
                reference: formValues.reference || undefined,
                periodId: Number(formValues.periodId),
                fundId: Number(formValues.fundId),
                inventoryAccountId: Number(formValues.inventoryAccountId),
                recordedBy: user!.id,
            }
            if (mode === 'receive') {
                await receiveStock({ ...base, creditAccountId: Number(formValues.otherAccountId) }).unwrap()
            } else {
                await issueStock({ ...base, expenseAccountId: Number(formValues.otherAccountId) }).unwrap()
            }
            toast.success(mode === 'receive' ? 'Stock received' : 'Stock issued', { id: loadingToastId })
            reset()
            onDone()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record movement'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                {mode === 'receive' ? <><ArrowDownToLine size={14} className="text-green-700" /> Receive Stock</> : <><ArrowUpFromLine size={14} className="text-amber-700" /> Issue Stock</>}
            </h4>
            <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input input-bordered input-sm w-full" {...register('movementDate', { required: true })} />
                <input className="input input-bordered input-sm w-full" placeholder="Reference (optional)" {...register('reference')} />
                <input type="number" step="0.01" className="input input-bordered input-sm w-full" placeholder="Quantity" {...register('quantity', { required: true, min: 0.01 })} />
                <input type="number" step="0.01" className="input input-bordered input-sm w-full" placeholder="Unit Cost" {...register('unitCost', { required: true, min: 0 })} />
                <select className="select select-bordered select-sm w-full" {...register('periodId', { required: true })}>
                    <option value="">Period</option>
                    {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="select select-bordered select-sm w-full" {...register('fundId', { required: true })}>
                    <option value="">Fund</option>
                    {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select className="select select-bordered select-sm w-full" {...register('inventoryAccountId', { required: true })}>
                    <option value="">Inventory Account</option>
                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
                <select className="select select-bordered select-sm w-full" {...register('otherAccountId', { required: true })}>
                    <option value="">{mode === 'receive' ? 'Credit Account (source)' : 'Expense Account'}</option>
                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
            </div>
            <div className="flex justify-end">
                <button type="submit" className={`btn btn-sm text-white ${mode === 'receive' ? 'bg-green-800 hover:bg-green-900' : 'bg-amber-700 hover:bg-amber-800'}`}>
                    {mode === 'receive' ? 'Record Receipt' : 'Record Issue'}
                </button>
            </div>
        </form>
    )
}

// ---- Detail modal ----

const ItemDetailModal: React.FC<{ itemId: number; itemName: string; canManage: boolean; onClose: () => void }> = ({ itemId, itemName, canManage, onClose }) => {
    const { data: movements, isLoading } = useGetMovementsByItemQuery(itemId)
    const [movementMode, setMovementMode] = useState<'receive' | 'issue' | null>(null)

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="flex items-start justify-between mb-4">
                    <h2 className="text-xl font-bold text-green-800">{itemName}</h2>
                    {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => setMovementMode(movementMode === 'receive' ? null : 'receive')} className="btn btn-xs btn-outline border-green-800 text-green-800">
                                <ArrowDownToLine size={12} /> Receive
                            </button>
                            <button onClick={() => setMovementMode(movementMode === 'issue' ? null : 'issue')} className="btn btn-xs btn-outline border-amber-700 text-amber-700">
                                <ArrowUpFromLine size={12} /> Issue
                            </button>
                        </div>
                    )}
                </div>

                {movementMode && (
                    <div className="mb-4">
                        <MovementForm mode={movementMode} itemId={itemId} onDone={() => setMovementMode(null)} />
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div>
                ) : !movements || movements.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">No movements recorded yet.</div>
                ) : (
                    <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg">
                        <table className="table table-sm w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>Date</th><th>Type</th><th className="text-right">Qty</th><th className="text-right">Unit Cost</th><th>Reference</th></tr>
                            </thead>
                            <tbody>
                                {movements.map((m) => (
                                    <tr key={m.id}>
                                        <td className="text-sm text-gray-500">{new Date(m.movementDate).toLocaleDateString()}</td>
                                        <td><span className={`badge ${MOVEMENT_BADGE[m.movementType]} capitalize`}>{m.movementType}</span></td>
                                        <td className="text-right font-mono">{formatMoney(m.quantity)}</td>
                                        <td className="text-right font-mono">{formatMoney(m.unitCost)}</td>
                                        <td className="text-sm text-gray-500">{m.reference ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button>
                </div>
            </div>
        </div>
    )
}

// ---- Page ----

const InventoryPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('inventory.manage') ?? false

    const { data: items, isLoading, isError } = useGetAllInventoryItemsQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [viewingItem, setViewingItem] = useState<{ id: number; name: string } | null>(null)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Package className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Inventory</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Item
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load inventory items.</p></div>
            ) : !items || items.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No inventory items yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Unit</th>
                                    <th>Category</th>
                                    <th className="text-right">Reorder Level</th>
                                    <th className="text-center">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <tr key={it.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{it.itemCode}</td>
                                        <td className="font-medium text-gray-800">{it.name}</td>
                                        <td>{it.unit}</td>
                                        <td className="text-gray-500 text-sm">{it.category ?? '—'}</td>
                                        <td className="text-right font-mono">{formatMoney(it.reorderLevel)}</td>
                                        <td className="text-center">
                                            <button onClick={() => setViewingItem({ id: it.id, name: it.name })} className="btn btn-ghost btn-xs text-green-800" title="View movements">
                                                <Package size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddOpen && <NewItemModal onClose={() => setIsAddOpen(false)} />}
            {viewingItem && <ItemDetailModal itemId={viewingItem.id} itemName={viewingItem.name} canManage={canManage} onClose={() => setViewingItem(null)} />}
        </DashboardLayout>
    )
}

export default InventoryPage
