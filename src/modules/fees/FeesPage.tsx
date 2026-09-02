import React, { useState } from 'react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { HandCoins, Plus, X, SaveIcon, XCircle, Trash2, Banknote } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useCan } from '../../hooks/usePermissions'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import { useGetAllClassesQuery, useGetAllStudentsQuery } from '../students/StudentApi'
import type { RootState } from '../../store/store'
import {
    useGetAllStructuresQuery,
    useCreateStructureMutation,
    useGetAllInvoicesQuery,
    useCreateInvoiceMutation,
    useRecordPaymentMutation,
} from './FeesApi'
import CollectionsTab from './CollectionsTab'
import type { FeeInvoice, NewFeeStructureValues, NewInvoiceValues, NewPaymentValues } from './types'

const INVOICE_STATUS_BADGE: Record<string, string> = {
    open: 'badge-warning',
    partially_paid: 'badge-info',
    paid: 'badge-success',
    cancelled: 'badge-ghost',
}

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New Fee Structure modal ----

const NewStructureModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: classes } = useGetAllClassesQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const revenueAccounts = accounts?.filter((a) => a.type === 'revenue')

    type StructureFormValues = Omit<NewFeeStructureValues, 'items'> & {
        items: { accountId?: number; fundId?: number; description: string; amount?: number }[]
    }

    const [createStructure] = useCreateStructureMutation()
    const { register, control, handleSubmit, formState: { errors } } = useForm<StructureFormValues>({
        defaultValues: { items: [{ description: '' }] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'items' })

    const onSubmit: SubmitHandler<StructureFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating fee structure...')
        try {
            await createStructure({
                fiscalYear: Number(formValues.fiscalYear),
                periodId: Number(formValues.periodId),
                classId: Number(formValues.classId),
                boardingStatus: formValues.boardingStatus,
                items: formValues.items.map((item) => ({
                    accountId: Number(item.accountId),
                    fundId: Number(item.fundId),
                    description: item.description,
                    amount: Number(item.amount),
                })),
            }).unwrap()
            toast.success('Fee structure created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create fee structure'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Fee Structure</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fiscal Year</label>
                            <input type="number" className="input input-bordered w-full" {...register('fiscalYear', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: 'Period is required' })}>
                                <option value="">Select period</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {errors.periodId && <p className="text-red-500 text-sm">{errors.periodId.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Class</label>
                            <select className="select select-bordered w-full" {...register('classId', { required: 'Class is required' })}>
                                <option value="">Select class</option>
                                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {errors.classId && <p className="text-red-500 text-sm">{errors.classId.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Boarding Status</label>
                            <select className="select select-bordered w-full" defaultValue="day" {...register('boardingStatus', { required: true })}>
                                <option value="day">Day</option>
                                <option value="boarder">Boarder</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Votehead Items</h3>
                        <button type="button" onClick={() => append({ description: '' })} className="btn btn-xs btn-ghost text-green-800">
                            <Plus size={14} /> Add Item
                        </button>
                    </div>
                    <div className="space-y-2 mb-6">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                                <select className="select select-bordered select-sm col-span-3" {...register(`items.${index}.accountId`, { required: true })}>
                                    <option value="">Account</option>
                                    {revenueAccounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <select className="select select-bordered select-sm col-span-2" {...register(`items.${index}.fundId`, { required: true })}>
                                    <option value="">Fund</option>
                                    {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <input className="input input-bordered input-sm col-span-4" placeholder="Description" {...register(`items.${index}.description`, { required: true })} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Amount" {...register(`items.${index}.amount`, { required: true })} />
                                <button type="button" onClick={() => remove(index)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length === 1}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                            <SaveIcon size={16} /> Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- New Invoice modal ----

const NewInvoiceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: students } = useGetAllStudentsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: structures } = useGetAllStructuresQuery()
    const { data: classes } = useGetAllClassesQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const debtorAccounts = accounts?.filter((a) => a.type === 'asset')

    const [createInvoice] = useCreateInvoiceMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewInvoiceValues>({
        defaultValues: { invoiceDate: new Date().toISOString().slice(0, 10) },
    })

    const onSubmit: SubmitHandler<NewInvoiceValues> = async (formValues) => {
        const loadingToastId = toast.loading('Raising invoice...')
        try {
            await createInvoice({
                studentId: Number(formValues.studentId),
                periodId: Number(formValues.periodId),
                feeStructureId: Number(formValues.feeStructureId),
                invoiceDate: formValues.invoiceDate,
                debtorsAccountId: Number(formValues.debtorsAccountId),
                createdBy: user!.id,
            }).unwrap()
            toast.success('Invoice raised', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to raise invoice'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Invoice</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Student</label>
                        <select className="select select-bordered w-full" {...register('studentId', { required: 'Student is required' })}>
                            <option value="">Select student</option>
                            {students?.map((s) => <option key={s.id} value={s.id}>{s.admissionNo} — {s.firstName} {s.lastName}</option>)}
                        </select>
                        {errors.studentId && <p className="text-red-500 text-sm">{errors.studentId.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                                <option value="">Select period</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('invoiceDate', { required: true })} />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Fee Structure</label>
                        <select className="select select-bordered w-full" {...register('feeStructureId', { required: 'Fee structure is required' })}>
                            <option value="">Select fee structure</option>
                            {structures?.map((s) => (
                                <option key={s.id} value={s.id}>
                                    FY{s.fiscalYear} — {classes?.find((c) => c.id === s.classId)?.name ?? s.classId} ({s.boardingStatus})
                                </option>
                            ))}
                        </select>
                        {errors.feeStructureId && <p className="text-red-500 text-sm">{errors.feeStructureId.message}</p>}
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Debtors Account</label>
                        <select className="select select-bordered w-full" {...register('debtorsAccountId', { required: true })}>
                            <option value="">Select account</option>
                            {debtorAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                            <SaveIcon size={16} /> Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Record Payment modal ----

const RecordPaymentModal: React.FC<{ invoice: FeeInvoice; onClose: () => void }> = ({ invoice, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const assetAccounts = accounts?.filter((a) => a.type === 'asset')

    const [recordPayment] = useRecordPaymentMutation()
    const { register, handleSubmit, watch, formState: { errors } } = useForm<NewPaymentValues>({
        defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), periodId: invoice.periodId },
    })
    const method = watch('paymentMethod')

    const onSubmit: SubmitHandler<NewPaymentValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording payment...')
        try {
            await recordPayment({
                studentId: invoice.studentId,
                invoiceId: invoice.id,
                paymentDate: formValues.paymentDate,
                amount: Number(formValues.amount),
                paymentMethod: formValues.paymentMethod,
                referenceNo: blank(formValues.referenceNo),
                cashAccountId: Number(formValues.cashAccountId),
                debtorsAccountId: Number(formValues.debtorsAccountId),
                periodId: Number(formValues.periodId),
                receivedBy: user!.id,
            }).unwrap()
            toast.success('Payment recorded', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record payment'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <h2 className="text-xl font-bold text-green-800 mb-1">Record Payment</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Invoice {invoice.invoiceNo} — total {formatMoney(invoice.totalAmount)}
                </p>
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
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="mpesa">M-Pesa</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{method === 'mpesa' ? 'M-Pesa Code' : 'Reference No.'}</label>
                            <input className="input input-bordered w-full" {...register('referenceNo')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Cash/Bank Account</label>
                            <select className="select select-bordered w-full" {...register('cashAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {assetAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Debtors Account</label>
                            <select className="select select-bordered w-full" {...register('debtorsAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {assetAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                            <SaveIcon size={16} /> Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Page ----

const FeesPage: React.FC = () => {
    const [tab, setTab] = useState<'structures' | 'invoices' | 'collections'>('invoices')
    const [isStructureModalOpen, setIsStructureModalOpen] = useState(false)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
    const [payingInvoice, setPayingInvoice] = useState<FeeInvoice | null>(null)

    const { can } = useCan()
    const canManageStructures = can('fees.structure.manage')
    const canManageInvoices = can('fees.invoice.manage')
    const canReceipt = can('fees.receipt.create')

    const { data: structures, isLoading: structuresLoading, isError: structuresError } = useGetAllStructuresQuery()
    const { data: invoices, isLoading: invoicesLoading, isError: invoicesError } = useGetAllInvoicesQuery()
    const { data: classes } = useGetAllClassesQuery()
    const { data: students } = useGetAllStudentsQuery()
    const { data: periods } = useGetAllPeriodsQuery()

    const studentLabel = (id: number) => {
        const s = students?.find((s) => s.id === id)
        return s ? `${s.firstName} ${s.lastName}` : `#${id}`
    }
    const periodLabel = (id: number) => periods?.find((p) => p.id === id)?.name ?? `#${id}`

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <HandCoins className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Fees</h1>
                </div>
                {tab === 'structures' && canManageStructures && (
                    <button onClick={() => setIsStructureModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Fee Structure
                    </button>
                )}
                {tab === 'invoices' && canManageInvoices && (
                    <button onClick={() => setIsInvoiceModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Invoice
                    </button>
                )}
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setTab('invoices')}>Invoices</a>
                <a role="tab" className={`tab ${tab === 'collections' ? 'tab-active' : ''}`} onClick={() => setTab('collections')}>Collections</a>
                {canManageStructures && (
                    <a role="tab" className={`tab ${tab === 'structures' ? 'tab-active' : ''}`} onClick={() => setTab('structures')}>Fee Structures</a>
                )}
            </div>

            {tab === 'structures' && (
                structuresLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : structuresError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load fee structures.</p></div>
                ) : !structures || structures.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No fee structures yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto scroll-fade-x">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Fiscal Year</th>
                                        <th>Period</th>
                                        <th>Class</th>
                                        <th>Boarding</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {structures.map((s) => (
                                        <tr key={s.id} className="hover:bg-gray-50">
                                            <td>{s.fiscalYear}</td>
                                            <td>{periodLabel(s.periodId)}</td>
                                            <td>{classes?.find((c) => c.id === s.classId)?.name ?? s.classId}</td>
                                            <td className="capitalize text-sm text-gray-600">{s.boardingStatus}</td>
                                            <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-ghost'} capitalize`}>{s.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {tab === 'invoices' && (
                invoicesLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : invoicesError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load invoices.</p></div>
                ) : !invoices || invoices.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No invoices yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto scroll-fade-x">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Invoice No.</th>
                                        <th>Student</th>
                                        <th>Period</th>
                                        <th className="text-right">Total</th>
                                        <th>Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50">
                                            <td className="font-mono text-sm">{inv.invoiceNo}</td>
                                            <td className="font-medium text-gray-800">{studentLabel(inv.studentId)}</td>
                                            <td>{periodLabel(inv.periodId)}</td>
                                            <td className="text-right font-mono">{formatMoney(inv.totalAmount)}</td>
                                            <td><span className={`badge ${INVOICE_STATUS_BADGE[inv.status] ?? 'badge-ghost'} capitalize`}>{inv.status.replace('_', ' ')}</span></td>
                                            <td className="text-center">
                                                {canReceipt && (inv.status === 'open' || inv.status === 'partially_paid') && (
                                                    <button onClick={() => setPayingInvoice(inv)} className="btn btn-ghost btn-xs text-green-800" title="Record Payment">
                                                        <Banknote size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {tab === 'collections' && <CollectionsTab />}

            {isStructureModalOpen && <NewStructureModal onClose={() => setIsStructureModalOpen(false)} />}
            {isInvoiceModalOpen && <NewInvoiceModal onClose={() => setIsInvoiceModalOpen(false)} />}
            {payingInvoice && <RecordPaymentModal invoice={payingInvoice} onClose={() => setPayingInvoice(null)} />}
        </DashboardLayout>
    )
}

export default FeesPage
