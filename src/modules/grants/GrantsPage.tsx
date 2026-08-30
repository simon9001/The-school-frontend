import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { PiggyBank, Plus, X, SaveIcon, XCircle } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllGrantTypesQuery,
    useCreateGrantTypeMutation,
    useGetAllDisbursementsQuery,
    useRecordDisbursementMutation,
} from './GrantApi'
import type { RootState } from '../../store/store'
import type { NewDisbursementValues, NewGrantTypeValues } from './types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New Grant Type modal ----

const NewGrantTypeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: funds } = useGetAllFundsQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const revenueAccounts = accounts?.filter((a) => a.type === 'revenue')
    const [createGrantType] = useCreateGrantTypeMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewGrantTypeValues>()

    const onSubmit: SubmitHandler<NewGrantTypeValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating grant type...')
        try {
            await createGrantType({
                ...formValues,
                fundId: Number(formValues.fundId),
                revenueAccountId: Number(formValues.revenueAccountId),
                conditionsDescription: blank(formValues.conditionsDescription),
            }).unwrap()
            toast.success('Grant type created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create grant type'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Grant Type</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input className="input input-bordered w-full" placeholder="e.g. FDSE Capitation" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Fund</label>
                        <select className="select select-bordered w-full" {...register('fundId', { required: true })}>
                            <option value="">Select fund</option>
                            {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Revenue Account</label>
                        <select className="select select-bordered w-full" {...register('revenueAccountId', { required: true })}>
                            <option value="">Select account</option>
                            {revenueAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Conditions (optional)</label>
                        <textarea className="textarea textarea-bordered w-full" placeholder="e.g. Restricted to tuition and approved operational voteheads" {...register('conditionsDescription')} />
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

// ---- Record Disbursement modal ----

const RecordDisbursementModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: grantTypes } = useGetAllGrantTypesQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const cashAccounts = accounts?.filter((a) => a.type === 'asset')
    const [recordDisbursement] = useRecordDisbursementMutation()
    const { register, handleSubmit, watch, formState: { errors } } = useForm<NewDisbursementValues>({
        defaultValues: { dateReceived: new Date().toISOString().slice(0, 10), conditionsMet: false },
    })
    const conditionsMet = watch('conditionsMet')

    const onSubmit: SubmitHandler<NewDisbursementValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording disbursement...')
        try {
            await recordDisbursement({
                ...formValues,
                grantTypeId: Number(formValues.grantTypeId),
                periodId: Number(formValues.periodId),
                cashAccountId: Number(formValues.cashAccountId),
                expectedAmount: formValues.expectedAmount ? Number(formValues.expectedAmount) : undefined,
                amountReceived: Number(formValues.amountReceived),
                conditionsMet: Boolean(formValues.conditionsMet),
                notes: blank(formValues.notes),
                recordedBy: user!.id,
            }).unwrap()
            toast.success('Disbursement recorded', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record disbursement'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">Record Disbursement</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Grant Type</label>
                        <select className="select select-bordered w-full" {...register('grantTypeId', { required: 'Grant type is required' })}>
                            <option value="">Select grant type</option>
                            {grantTypes?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        {errors.grantTypeId && <p className="text-red-500 text-sm">{errors.grantTypeId.message}</p>}
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
                            <label className="block text-sm font-medium text-gray-700">Date Received</label>
                            <input type="date" className="input input-bordered w-full" {...register('dateReceived', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Expected Amount</label>
                            <input type="number" step="0.01" className="input input-bordered w-full" {...register('expectedAmount')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount Received</label>
                            <input type="number" step="0.01" className="input input-bordered w-full" {...register('amountReceived', { required: 'Amount is required' })} />
                            {errors.amountReceived && <p className="text-red-500 text-sm">{errors.amountReceived.message}</p>}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Cash/Bank Account</label>
                            <select className="select select-bordered w-full" {...register('cashAccountId', { required: true })}>
                                <option value="">Select account</option>
                                {cashAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mb-4 flex items-center gap-2">
                        <input id="conditionsMet" type="checkbox" className="checkbox checkbox-sm" {...register('conditionsMet')} />
                        <label htmlFor="conditionsMet" className="text-sm text-gray-700">Conditions have been met (recognize as income now)</label>
                    </div>
                    {!conditionsMet && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-4">
                            Per IPSAS 23/47, this receipt will be recorded but not yet recognized as income until conditions are met — no journal entry will be posted.
                        </p>
                    )}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                        <textarea className="textarea textarea-bordered w-full" {...register('notes')} />
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

const GrantsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('grants.record') ?? false

    const [tab, setTab] = useState<'disbursements' | 'types'>('disbursements')
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)
    const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false)

    const { data: grantTypes, isLoading: typesLoading, isError: typesError } = useGetAllGrantTypesQuery()
    const { data: disbursements, isLoading: disbursementsLoading, isError: disbursementsError } = useGetAllDisbursementsQuery()

    const grantTypeName = (id: number) => grantTypes?.find((g) => g.id === id)?.name ?? `#${id}`

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <PiggyBank className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Grants / Capitation</h1>
                </div>
                {canManage && (
                    tab === 'types' ? (
                        <button onClick={() => setIsTypeModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                            <Plus size={16} /> New Grant Type
                        </button>
                    ) : (
                        <button onClick={() => setIsDisbursementModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                            <Plus size={16} /> Record Disbursement
                        </button>
                    )
                )}
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'disbursements' ? 'tab-active' : ''}`} onClick={() => setTab('disbursements')}>Disbursements</a>
                <a role="tab" className={`tab ${tab === 'types' ? 'tab-active' : ''}`} onClick={() => setTab('types')}>Grant Types</a>
            </div>

            {tab === 'types' && (
                typesLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : typesError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load grant types.</p></div>
                ) : !grantTypes || grantTypes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No grant types yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>Name</th><th>Conditions</th></tr>
                            </thead>
                            <tbody>
                                {grantTypes.map((g) => (
                                    <tr key={g.id} className="hover:bg-gray-50">
                                        <td className="font-medium text-gray-800">{g.name}</td>
                                        <td className="text-sm text-gray-600">{g.conditionsDescription ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {tab === 'disbursements' && (
                disbursementsLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : disbursementsError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load disbursements.</p></div>
                ) : !disbursements || disbursements.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No disbursements recorded yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Grant Type</th>
                                        <th>Date Received</th>
                                        <th className="text-right">Expected</th>
                                        <th className="text-right">Received</th>
                                        <th>Recognition</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {disbursements.map((d) => (
                                        <tr key={d.id} className="hover:bg-gray-50">
                                            <td className="font-medium text-gray-800">{grantTypeName(d.grantTypeId)}</td>
                                            <td>{d.dateReceived}</td>
                                            <td className="text-right font-mono">{d.expectedAmount ? formatMoney(d.expectedAmount) : '—'}</td>
                                            <td className="text-right font-mono">{formatMoney(d.amountReceived)}</td>
                                            <td>
                                                <span className={`badge ${d.conditionsMet ? 'badge-success' : 'badge-warning'}`}>
                                                    {d.conditionsMet ? 'Recognized' : 'Deferred'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {isTypeModalOpen && <NewGrantTypeModal onClose={() => setIsTypeModalOpen(false)} />}
            {isDisbursementModalOpen && <RecordDisbursementModal onClose={() => setIsDisbursementModalOpen(false)} />}
        </DashboardLayout>
    )
}

export default GrantsPage
