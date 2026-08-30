import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Boxes, Plus, X, SaveIcon, XCircle, Tags, TrendingDown, Trash2 } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllAssetCategoriesQuery,
    useCreateAssetCategoryMutation,
    useGetAllAssetsQuery,
    useAcquireAssetMutation,
    useRunDepreciationMutation,
    useDisposeAssetMutation,
} from './AssetApi'
import type { RootState } from '../../store/store'
import type { AssetStatus, DepreciationMethod } from './types'

const STATUS_BADGE: Record<AssetStatus, string> = {
    in_use: 'badge-success',
    disposed: 'badge-ghost',
    written_off: 'badge-error',
}

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---- New Category modal ----

type CategoryFormValues = {
    name: string
    defaultUsefulLifeYears: number
    depreciationMethod: DepreciationMethod
    assetAccountId?: number
    depreciationExpenseAccountId?: number
    accumulatedDepreciationAccountId?: number
}

const NewCategoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: accounts } = useGetAllAccountsQuery()
    const [createCategory] = useCreateAssetCategoryMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<CategoryFormValues>({
        defaultValues: { depreciationMethod: 'straight_line' },
    })

    const onSubmit: SubmitHandler<CategoryFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating category...')
        try {
            await createCategory({
                name: formValues.name,
                defaultUsefulLifeYears: Number(formValues.defaultUsefulLifeYears),
                depreciationMethod: formValues.depreciationMethod,
                assetAccountId: Number(formValues.assetAccountId),
                depreciationExpenseAccountId: Number(formValues.depreciationExpenseAccountId),
                accumulatedDepreciationAccountId: Number(formValues.accumulatedDepreciationAccountId),
            }).unwrap()
            toast.success('Category created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create category'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Asset Category</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input className="input input-bordered w-full" placeholder="e.g. Buildings" {...register('name', { required: 'Name is required' })} />
                            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Default Useful Life (years)</label>
                            <input type="number" className="input input-bordered w-full" {...register('defaultUsefulLifeYears', { required: true, min: 1 })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Depreciation Method</label>
                            <select className="select select-bordered w-full" {...register('depreciationMethod')}>
                                <option value="straight_line">Straight line</option>
                                <option value="reducing_balance">Reducing balance</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Asset Account</label>
                            <select className="select select-bordered w-full" {...register('assetAccountId', { required: true })}>
                                <option value="">Select</option>
                                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Depreciation Expense Account</label>
                            <select className="select select-bordered w-full" {...register('depreciationExpenseAccountId', { required: true })}>
                                <option value="">Select</option>
                                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Accumulated Depreciation Account</label>
                            <select className="select select-bordered w-full" {...register('accumulatedDepreciationAccountId', { required: true })}>
                                <option value="">Select</option>
                                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
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

// ---- Acquire Asset modal ----

type AcquireFormValues = {
    assetTag: string
    categoryId?: number
    name: string
    description?: string
    acquisitionDate: string
    acquisitionCost: number
    fundId?: number
    location?: string
    periodId?: number
    creditAccountId?: number
}

const AcquireAssetModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: categories } = useGetAllAssetCategoriesQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const [acquireAsset] = useAcquireAssetMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<AcquireFormValues>()

    const onSubmit: SubmitHandler<AcquireFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording acquisition...')
        try {
            await acquireAsset({
                assetTag: formValues.assetTag,
                categoryId: Number(formValues.categoryId),
                name: formValues.name,
                description: formValues.description || undefined,
                acquisitionDate: formValues.acquisitionDate,
                acquisitionCost: Number(formValues.acquisitionCost),
                fundId: Number(formValues.fundId),
                location: formValues.location || undefined,
                periodId: Number(formValues.periodId),
                creditAccountId: Number(formValues.creditAccountId),
                createdBy: user!.id,
            }).unwrap()
            toast.success('Asset acquired and posted', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to acquire asset'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">Acquire Asset</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Asset Tag</label>
                            <input className="input input-bordered w-full" placeholder="e.g. FA-0001" {...register('assetTag', { required: 'Asset tag is required' })} />
                            {errors.assetTag && <p className="text-red-500 text-sm">{errors.assetTag.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Category</label>
                            <select className="select select-bordered w-full" {...register('categoryId', { required: true })}>
                                <option value="">Select</option>
                                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input className="input input-bordered w-full" placeholder="e.g. Science Block" {...register('name', { required: 'Name is required' })} />
                            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                            <input className="input input-bordered w-full" {...register('description')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Acquisition Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('acquisitionDate', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Acquisition Cost</label>
                            <input type="number" step="0.01" className="input input-bordered w-full" {...register('acquisitionCost', { required: true, min: 0.01 })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fund</label>
                            <select className="select select-bordered w-full" {...register('fundId', { required: true })}>
                                <option value="">Select</option>
                                {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Location (optional)</label>
                            <input className="input input-bordered w-full" {...register('location')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fiscal Period</label>
                            <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                                <option value="">Select</option>
                                {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Credit Account (funding source)</label>
                            <select className="select select-bordered w-full" {...register('creditAccountId', { required: true })}>
                                <option value="">Select</option>
                                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
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

// ---- Run Depreciation modal ----

type DepreciationFormValues = { periodId?: number; asOfDate: string }

const RunDepreciationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: periods } = useGetAllPeriodsQuery()
    const [runDepreciation] = useRunDepreciationMutation()
    const { register, handleSubmit } = useForm<DepreciationFormValues>()

    const onSubmit: SubmitHandler<DepreciationFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Running depreciation...')
        try {
            const results = await runDepreciation({
                periodId: Number(formValues.periodId),
                asOfDate: formValues.asOfDate,
                createdBy: user!.id,
            }).unwrap()
            toast.success(`Depreciation posted for ${results.length} asset(s)`, { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to run depreciation'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-md">
                <h2 className="text-xl font-bold text-green-800 mb-4">Run Depreciation</h2>
                <p className="text-sm text-gray-500 mb-4">Posts straight-line depreciation for every in-use asset not yet fully depreciated.</p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fiscal Period</label>
                        <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                            <option value="">Select</option>
                            {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">As Of Date</label>
                        <input type="date" className="input input-bordered w-full" {...register('asOfDate', { required: true })} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><TrendingDown size={16} /> Run</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Dispose modal ----

type DisposeFormValues = {
    disposalDate: string
    periodId?: number
    proceeds: number
    cashAccountId?: number
    gainLossAccountId?: number
}

const DisposeAssetModal: React.FC<{ assetId: number; assetName: string; onClose: () => void }> = ({ assetId, assetName, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: accounts } = useGetAllAccountsQuery()
    const [disposeAsset] = useDisposeAssetMutation()
    const { register, handleSubmit } = useForm<DisposeFormValues>({ defaultValues: { proceeds: 0 } })

    const onSubmit: SubmitHandler<DisposeFormValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording disposal...')
        try {
            await disposeAsset({
                id: assetId,
                values: {
                    disposalDate: formValues.disposalDate,
                    periodId: Number(formValues.periodId),
                    proceeds: Number(formValues.proceeds ?? 0),
                    cashAccountId: Number(formValues.cashAccountId),
                    gainLossAccountId: Number(formValues.gainLossAccountId),
                    recordedBy: user!.id,
                },
            }).unwrap()
            toast.success('Asset disposed', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to dispose asset'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-md">
                <h2 className="text-xl font-bold text-green-800 mb-1">Dispose Asset</h2>
                <p className="text-sm text-gray-500 mb-4">{assetName}</p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Disposal Date</label>
                        <input type="date" className="input input-bordered w-full" {...register('disposalDate', { required: true })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fiscal Period</label>
                        <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                            <option value="">Select</option>
                            {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Proceeds</label>
                        <input type="number" step="0.01" className="input input-bordered w-full" {...register('proceeds', { min: 0 })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cash / Receivable Account</label>
                        <select className="select select-bordered w-full" {...register('cashAccountId', { required: true })}>
                            <option value="">Select</option>
                            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Gain / Loss on Disposal Account</label>
                        <select className="select select-bordered w-full" {...register('gainLossAccountId', { required: true })}>
                            <option value="">Select</option>
                            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-red-700 hover:bg-red-800 text-white"><Trash2 size={16} /> Dispose</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Page ----

const AssetsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('assets.manage') ?? false

    const [tab, setTab] = useState<'assets' | 'categories'>('assets')
    const { data: assets, isLoading, isError } = useGetAllAssetsQuery()
    const { data: categories } = useGetAllAssetCategoriesQuery()

    const [isAcquireOpen, setIsAcquireOpen] = useState(false)
    const [isCategoryOpen, setIsCategoryOpen] = useState(false)
    const [isDepreciationOpen, setIsDepreciationOpen] = useState(false)
    const [disposingAsset, setDisposingAsset] = useState<{ id: number; name: string } | null>(null)

    const categoryName = (id: number) => categories?.find((c) => c.id === id)?.name ?? `#${id}`

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Boxes className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Fixed Assets</h1>
                </div>
                {canManage && (
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setIsDepreciationOpen(true)} className="btn btn-outline border-green-800 text-green-800 hover:bg-green-800 hover:text-white flex items-center gap-2">
                            <TrendingDown size={16} /> Run Depreciation
                        </button>
                        <button onClick={() => setIsCategoryOpen(true)} className="btn btn-outline border-green-800 text-green-800 hover:bg-green-800 hover:text-white flex items-center gap-2">
                            <Tags size={16} /> New Category
                        </button>
                        <button onClick={() => setIsAcquireOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                            <Plus size={16} /> Acquire Asset
                        </button>
                    </div>
                )}
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'assets' ? 'tab-active' : ''}`} onClick={() => setTab('assets')}>Assets</a>
                <a role="tab" className={`tab ${tab === 'categories' ? 'tab-active' : ''}`} onClick={() => setTab('categories')}>Categories</a>
            </div>

            {tab === 'assets' ? (
                isLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : isError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load assets.</p></div>
                ) : !assets || assets.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No assets recorded yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Tag</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Location</th>
                                        <th className="text-right">Cost</th>
                                        <th>Acquired</th>
                                        <th>Status</th>
                                        {canManage && <th className="text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.map((a) => (
                                        <tr key={a.id} className="hover:bg-gray-50">
                                            <td className="font-mono text-sm">{a.assetTag}</td>
                                            <td className="font-medium text-gray-800">{a.name}</td>
                                            <td>{categoryName(a.categoryId)}</td>
                                            <td className="text-gray-500 text-sm">{a.location ?? '—'}</td>
                                            <td className="text-right font-mono">{formatMoney(a.acquisitionCost)}</td>
                                            <td className="text-sm text-gray-500">{new Date(a.acquisitionDate).toLocaleDateString()}</td>
                                            <td><span className={`badge ${STATUS_BADGE[a.status]} capitalize`}>{a.status.replace('_', ' ')}</span></td>
                                            {canManage && (
                                                <td className="text-center">
                                                    {a.status === 'in_use' && (
                                                        <button onClick={() => setDisposingAsset({ id: a.id, name: a.name })} className="btn btn-ghost btn-xs text-red-600" title="Dispose">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                !categories || categories.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No categories yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Name</th>
                                        <th>Useful Life</th>
                                        <th>Method</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50">
                                            <td className="font-medium text-gray-800">{c.name}</td>
                                            <td>{c.defaultUsefulLifeYears} yrs</td>
                                            <td className="capitalize">{c.depreciationMethod.replace('_', ' ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {isAcquireOpen && <AcquireAssetModal onClose={() => setIsAcquireOpen(false)} />}
            {isCategoryOpen && <NewCategoryModal onClose={() => setIsCategoryOpen(false)} />}
            {isDepreciationOpen && <RunDepreciationModal onClose={() => setIsDepreciationOpen(false)} />}
            {disposingAsset && <DisposeAssetModal assetId={disposingAsset.id} assetName={disposingAsset.name} onClose={() => setDisposingAsset(null)} />}
        </DashboardLayout>
    )
}

export default AssetsPage
