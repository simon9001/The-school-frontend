import React, { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { ShieldCheck, X, XCircle, Eye, Search, Users as UsersIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState } from '../../store/store'
import { useGetAllRolesQuery, useGetAllPermissionsQuery, useGetAllUsersQuery } from './IdentityApi'
import type { PermissionDef, RoleWithPermissions } from './types'

type Tab = 'roles' | 'permissions'

const RolesPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    // This page is gated on roles.manage, but the user list behind the counts
    // is gated on users.manage. Both sit on system_admin today, so they always
    // coincide — skip rather than assume, so a future roles-only admin sees no
    // count column instead of a silent zero against every role.
    const canCountUsers = user?.permissions.includes('users.manage') ?? false

    const { data: roles, isLoading, isError } = useGetAllRolesQuery()
    const { data: permissions } = useGetAllPermissionsQuery()
    const { data: users } = useGetAllUsersQuery(undefined, { skip: !canCountUsers })
    const [viewing, setViewing] = useState<RoleWithPermissions | null>(null)
    const [tab, setTab] = useState<Tab>('roles')
    const [search, setSearch] = useState('')

    // How many people actually hold each role — a role catalogue without this
    // can't answer "who can approve payments right now".
    const userCountByRoleId = useMemo(() => {
        const counts = new Map<number, number>()
        for (const u of users ?? []) {
            for (const r of u.roles) counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
        }
        return counts
    }, [users])

    const permissionsByModule = useMemo(() => {
        const grouped = new Map<string, PermissionDef[]>()
        const term = search.trim().toLowerCase()
        for (const p of permissions ?? []) {
            if (term && !p.code.toLowerCase().includes(term) && !p.description.toLowerCase().includes(term)) continue
            const existing = grouped.get(p.module)
            if (existing) existing.push(p)
            else grouped.set(p.module, [p])
        }
        return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    }, [permissions, search])

    // Which roles grant a given permission — the reverse lookup the role list
    // alone can't answer.
    const rolesByPermission = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const role of roles ?? []) {
            for (const code of role.permissions) {
                const existing = map.get(code)
                if (existing) existing.push(role.name)
                else map.set(code, [role.name])
            }
        }
        return map
    }, [roles])

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <ShieldCheck className="text-green-800" size={24} />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Roles &amp; Permissions</h1>
                    <p className="text-sm text-gray-500">
                        {roles?.length ?? 0} roles, {permissions?.length ?? 0} permissions — defined in the backend&apos;s{' '}
                        <code className="font-mono text-xs">rbac.ts</code> and assigned to users on the Users page
                    </p>
                </div>
            </div>

            <div className="tabs tabs-boxed mb-6 w-fit">
                <button className={`tab ${tab === 'roles' ? 'tab-active' : ''}`} onClick={() => setTab('roles')}>Roles</button>
                <button className={`tab ${tab === 'permissions' ? 'tab-active' : ''}`} onClick={() => setTab('permissions')}>Permission Catalogue</button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load roles.</p></div>
            ) : tab === 'roles' ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Description</th>
                                    {canCountUsers && <th className="text-center">Users</th>}
                                    <th className="text-center">Permissions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles?.map((r) => {
                                    const userCount = userCountByRoleId.get(r.id) ?? 0
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="font-medium text-gray-800">{r.name}</td>
                                            <td className="font-mono text-xs text-gray-500">{r.code}</td>
                                            <td className="text-sm text-gray-600 max-w-md">{r.description}</td>
                                            {canCountUsers && (
                                                <td className="text-center">
                                                    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${userCount === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        <UsersIcon size={13} /> {userCount}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="text-center">
                                                <button onClick={() => setViewing(r)} className="btn btn-ghost btn-xs text-green-800" title="View permissions">
                                                    <Eye size={14} /> {r.permissions.length}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search permissions by code or description..."
                            className="input input-bordered w-full pl-9"
                        />
                    </div>

                    {permissionsByModule.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No permissions match that search.</div>
                    ) : (
                        permissionsByModule.map(([module, items]) => (
                            <div key={module} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-600 capitalize">{module.replace(/_/g, ' ')}</span>
                                    <span className="text-xs text-gray-400">{items.length} permission(s)</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="table table-sm w-full">
                                        <tbody>
                                            {items.map((p) => {
                                                const holders = rolesByPermission.get(p.code) ?? []
                                                return (
                                                    <tr key={p.id} className="hover:bg-gray-50">
                                                        <td className="font-mono text-xs text-gray-700 w-64 align-top">{p.code}</td>
                                                        <td className="text-sm text-gray-600 align-top">{p.description}</td>
                                                        <td className="align-top w-72">
                                                            {holders.length === 0 ? (
                                                                <span className="text-xs text-amber-600">No role grants this</span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {holders.map((name) => <span key={name} className="badge badge-outline badge-sm">{name}</span>)}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {viewing && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-lg">
                        <h2 className="text-xl font-bold text-green-800 mb-1">{viewing.name}</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            {viewing.permissions.length} permissions
                            {canCountUsers && ` · ${userCountByRoleId.get(viewing.id) ?? 0} user(s) hold this role`}
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto">
                            {[...viewing.permissions].sort().map((p) => <span key={p} className="badge badge-outline badge-sm font-mono">{p}</span>)}
                        </div>
                        <div className="flex justify-end mt-4">
                            <button type="button" onClick={() => setViewing(null)} className="btn btn-ghost btn-sm">
                                <X size={16} /> Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default RolesPage
