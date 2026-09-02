import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { CalendarCheck2, Plus, X, SaveIcon, XCircle, Pencil, Lock, AlertTriangle } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState } from '../../store/store'
import {
    useGetAllPeriodsQuery,
    useCreatePeriodMutation,
    useUpdatePeriodMutation,
    useClosePeriodMutation,
} from './PeriodApi'
import type { FiscalPeriod, NewPeriodValues } from './types'

const today = () => new Date().toISOString().slice(0, 10)

// react-hook-form hands back '' for an untouched optional field, which the
// backend's z.number().int().optional() rejects — only undefined satisfies it.
const blankNumber = (v: unknown) => (v === '' || v === undefined || v === null ? undefined : Number(v))

// ---- Create / edit modal ----

const PeriodModal: React.FC<{ period: FiscalPeriod | null; onClose: () => void }> = ({ period, onClose }) => {
    const [createPeriod] = useCreatePeriodMutation()
    const [updatePeriod] = useUpdatePeriodMutation()
    const isEdit = period !== null

    const { register, handleSubmit, formState: { errors } } = useForm<NewPeriodValues>({
        defaultValues: period
            ? { name: period.name, fiscalYear: period.fiscalYear, term: period.term ?? undefined, startDate: period.startDate, endDate: period.endDate }
            : { fiscalYear: new Date().getFullYear() },
    })

    const onSubmit: SubmitHandler<NewPeriodValues> = async (formValues) => {
        const payload = {
            ...formValues,
            fiscalYear: Number(formValues.fiscalYear),
            term: blankNumber(formValues.term),
        }
        const loadingToastId = toast.loading(isEdit ? 'Saving period...' : 'Creating period...')
        try {
            if (isEdit) await updatePeriod({ id: period.id, changes: payload }).unwrap()
            else await createPeriod(payload).unwrap()
            toast.success(isEdit ? 'Period updated' : 'Period created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to save period'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">{isEdit ? 'Edit Period' : 'New Fiscal Period'}</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input className="input input-bordered w-full" placeholder="2026 Term 1" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fiscal Year</label>
                            <input type="number" className="input input-bordered w-full" {...register('fiscalYear', { required: 'Fiscal year is required' })} />
                            {errors.fiscalYear && <p className="text-red-500 text-sm">{errors.fiscalYear.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Term</label>
                            <select className="select select-bordered w-full" {...register('term')}>
                                <option value="">Full year</option>
                                <option value="1">Term 1</option>
                                <option value="2">Term 2</option>
                                <option value="3">Term 3</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('startDate', { required: 'Start date is required' })} />
                            {errors.startDate && <p className="text-red-500 text-sm">{errors.startDate.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('endDate', { required: 'End date is required' })} />
                            {errors.endDate && <p className="text-red-500 text-sm">{errors.endDate.message}</p>}
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

// ---- Page ----

const FiscalPeriodsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('ledger.periods.manage') ?? false

    const { data: periods, isLoading, isError } = useGetAllPeriodsQuery()
    const [closePeriod] = useClosePeriodMutation()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editing, setEditing] = useState<FiscalPeriod | null>(null)

    const asOf = today()
    const overdue = (periods ?? []).filter((p) => p.status === 'open' && p.endDate < asOf)
    const current = (periods ?? []).find((p) => p.startDate <= asOf && p.endDate >= asOf)

    const handleClose = async (period: FiscalPeriod) => {
        const result = await Swal.fire({
            title: `Close ${period.name}?`,
            text: 'Closing a period is permanent. No journal entry can be posted into it afterwards, and it cannot be edited or reopened from this system.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#166534',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, close it',
        })
        if (!result.isConfirmed) return

        const loadingToastId = toast.loading('Closing period...')
        try {
            await closePeriod(period.id).unwrap()
            toast.success(`${period.name} closed`, { id: loadingToastId })
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to close period'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <CalendarCheck2 className="text-green-800" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Fiscal Periods</h1>
                        <p className="text-sm text-gray-500">
                            {current ? `Current period: ${current.name}` : 'No period covers today'}
                        </p>
                    </div>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Period
                    </button>
                )}
            </div>

            {overdue.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-amber-800">
                        <span className="font-semibold">{overdue.length} period(s) ended but are still open.</span>{' '}
                        An open period keeps accepting journal entries, so postings can still land in a term that is supposed to be finished:{' '}
                        {overdue.map((p) => p.name).join(', ')}.
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load fiscal periods.</p></div>
            ) : !periods || periods.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No fiscal periods yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Name</th>
                                    <th>Year</th>
                                    <th>Term</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Status</th>
                                    {canManage && <th className="text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {periods.map((p) => {
                                    const isOverdue = p.status === 'open' && p.endDate < asOf
                                    return (
                                        <tr key={p.id} className={`hover:bg-gray-50 ${current?.id === p.id ? 'bg-green-50' : ''}`}>
                                            <td className="font-medium text-gray-800">
                                                {p.name}
                                                {current?.id === p.id && <span className="badge badge-sm bg-green-600 text-white border-none ml-2">Current</span>}
                                            </td>
                                            <td className="text-sm text-gray-600">{p.fiscalYear}</td>
                                            <td className="text-sm text-gray-600">{p.term ?? 'Full year'}</td>
                                            <td className="text-sm text-gray-600">{p.startDate}</td>
                                            <td className={`text-sm ${isOverdue ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>{p.endDate}</td>
                                            <td>
                                                <span className={`badge border-none capitalize ${p.status === 'open' ? (isOverdue ? 'bg-amber-500 text-white' : 'bg-green-600 text-white') : 'bg-gray-400 text-white'}`}>
                                                    {isOverdue ? 'open — overdue' : p.status}
                                                </span>
                                            </td>
                                            {canManage && (
                                                <td className="text-center">
                                                    {p.status === 'open' ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => setEditing(p)} className="btn btn-ghost btn-xs text-green-800" title="Edit">
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button onClick={() => handleClose(p)} className="btn btn-ghost btn-xs text-amber-600" title="Close period">
                                                                <Lock size={14} /> Close
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">
                                                            Closed {p.closedAt ? new Date(p.closedAt).toLocaleDateString() : ''}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddOpen && <PeriodModal period={null} onClose={() => setIsAddOpen(false)} />}
            {editing && <PeriodModal period={editing} onClose={() => setEditing(null)} />}
        </DashboardLayout>
    )
}

export default FiscalPeriodsPage
