import React, { useState } from 'react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Wallet, Plus, X, SaveIcon, XCircle, Trash2, Check, BarChart3 } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllBudgetsQuery,
    useGetBudgetByIdQuery,
    useGetBudgetVsActualQuery,
    useCreateBudgetMutation,
    useAddBudgetLineMutation,
    useApproveBudgetMutation,
} from './BudgetApi'
import type { RootState } from '../../store/store'
import type { BudgetStatus } from './types'

const STATUS_BADGE: Record<BudgetStatus, string> = {
    draft: 'badge-ghost',
    approved: 'badge-success',
    revised: 'badge-info',
}

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---- New Budget modal ----

type LineFormValue = { accountId?: number; fundId?: number; periodId?: number; amount?: number }
type BudgetFormValues = { fiscalYear: number; name: string; lines: LineFormValue[] }

const NewBudgetModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const [createBudget] = useCreateBudgetMutation()

    const { register, control, handleSubmit, formState: { errors } } = useForm<BudgetFormValues>({
        defaultValues: { fiscalYear: new Date().getFullYear(), lines: [{}] },
    })
    const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

    const onSubmit: SubmitHandler<BudgetFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating budget...')
        try {
            await createBudget({
                fiscalYear: Number(formValues.fiscalYear),
                name: formValues.name,
                createdBy: user!.id,
                lines: formValues.lines.map((l) => ({
                    accountId: Number(l.accountId),
                    fundId: Number(l.fundId),
                    periodId: l.periodId ? Number(l.periodId) : undefined,
                    amount: Number(l.amount),
                })),
            }).unwrap()
            toast.success('Budget created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create budget'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Budget</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fiscal Year</label>
                            <input type="number" className="input input-bordered w-full" {...register('fiscalYear', { required: true })} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input className="input input-bordered w-full" placeholder="e.g. 2026 Annual Budget" {...register('name', { required: 'Name is required' })} />
                            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Lines</h3>
                        <button type="button" onClick={() => append({})} className="btn btn-xs btn-ghost text-green-800">
                            <Plus size={14} /> Add Line
                        </button>
                    </div>
                    <div className="space-y-2 mb-6">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                                <select className="select select-bordered select-sm col-span-4" {...register(`lines.${index}.accountId`, { required: true })}>
                                    <option value="">Account</option>
                                    {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                                <select className="select select-bordered select-sm col-span-2" {...register(`lines.${index}.fundId`, { required: true })}>
                                    <option value="">Fund</option>
                                    {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <select className="select select-bordered select-sm col-span-3" {...register(`lines.${index}.periodId`)}>
                                    <option value="">Whole year</option>
                                    {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Amount" {...register(`lines.${index}.amount`, { required: true })} />
                                <button type="button" onClick={() => remove(index)} className="btn btn-ghost btn-sm btn-square col-span-1 text-red-600" disabled={fields.length === 1}>
                                    <Trash2 size={14} />
                                </button>
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

// ---- Detail modal ----

const DetailModal: React.FC<{ budgetId: number; canManage: boolean; canApprove: boolean; onClose: () => void }> = ({ budgetId, canManage, canApprove, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const [tab, setTab] = useState<'lines' | 'actual'>('lines')
    const { data: budget, isLoading } = useGetBudgetByIdQuery(budgetId)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: vsActual, isLoading: vsActualLoading } = useGetBudgetVsActualQuery(budgetId, { skip: tab !== 'actual' })
    const [addLine] = useAddBudgetLineMutation()
    const [approveBudget] = useApproveBudgetMutation()
    const { register, handleSubmit, reset } = useForm<{ accountId: number; fundId: number; periodId?: number; amount: number }>()

    const isDraft = budget?.status === 'draft'

    const onAddLine: SubmitHandler<{ accountId: number; fundId: number; periodId?: number; amount: number }> = async (formValues) => {
        const loadingToastId = toast.loading('Adding line...')
        try {
            await addLine({
                budgetId,
                line: {
                    accountId: Number(formValues.accountId),
                    fundId: Number(formValues.fundId),
                    periodId: formValues.periodId ? Number(formValues.periodId) : undefined,
                    amount: Number(formValues.amount),
                },
            }).unwrap()
            toast.success('Line added', { id: loadingToastId })
            reset()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to add line'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleApprove = async () => {
        const loadingToastId = toast.loading('Approving...')
        try {
            await approveBudget({ id: budgetId, approvedBy: user!.id }).unwrap()
            toast.success('Budget approved', { id: loadingToastId })
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to approve'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                {isLoading || !budget ? (
                    <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-green-800">{budget.name}</h2>
                                <p className="text-sm text-gray-500">FY{budget.fiscalYear}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`badge ${STATUS_BADGE[budget.status]} capitalize`}>{budget.status}</span>
                                {isDraft && canApprove && (
                                    <button onClick={handleApprove} className="btn btn-xs bg-green-800 hover:bg-green-900 text-white"><Check size={12} /> Approve</button>
                                )}
                            </div>
                        </div>

                        <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                            <a role="tab" className={`tab ${tab === 'lines' ? 'tab-active' : ''}`} onClick={() => setTab('lines')}>Lines</a>
                            <a role="tab" className={`tab ${tab === 'actual' ? 'tab-active' : ''}`} onClick={() => setTab('actual')}><BarChart3 size={14} className="mr-1" /> Budget vs Actual</a>
                        </div>

                        {tab === 'lines' ? (
                            <>
                                <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg mb-4">
                                    <table className="table table-sm w-full">
                                        <thead>
                                            <tr className="bg-gray-50"><th>Account</th><th>Fund</th><th>Scope</th><th className="text-right">Amount</th></tr>
                                        </thead>
                                        <tbody>
                                            {budget.lines.map((r) => (
                                                <tr key={r.line.id}>
                                                    <td>{r.accountCode} — {r.accountName}</td>
                                                    <td>{r.fundCode}</td>
                                                    <td className="text-gray-500 text-sm">{r.periodStart ? `${r.periodStart} to ${r.periodEnd}` : 'Whole year'}</td>
                                                    <td className="text-right font-mono">{formatMoney(r.line.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {isDraft && canManage && (
                                    <form onSubmit={handleSubmit(onAddLine)} className="grid grid-cols-12 gap-2 border-t pt-4">
                                        <select className="select select-bordered select-sm col-span-4" {...register('accountId', { required: true })}>
                                            <option value="">Account</option>
                                            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                        </select>
                                        <select className="select select-bordered select-sm col-span-2" {...register('fundId', { required: true })}>
                                            <option value="">Fund</option>
                                            {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                        <select className="select select-bordered select-sm col-span-3" {...register('periodId')}>
                                            <option value="">Whole year</option>
                                            {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <input type="number" step="0.01" className="input input-bordered input-sm col-span-2" placeholder="Amount" {...register('amount', { required: true })} />
                                        <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white col-span-1"><Plus size={14} /></button>
                                    </form>
                                )}
                            </>
                        ) : vsActualLoading ? (
                            <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div>
                        ) : !vsActual || vsActual.length === 0 ? (
                            <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">No lines to report on.</div>
                        ) : (
                            <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg">
                                <table className="table table-sm w-full">
                                    <thead>
                                        <tr className="bg-gray-50"><th>Account</th><th>Fund</th><th className="text-right">Budgeted</th><th className="text-right">Actual</th><th className="text-right">Variance</th></tr>
                                    </thead>
                                    <tbody>
                                        {vsActual.map((r) => (
                                            <tr key={`${r.accountId}-${r.fundId}`}>
                                                <td>{r.accountCode} — {r.accountName}</td>
                                                <td>{r.fundCode}</td>
                                                <td className="text-right font-mono">{formatMoney(r.budgeted)}</td>
                                                <td className="text-right font-mono">{formatMoney(r.actual)}</td>
                                                <td className={`text-right font-mono font-semibold ${r.variance < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatMoney(r.variance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

const BudgetsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('budget.manage') ?? false
    const canApprove = user?.permissions.includes('budget.approve') ?? false

    const { data: budgets, isLoading, isError } = useGetAllBudgetsQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [viewingId, setViewingId] = useState<number | null>(null)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Wallet className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Budgets</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Budget
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load budgets.</p></div>
            ) : !budgets || budgets.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No budgets yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Fiscal Year</th>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th className="text-center">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {budgets.map((b) => (
                                    <tr key={b.id} className="hover:bg-gray-50">
                                        <td>{b.fiscalYear}</td>
                                        <td className="font-medium text-gray-800">{b.name}</td>
                                        <td><span className={`badge ${STATUS_BADGE[b.status]} capitalize`}>{b.status}</span></td>
                                        <td className="text-sm text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                                        <td className="text-center">
                                            <button onClick={() => setViewingId(b.id)} className="btn btn-ghost btn-xs text-green-800" title="View">
                                                <BarChart3 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddOpen && <NewBudgetModal onClose={() => setIsAddOpen(false)} />}
            {viewingId !== null && <DetailModal budgetId={viewingId} canManage={canManage} canApprove={canApprove} onClose={() => setViewingId(null)} />}
        </DashboardLayout>
    )
}

export default BudgetsPage
