import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Landmark, Plus, X, SaveIcon, XCircle, Ban } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllFundsQuery, useAddFundMutation, useDeactivateFundMutation } from './FundApi'
import type { RootState } from '../../store/store'
import type { NewFundValues } from './types'

const FundsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('ledger.funds.manage') ?? false

    const { data: funds, isLoading, isError } = useGetAllFundsQuery()
    const [addFund] = useAddFundMutation()
    const [deactivateFund] = useDeactivateFundMutation()

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewFundValues>()

    const onSubmit: SubmitHandler<NewFundValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating fund...')
        try {
            await addFund(formValues).unwrap()
            toast.success('Fund created', { id: loadingToastId })
            reset()
            setIsAddModalOpen(false)
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create fund'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleDeactivate = (id: number, name: string) => {
        Swal.fire({
            title: 'Deactivate this fund?',
            text: `"${name}" will be marked inactive.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#166534',
            cancelButtonColor: '#dc2626',
            confirmButtonText: 'Yes, deactivate',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deactivateFund(id).unwrap()
                    Swal.fire('Deactivated', '', 'success')
                } catch {
                    Swal.fire('Something went wrong', 'Please try again', 'error')
                }
            }
        })
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Landmark className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Funds / Voteheads</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} />
                        New Fund
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load funds.</p>
                </div>
            ) : !funds || funds.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No funds yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Restriction</th>
                                    <th>Status</th>
                                    {canManage && <th className="text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {funds.map((fund) => (
                                    <tr key={fund.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{fund.code}</td>
                                        <td>
                                            <div className="font-medium text-gray-800">{fund.name}</div>
                                            {fund.restrictionNotes && <div className="text-xs text-gray-500 max-w-xs truncate">{fund.restrictionNotes}</div>}
                                        </td>
                                        <td>
                                            <span className={`badge ${fund.restrictionType === 'restricted' ? 'badge-warning' : 'badge-outline'}`}>
                                                {fund.restrictionType}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${fund.isActive ? 'badge-success' : 'badge-ghost'}`}>
                                                {fund.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="text-center">
                                                {fund.isActive && (
                                                    <button
                                                        onClick={() => handleDeactivate(fund.id, fund.name)}
                                                        className="btn btn-ghost btn-xs text-red-600"
                                                        title="Deactivate"
                                                    >
                                                        <Ban size={14} />
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
            )}

            {isAddModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h2 className="text-xl font-bold text-green-800 mb-4">New Fund</h2>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="mb-4">
                                <label htmlFor="code" className="block text-sm font-medium text-gray-700">Code</label>
                                <input id="code" className="input input-bordered w-full" {...register('code', { required: 'Code is required' })} />
                                {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
                            </div>
                            <div className="mb-4">
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                <input id="name" className="input input-bordered w-full" {...register('name', { required: 'Name is required' })} />
                                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                            </div>
                            <div className="mb-4">
                                <label htmlFor="restrictionType" className="block text-sm font-medium text-gray-700">Restriction</label>
                                <select id="restrictionType" className="select select-bordered w-full" {...register('restrictionType', { required: true })}>
                                    <option value="unrestricted">Unrestricted</option>
                                    <option value="restricted">Restricted</option>
                                </select>
                            </div>
                            <div className="mb-6">
                                <label htmlFor="restrictionNotes" className="block text-sm font-medium text-gray-700">Restriction Notes</label>
                                <textarea id="restrictionNotes" className="textarea textarea-bordered w-full" {...register('restrictionNotes')} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost">
                                    <X size={16} /> Cancel
                                </button>
                                <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                                    <SaveIcon size={16} /> Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default FundsPage
