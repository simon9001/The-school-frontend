import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { Activity, XCircle, CheckCircle2, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState } from '../../store/store'
import { useGetSystemHealthQuery, useGetSystemRbacQuery } from './SystemApi'
import type { AccountFlag } from './types'

type Tab = 'health' | 'rbac'

const StatCard: React.FC<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }> = ({ label, value, tone = 'default' }) => {
    const toneClass = {
        default: 'text-gray-800',
        success: 'text-green-700',
        warning: 'text-amber-700',
        danger: 'text-red-600',
    }[tone]
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
        </div>
    )
}

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-600">{title}</div>
        <div className="p-5">{children}</div>
    </div>
)

const AllClear: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-2 text-sm text-gray-500">
        <CheckCircle2 size={16} className="text-green-600 shrink-0" />
        {children}
    </div>
)

const FLAG_TONE: Record<string, string> = {
    'Locked out': 'bg-red-500 text-white',
    'No role assigned': 'bg-amber-500 text-white',
    'Never signed in': 'bg-gray-400 text-white',
}

const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// ---- Health tab: is the server up, and are the accounts on it in good shape ----

const HealthTab: React.FC = () => {
    const { data, isLoading, isError, refetch, isFetching } = useGetSystemHealthQuery()

    if (isLoading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
    if (isError || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                <p className="text-red-700">Unable to load system health. Confirm the backend is running.</p>
            </div>
        )
    }

    const { runtime, users, flaggedAccounts } = data

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Server</h2>
                    <button onClick={() => refetch()} className="btn btn-ghost btn-xs text-green-800" disabled={isFetching}>
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard
                        label="Database"
                        value={runtime.databaseReachable ? `Connected (${runtime.databaseLatencyMs}ms)` : 'Unreachable'}
                        tone={runtime.databaseReachable ? 'success' : 'danger'}
                    />
                    <StatCard label="Uptime" value={formatUptime(runtime.uptimeSeconds)} />
                    <StatCard label="Environment" value={runtime.environment} />
                    <StatCard label="Node" value={runtime.nodeVersion} />
                    <StatCard label="Heap Used" value={`${runtime.heapUsedMb} MB`} />
                </div>
            </div>

            <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Accounts</h2>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <StatCard label="Total" value={String(users.total)} />
                    <StatCard label="Active" value={String(users.active)} tone="success" />
                    <StatCard label="Suspended" value={String(users.suspended)} tone={users.suspended > 0 ? 'warning' : 'default'} />
                    <StatCard label="Locked Out Now" value={String(users.lockedOut)} tone={users.lockedOut > 0 ? 'danger' : 'default'} />
                    <StatCard label="Never Signed In" value={String(users.neverLoggedIn)} tone={users.neverLoggedIn > 0 ? 'warning' : 'default'} />
                    <StatCard label="Failed Attempts" value={String(users.withFailedAttempts)} tone={users.withFailedAttempts > 0 ? 'warning' : 'default'} />
                </div>
            </div>

            <Panel title={`Accounts Needing Attention (${flaggedAccounts.length})`}>
                {flaggedAccounts.length === 0 ? (
                    <AllClear>Every account is active, assigned a role, and has been signed into.</AllClear>
                ) : (
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>Name</th><th>Email</th><th>Issue</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                                {flaggedAccounts.map((a: AccountFlag, i) => (
                                    <tr key={`${a.id}-${i}`} className="hover:bg-gray-50">
                                        <td className="font-medium text-gray-800">{a.fullName}</td>
                                        <td className="font-mono text-xs text-gray-500">{a.email}</td>
                                        <td><span className={`badge border-none ${FLAG_TONE[a.reason] ?? 'bg-gray-400 text-white'}`}>{a.reason}</span></td>
                                        <td className="text-sm text-gray-600">{a.detail}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    )
}

// ---- RBAC tab: does the database still match rbac.ts, and does anyone hold
// both sides of a maker-checker pair ----

const RbacTab: React.FC = () => {
    const { data, isLoading, isError } = useGetSystemRbacQuery()

    if (isLoading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
    if (isError || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                <p className="text-red-700">Unable to load RBAC status.</p>
            </div>
        )
    }

    const { drift, conflicts, roleUsage, catalogue } = data
    const unusedRoles = roleUsage.filter((r) => r.userCount === 0)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Permissions in rbac.ts" value={String(catalogue.permissions)} />
                <StatCard label="Roles in rbac.ts" value={String(catalogue.roles)} />
                <StatCard label="Catalogue Sync" value={drift.inSync ? 'In sync' : 'Drifted'} tone={drift.inSync ? 'success' : 'warning'} />
                <StatCard label="Duty Conflicts" value={String(conflicts.length)} tone={conflicts.length > 0 ? 'danger' : 'success'} />
            </div>

            <Panel title="Catalogue Drift">
                {drift.inSync ? (
                    <AllClear>The database matches <code className="font-mono text-xs">rbac.ts</code> exactly.</AllClear>
                ) : (
                    <div className="space-y-3">
                        {drift.missingPermissions.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-red-600 mb-1">
                                    <AlertTriangle size={14} /> {drift.missingPermissions.length} permission(s) in rbac.ts but not in the database
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {drift.missingPermissions.map((c) => <span key={c} className="badge badge-outline badge-sm font-mono">{c}</span>)}
                                </div>
                            </div>
                        )}
                        {drift.missingRoles.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-red-600 mb-1">
                                    <AlertTriangle size={14} /> {drift.missingRoles.length} role(s) in rbac.ts but not in the database
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {drift.missingRoles.map((c) => <span key={c} className="badge badge-outline badge-sm font-mono">{c}</span>)}
                                </div>
                            </div>
                        )}
                        {drift.missingRolePermissions.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-1">
                                    <AlertTriangle size={14} /> {drift.missingRolePermissions.length} role grant(s) not applied
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {drift.missingRolePermissions.slice(0, 30).map((p) => (
                                        <span key={`${p.roleCode}-${p.permissionCode}`} className="badge badge-outline badge-sm font-mono">
                                            {p.roleCode} → {p.permissionCode}
                                        </span>
                                    ))}
                                    {drift.missingRolePermissions.length > 30 && (
                                        <span className="text-xs text-gray-500 self-center">+{drift.missingRolePermissions.length - 30} more</span>
                                    )}
                                </div>
                            </div>
                        )}
                        {drift.orphanRolePermissions.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-red-600 mb-1">
                                    <AlertTriangle size={14} /> {drift.orphanRolePermissions.length} grant(s) the database still makes but rbac.ts does not
                                </div>
                                <p className="text-xs text-gray-500 mb-1">
                                    Access narrowed in code but never revoked in the database — these users still hold the permission.
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {drift.orphanRolePermissions.slice(0, 30).map((p) => (
                                        <span key={`${p.roleCode}-${p.permissionCode}`} className="badge badge-outline badge-sm font-mono">
                                            {p.roleCode} → {p.permissionCode}
                                        </span>
                                    ))}
                                    {drift.orphanRolePermissions.length > 30 && (
                                        <span className="text-xs text-gray-500 self-center">+{drift.orphanRolePermissions.length - 30} more</span>
                                    )}
                                </div>
                            </div>
                        )}
                        {(drift.orphanPermissions.length > 0 || drift.orphanRoles.length > 0) && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-1">
                                    <AlertTriangle size={14} /> Present in the database but no longer in rbac.ts
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...drift.orphanRoles, ...drift.orphanPermissions].map((c) => (
                                        <span key={c} className="badge badge-outline badge-sm font-mono">{c}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="text-xs text-gray-500 border-t pt-3">
                            Missing entries are applied by running <code className="font-mono bg-gray-100 px-1 rounded">pnpm db:sync-rbac</code> in the
                            backend. That sync is additive only — it never deletes, so orphans have to be removed deliberately.
                        </div>
                    </div>
                )}
            </Panel>

            <Panel title={`Segregation of Duties Conflicts (${conflicts.length})`}>
                {conflicts.length === 0 ? (
                    <AllClear>No user holds both sides of a maker-checker pair.</AllClear>
                ) : (
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>User</th><th>Email</th><th>Conflict</th><th>Permissions</th></tr>
                            </thead>
                            <tbody>
                                {conflicts.map((conflict, i) => (
                                    <tr key={`${conflict.userId}-${i}`} className="hover:bg-gray-50">
                                        <td className="font-medium text-gray-800">
                                            <span className="flex items-center gap-1.5"><ShieldAlert size={14} className="text-red-500" />{conflict.fullName}</span>
                                        </td>
                                        <td className="font-mono text-xs text-gray-500">{conflict.email}</td>
                                        <td className="text-sm text-gray-700">{conflict.rule}</td>
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                {conflict.permissions.map((p) => <span key={p} className="badge badge-outline badge-sm font-mono">{p}</span>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-500 mt-3">
                            No single role grants both sides of these pairs — each conflict comes from one user holding two roles that combine to defeat
                            the control. Resolve it on the Users page by removing one of the roles.
                        </p>
                    </div>
                )}
            </Panel>

            <Panel title="Role Assignment">
                <div className="overflow-x-auto scroll-fade-x">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-gray-50"><th>Role</th><th>Code</th><th className="text-right">Users</th></tr>
                        </thead>
                        <tbody>
                            {roleUsage.map((r) => (
                                <tr key={r.roleId} className="hover:bg-gray-50">
                                    <td className="font-medium text-gray-800">{r.name}</td>
                                    <td className="font-mono text-xs text-gray-500">{r.code}</td>
                                    <td className={`text-right font-semibold ${r.userCount === 0 ? 'text-gray-300' : 'text-gray-800'}`}>{r.userCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {unusedRoles.length > 0 && (
                    <p className="text-xs text-gray-500 mt-3">{unusedRoles.length} role(s) have no users assigned.</p>
                )}
            </Panel>
        </div>
    )
}

// ---- Page ----

const SystemHealthPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canSeeRbac = user?.permissions.includes('roles.manage') ?? false
    const [tab, setTab] = useState<Tab>('health')

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="text-green-800" size={24} />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">System Health</h1>
                    <p className="text-sm text-gray-500">Server, accounts, and access-control integrity</p>
                </div>
            </div>

            {canSeeRbac && (
                <div className="tabs tabs-boxed mb-6 w-fit">
                    <button className={`tab ${tab === 'health' ? 'tab-active' : ''}`} onClick={() => setTab('health')}>Server &amp; Accounts</button>
                    <button className={`tab ${tab === 'rbac' ? 'tab-active' : ''}`} onClick={() => setTab('rbac')}>Access Control</button>
                </div>
            )}

            {tab === 'health' || !canSeeRbac ? <HealthTab /> : <RbacTab />}
        </DashboardLayout>
    )
}

export default SystemHealthPage
