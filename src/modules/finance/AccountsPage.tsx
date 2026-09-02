import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { BookOpen, Plus, X, SaveIcon, XCircle, Ban } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery, useAddAccountMutation, useDeactivateAccountMutation } from './AccountApi'
import type { RootState } from '../../store/store'
import type { NewAccountValues } from './types'

const ACCOUNT_TYPES = ['asset', 'liability', 'net_assets', 'revenue', 'expense'] as const
const NORMAL_BALANCES = ['debit', 'credit'] as const

const AccountsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('ledger.accounts.manage') ?? false

    const { data: accounts, isLoading, isError } = useGetAllAccountsQuery()
    const [addAccount] = useAddAccountMutation()
    const [deactivateAccount] = useDeactivateAccountMutation()

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewAccountValues>()

    const onSubmit: SubmitHandler<NewAccountValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating account...')
        try {
            await addAccount(formValues).unwrap()
            toast.success('Account created', { id: loadingToastId })
            reset()
            setIsAddModalOpen(false)
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create account'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleDeactivate = (id: number, name: string) => {
        Swal.fire({
            title: 'Deactivate this account?',
            text: `"${name}" will be marked inactive.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#166534',
            cancelButtonColor: '#dc2626',
            confirmButtonText: 'Yes, deactivate',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deactivateAccount(id).unwrap()
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
                        <BookOpen className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Chart of Accounts</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} />
                        New Account
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
                    <p className="text-red-700">Unable to load the chart of accounts.</p>
                </div>
            ) : !accounts || accounts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No accounts yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Normal Balance</th>
                                    <th>Status</th>
                                    {canManage && <th className="text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => (
                                    <tr key={account.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{account.code}</td>
                                        <td className="font-medium text-gray-800">{account.name}</td>
                                        <td><span className="badge badge-outline capitalize">{account.type.replace('_', ' ')}</span></td>
                                        <td className="capitalize text-sm text-gray-600">{account.normalBalance}</td>
                                        <td>
                                            <span className={`badge ${account.isActive ? 'badge-success' : 'badge-ghost'}`}>
                                                {account.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="text-center">
                                                {account.isActive && (
                                                    <button
                                                        onClick={() => handleDeactivate(account.id, account.name)}
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
                        <h2 className="text-xl font-bold text-green-800 mb-4">New Account</h2>
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
                                <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
                                <select id="type" className="select select-bordered w-full" {...register('type', { required: true })}>
                                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div className="mb-6">
                                <label htmlFor="normalBalance" className="block text-sm font-medium text-gray-700">Normal Balance</label>
                                <select id="normalBalance" className="select select-bordered w-full" {...register('normalBalance', { required: true })}>
                                    {NORMAL_BALANCES.map((b) => <option key={b} value={b}>{b}</option>)}
                                </select>
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

export default AccountsPage
