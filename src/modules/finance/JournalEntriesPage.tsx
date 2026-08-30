import React, { useState } from 'react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Scale, Plus, X, SaveIcon, XCircle, Trash2, Eye, Check, Ban } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from './AccountApi'
import { useGetAllFundsQuery } from './FundApi'
import { useGetAllPeriodsQuery } from './PeriodApi'
import {
    useGetAllJournalEntriesQuery,
    useGetJournalEntryByIdQuery,
    useCreateManualJournalEntryMutation,
    useApproveJournalEntryMutation,
    useRejectJournalEntryMutation,
} from './JournalApi'
import type { RootState } from '../../store/store'
import type { JournalEntry, JournalStatus } from './types'

const STATUS_BADGE: Record<JournalStatus, string> = {
    draft: 'badge-ghost',
    pending_approval: 'badge-warning',
    posted: 'badge-success',
    rejected: 'badge-error',
    reversed: 'badge-ghost',
}

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New Journal Entry modal ----

type LineFormValue = { accountId?: number; fundId?: number; debit?: number; credit?: number; description: string }
type EntryFormValues = { periodId: number; entryDate: string; description: string; sourceReference?: string; lines: LineFormValue[] }

const NewEntryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const [createEntry] = useCreateManualJournalEntryMutation()

    const { register, control, handleSubmit, watch, formState: { errors } } = useForm<EntryFormValues>({
        defaultValues: { entryDate: new Date().toISOString().slice(0, 10), lines: [{ description: '' }, { description: '' }] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
    const watchedLines = watch('lines')

    const totalDebit = watchedLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
    const totalCredit = watchedLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0

    const onSubmit: SubmitHandler<EntryFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Submitting journal entry...')
        try {
            await createEntry({
                periodId: Number(formValues.periodId),
                entryDate: formValues.entryDate,
                description: formValues.description,
                sourceModule: 'manual',
                sourceReference: blank(formValues.sourceReference),
                createdBy: user!.id,
                lines: formValues.lines.map((l) => ({
                    accountId: Number(l.accountId),
                    fundId: Number(l.fundId),
                    debit: l.debit ? Number(l.debit) : undefined,
                    credit: l.credit ? Number(l.credit) : undefined,
                    description: blank(l.description),
                })),
            }).unwrap()
            toast.success('Journal entry submitted for approval', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to submit journal entry'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Journal Entry</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                                <option value="">Select period</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Entry Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('entryDate', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Reference (optional)</label>
                            <input className="input input-bordered w-full" {...register('sourceReference')} />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <input className="input input-bordered w-full" {...register('description', { required: 'Description is required' })} />
                            {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Lines</h3>
                        <button type="button" onClick={() => append({ description: '' })} className="btn btn-xs btn-ghost text-green-800">
                            <Plus size={14} /> Add Line
                        </button>
                    </div>
                    <div className="space-y-2 mb-2">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                                <select className="select select-bordered select-sm col-span-3" {...register(`lines.${index}.accountId`, { required: true })}>
                                    <option value="">Account</option>
                                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                                <select className="select select-bordered select-sm col-span-2" {...register(`lines.${index}.fundId`, { required: true })}>
                                    <option value="">Fund</option>
                                    {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <input className="input input-bordered input-sm col-span-3" placeholder="Description" {...register(`lines.${index}.description`)} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Debit" {...register(`lines.${index}.debit`)} />
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-1" placeholder="Credit" {...register(`lines.${index}.credit`)} />
                                <button type="button" onClick={() => remove(index)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length <= 2}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className={`mb-6 rounded-lg p-3 text-sm flex items-center justify-between ${isBalanced ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                        <span>Total Debit: {formatMoney(totalDebit)}</span>
                        <span>Total Credit: {formatMoney(totalCredit)}</span>
                        <span className="font-semibold">{isBalanced ? 'Balanced' : 'Not balanced'}</span>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" disabled={!isBalanced} className="btn bg-green-800 hover:bg-green-900 text-white disabled:opacity-50">
                            <SaveIcon size={16} /> Submit for Approval
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Detail modal ----

const DetailModal: React.FC<{ entryId: number; canApprove: boolean; onClose: () => void }> = ({ entryId, canApprove, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: entry, isLoading } = useGetJournalEntryByIdQuery(entryId)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const [approveEntry] = useApproveJournalEntryMutation()
    const [rejectEntry] = useRejectJournalEntryMutation()
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)

    const handleApprove = async () => {
        const loadingToastId = toast.loading('Approving...')
        try {
            await approveEntry({ id: entryId, approverId: user!.id }).unwrap()
            toast.success('Journal entry posted', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to approve'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) return
        const loadingToastId = toast.loading('Rejecting...')
        try {
            await rejectEntry({ id: entryId, approverId: user!.id, reason: rejectReason }).unwrap()
            toast.success('Journal entry rejected', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to reject'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                {isLoading || !entry ? (
                    <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-1">
                            <h2 className="text-xl font-bold text-green-800">{entry.entryNo}</h2>
                            <span className={`badge ${STATUS_BADGE[entry.status]} capitalize`}>{entry.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{entry.description}</p>
                        <p className="text-xs text-gray-400 mb-4">{entry.entryDate} — source: {entry.sourceModule}{entry.sourceReference ? ` (${entry.sourceReference})` : ''}</p>

                        <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                            <table className="table table-sm w-full">
                                <thead>
                                    <tr className="bg-gray-50"><th>Account</th><th>Fund</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
                                </thead>
                                <tbody>
                                    {entry.lines.map((l) => (
                                        <tr key={l.id}>
                                            <td>{accounts?.find((a) => a.id === l.accountId)?.name ?? l.accountId}</td>
                                            <td>{funds?.find((f) => f.id === l.fundId)?.name ?? l.fundId}</td>
                                            <td className="text-gray-500">{l.description ?? '—'}</td>
                                            <td className="text-right font-mono">{Number(l.debit) > 0 ? formatMoney(l.debit) : ''}</td>
                                            <td className="text-right font-mono">{Number(l.credit) > 0 ? formatMoney(l.credit) : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {entry.status === 'rejected' && entry.rejectionReason && (
                            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">Rejection reason: {entry.rejectionReason}</div>
                        )}

                        {entry.status === 'pending_approval' && canApprove && (
                            <div className="border-t pt-4">
                                {!showRejectForm ? (
                                    <div className="flex gap-2">
                                        <button onClick={handleApprove} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Check size={14} /> Approve & Post</button>
                                        <button onClick={() => setShowRejectForm(true)} className="btn btn-sm btn-ghost text-red-600"><Ban size={14} /> Reject</button>
                                    </div>
                                ) : (
                                    <div>
                                        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="textarea textarea-bordered w-full mb-2" placeholder="Reason for rejection" />
                                        <div className="flex gap-2">
                                            <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">Confirm Reject</button>
                                            <button onClick={() => setShowRejectForm(false)} className="btn btn-sm btn-ghost">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button>
                </div>
            </div>
        </div>
    )
}

// ---- Page ----

const JournalEntriesPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canCreate = user?.permissions.includes('ledger.journal.create') ?? false
    const canApprove = user?.permissions.includes('ledger.journal.approve') ?? false

    const { data: entries, isLoading, isError } = useGetAllJournalEntriesQuery()
    const [statusFilter, setStatusFilter] = useState('')
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [viewingId, setViewingId] = useState<number | null>(null)

    const filtered = entries?.filter((e) => !statusFilter || e.status === statusFilter)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Scale className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Journal Entries</h1>
                </div>
                {canCreate && (
                    <button onClick={() => setIsAddOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Journal Entry
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">All statuses</option>
                    {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load journal entries.</p></div>
            ) : !filtered || filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No journal entries yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Entry No.</th>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                    <th className="text-center">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e: JournalEntry) => (
                                    <tr key={e.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{e.entryNo}</td>
                                        <td>{e.entryDate}</td>
                                        <td className="font-medium text-gray-800">{e.description}</td>
                                        <td><span className="badge badge-outline capitalize">{e.sourceModule}</span></td>
                                        <td><span className={`badge ${STATUS_BADGE[e.status]} capitalize`}>{e.status.replace('_', ' ')}</span></td>
                                        <td className="text-center">
                                            <button onClick={() => setViewingId(e.id)} className="btn btn-ghost btn-xs text-green-800" title="View">
                                                <Eye size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddOpen && <NewEntryModal onClose={() => setIsAddOpen(false)} />}
            {viewingId !== null && <DetailModal entryId={viewingId} canApprove={canApprove} onClose={() => setViewingId(null)} />}
        </DashboardLayout>
    )
}

export default JournalEntriesPage
