import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { UserCog, Plus, X, SaveIcon, XCircle, Pencil, Key } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import UserPermissionsTab from './UserPermissionsTab'
import type { RootState } from '../../store/store'
import {
    useGetAllUsersQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useResetPasswordMutation,
    useAssignRoleMutation,
    useRemoveRoleMutation,
    useGetAllRolesQuery,
} from './IdentityApi'
import type { ManagedUser, NewUserValues, RoleWithPermissions, UpdateUserValues, UserStatus } from './types'

const STATUS_SELECT_CLASS: Record<UserStatus, string> = {
    active: 'bg-green-600 text-white',
    suspended: 'bg-amber-500 text-white',
    locked: 'bg-red-500 text-white',
}

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New User modal ----

const NewUserModal: React.FC<{ roles: RoleWithPermissions[]; onClose: () => void }> = ({ roles, onClose }) => {
    const [createUser] = useCreateUserMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewUserValues>()

    const onSubmit: SubmitHandler<NewUserValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating user...')
        try {
            await createUser({
                ...formValues,
                phone: blank(formValues.phone),
                roleIds: (formValues.roleIds as unknown as string[]).map(Number),
            }).unwrap()
            toast.success('User created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create user'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">New User</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" className="input input-bordered w-full" {...register('email', { required: 'Email is required' })} />
                        {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input className="input input-bordered w-full" {...register('fullName', { required: 'Full name is required' })} />
                        {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName.message}</p>}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <input className="input input-bordered w-full" {...register('phone')} />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Initial Password</label>
                        <input type="text" className="input input-bordered w-full" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })} />
                        {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
                        <p className="text-xs text-gray-400 mt-1">The user will be required to change this on first login.</p>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
                        <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                            {roles.map((r) => (
                                <label key={r.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" className="checkbox checkbox-sm" value={r.id} {...register('roleIds', { required: 'Select at least one role' })} />
                                    {r.name}
                                </label>
                            ))}
                        </div>
                        {errors.roleIds && <p className="text-red-500 text-sm">{errors.roleIds.message}</p>}
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

// ---- Manage User modal (edit, deactivate, reset password, role chips) ----

const ManageUserModal: React.FC<{ user: ManagedUser; roles: RoleWithPermissions[]; onClose: () => void }> = ({ user, roles, onClose }) => {
    const [updateUser] = useUpdateUserMutation()
    const [resetPassword] = useResetPasswordMutation()
    const [assignRole] = useAssignRoleMutation()
    const [removeRole] = useRemoveRoleMutation()

    const { register: registerEdit, handleSubmit: handleEditSubmit } = useForm<UpdateUserValues>({
        defaultValues: { fullName: user.fullName, phone: user.phone ?? '', status: user.status },
    })
    const { register: registerPw, handleSubmit: handlePwSubmit, reset: resetPwForm, formState: { errors: pwErrors } } = useForm<{ newPassword: string }>()
    const [addRoleId, setAddRoleId] = useState('')
    const [tab, setTab] = useState<'access' | 'permissions'>('access')

    const onSaveEdit: SubmitHandler<UpdateUserValues> = async (formValues) => {
        const loadingToastId = toast.loading('Saving...')
        try {
            await updateUser({ id: user.id, changes: { ...formValues, phone: blank(formValues.phone) } }).unwrap()
            toast.success('User updated', { id: loadingToastId })
        } catch {
            toast.error('Failed to update user', { id: loadingToastId })
        }
    }

    const handleDeactivate = async () => {
        const loadingToastId = toast.loading('Deactivating...')
        try {
            await updateUser({ id: user.id, changes: { status: 'suspended' } }).unwrap()
            toast.success('User deactivated', { id: loadingToastId })
        } catch {
            toast.error('Failed to deactivate user', { id: loadingToastId })
        }
    }

    const handleReactivate = async () => {
        const loadingToastId = toast.loading('Reactivating...')
        try {
            await updateUser({ id: user.id, changes: { status: 'active' } }).unwrap()
            toast.success('User reactivated', { id: loadingToastId })
        } catch {
            toast.error('Failed to reactivate user', { id: loadingToastId })
        }
    }

    const onResetPassword: SubmitHandler<{ newPassword: string }> = async (formValues) => {
        const loadingToastId = toast.loading('Resetting password...')
        try {
            await resetPassword({ id: user.id, values: formValues }).unwrap()
            toast.success('Password reset', { id: loadingToastId })
            resetPwForm()
        } catch {
            toast.error('Failed to reset password', { id: loadingToastId })
        }
    }

    const handleAddRole = async () => {
        if (!addRoleId) return
        const loadingToastId = toast.loading('Assigning role...')
        try {
            await assignRole({ userId: user.id, roleId: Number(addRoleId) }).unwrap()
            toast.success('Role assigned', { id: loadingToastId })
            setAddRoleId('')
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to assign role'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleRemoveRole = async (roleId: number) => {
        const loadingToastId = toast.loading('Removing role...')
        try {
            await removeRole({ userId: user.id, roleId }).unwrap()
            toast.success('Role removed', { id: loadingToastId })
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to remove role'
            toast.error(message, { id: loadingToastId })
        }
    }

    const availableRoles = roles.filter((r) => !user.roles.some((ur) => ur.id === r.id))

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="flex items-start justify-between mb-1">
                    <h2 className="text-xl font-bold text-green-800">{user.fullName}</h2>
                    {user.status === 'active' ? (
                        <button type="button" onClick={handleDeactivate} className="btn btn-xs bg-amber-500 hover:bg-amber-600 text-white">Deactivate</button>
                    ) : (
                        <button type="button" onClick={handleReactivate} className="btn btn-xs bg-green-700 hover:bg-green-800 text-white">Reactivate</button>
                    )}
                </div>
                <p className="text-sm text-gray-500 font-mono mb-4">{user.email}</p>

                <div role="tablist" className="tabs tabs-bordered mb-4">
                    <button type="button" role="tab" aria-selected={tab === 'access'} className={`tab ${tab === 'access' ? 'tab-active' : ''}`} onClick={() => setTab('access')}>
                        Details &amp; Roles
                    </button>
                    <button type="button" role="tab" aria-selected={tab === 'permissions'} className={`tab ${tab === 'permissions' ? 'tab-active' : ''}`} onClick={() => setTab('permissions')}>
                        Permissions
                    </button>
                </div>

                {/* Both tab panels stay mounted and are toggled with Tailwind's
                    `hidden` class (display:none, unlike the bare hidden
                    attribute which layout rules can override). Unmounting the
                    access branch reset both react-hook-form instances, so an
                    admin who typed a name change, checked the Permissions tab
                    and came back found the edit silently reverted. */}
                <div className={tab === 'access' ? '' : 'hidden'}>
                <form onSubmit={handleEditSubmit(onSaveEdit)} className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Details</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <input className="input input-bordered input-sm" placeholder="Full name" {...registerEdit('fullName')} />
                        <input className="input input-bordered input-sm" placeholder="Phone" {...registerEdit('phone')} />
                        <select className="select select-bordered select-sm col-span-2" {...registerEdit('status')}>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="locked">Locked</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">Save Details</button>
                </form>

                <form onSubmit={handlePwSubmit(onResetPassword)} className="mb-6 border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Reset Password</h3>
                    <div className="flex gap-2">
                        <input className="input input-bordered input-sm flex-1" placeholder="New password" {...registerPw('newPassword', { required: true, minLength: { value: 8, message: 'At least 8 characters' } })} />
                        <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Key size={14} /> Reset</button>
                    </div>
                    {pwErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.newPassword.message}</p>}
                </form>

                <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Roles</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {user.roles.map((r) => (
                            <span key={r.id} className="badge badge-outline gap-1">
                                {r.name}
                                <button type="button" onClick={() => handleRemoveRole(r.id)} className="text-red-500 hover:text-red-700">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <select value={addRoleId} onChange={(e) => setAddRoleId(e.target.value)} className="select select-bordered select-sm flex-1">
                            <option value="">Add a role...</option>
                            {availableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button type="button" onClick={handleAddRole} disabled={!addRoleId} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Plus size={14} /> Add</button>
                    </div>
                </div>
                </div>

                <div className={tab === 'permissions' ? '' : 'hidden'}>
                    <UserPermissionsTab userId={user.id} />
                </div>

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
                </div>
            </div>
        </div>
    )
}

// ---- Page ----

const UsersPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManageUsers = user?.permissions.includes('users.manage') ?? false

    const { data: users, isLoading, isError } = useGetAllUsersQuery()
    const { data: roles } = useGetAllRolesQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [managing, setManaging] = useState<ManagedUser | null>(null)
    const [updateUser] = useUpdateUserMutation()

    const handleQuickDeactivate = async (u: ManagedUser) => {
        const loadingToastId = toast.loading('Deactivating...')
        try {
            await updateUser({ id: u.id, changes: { status: 'suspended' } }).unwrap()
            toast.success('User deactivated', { id: loadingToastId })
        } catch {
            toast.error('Failed to deactivate user', { id: loadingToastId })
        }
    }

    const handleQuickReactivate = async (u: ManagedUser) => {
        const loadingToastId = toast.loading('Reactivating...')
        try {
            await updateUser({ id: u.id, changes: { status: 'active' } }).unwrap()
            toast.success('User reactivated', { id: loadingToastId })
        } catch {
            toast.error('Failed to reactivate user', { id: loadingToastId })
        }
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <UserCog className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Users</h1>
                </div>
                {canManageUsers && (
                    <button onClick={() => setIsAddOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New User
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load users.</p></div>
            ) : !users || users.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No users yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Email</th>
                                    <th>Name</th>
                                    <th>Roles</th>
                                    <th>Status</th>
                                    <th>Last Login</th>
                                    {canManageUsers && <th className="text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{u.email}</td>
                                        <td className="font-medium text-gray-800">{u.fullName}</td>
                                        <td>
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {u.roles.map((r) => <span key={r.id} className="badge badge-outline badge-sm">{r.name}</span>)}
                                            </div>
                                        </td>
                                        <td><span className={`badge capitalize border-none ${STATUS_SELECT_CLASS[u.status]}`}>{u.status}</span></td>
                                        <td className="text-sm text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                                        {canManageUsers && (
                                            <td className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => setManaging(u)} className="btn btn-ghost btn-xs text-green-800" title="Edit">
                                                        <Pencil size={14} />
                                                    </button>
                                                    {u.status === 'active' ? (
                                                        <button onClick={() => handleQuickDeactivate(u)} className="btn btn-ghost btn-xs text-amber-600" title="Deactivate">
                                                            Deactivate
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleQuickReactivate(u)} className="btn btn-ghost btn-xs text-green-700" title="Reactivate">
                                                            Reactivate
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddOpen && <NewUserModal roles={roles ?? []} onClose={() => setIsAddOpen(false)} />}
            {managing && <ManageUserModal user={managing} roles={roles ?? []} onClose={() => setManaging(null)} />}
        </DashboardLayout>
    )
}

export default UsersPage
