import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    useGetUserPermissionsQuery,
    useSetPermissionOverrideMutation,
    useClearPermissionOverrideMutation,
} from './IdentityApi'
import type { UserPermission } from './types'

const SOURCE_BADGE: Record<UserPermission['source'], string> = {
    role: 'badge-ghost',
    granted: 'badge-success',
    revoked: 'badge-error',
}

/**
 * The full 94-permission catalogue as it applies to one user, grouped by
 * module with a search box. Shows the effective answer rather than only the
 * exceptions, because the admin's real question is "what can this person
 * actually do?" — which an exceptions-only view cannot answer without knowing
 * every role's contents by heart.
 */
const UserPermissionsTab: React.FC<{ userId: number }> = ({ userId }) => {
    const { data: permissions, isLoading, isError } = useGetUserPermissionsQuery(userId)
    const [setOverride] = useSetPermissionOverrideMutation()
    const [clearOverride] = useClearPermissionOverrideMutation()
    const [search, setSearch] = useState('')
    // The last-administrator guard explains a rule about one specific
    // permission, so the rejection belongs next to that row - in a scrolling
    // list of 94 rows a corner toast leaves the reader guessing which one it
    // refers to. Only one row can be failing at a time: a new attempt clears
    // the previous message.
    const [rowError, setRowError] = useState<{ code: string; message: string } | null>(null)

    const byModule = useMemo(() => {
        const grouped = new Map<string, UserPermission[]>()
        const needle = search.trim().toLowerCase()
        for (const p of permissions ?? []) {
            if (needle && !p.code.toLowerCase().includes(needle) && !p.description.toLowerCase().includes(needle)) continue
            const bucket = grouped.get(p.module) ?? []
            bucket.push(p)
            grouped.set(p.module, bucket)
        }
        return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [permissions, search])

    const apply = async (code: string, next: 'role' | 'granted' | 'revoked') => {
        setRowError(null)
        const loadingToastId = toast.loading('Updating permission...')
        try {
            if (next === 'role') await clearOverride({ userId, code }).unwrap()
            else await setOverride({ userId, code, granted: next === 'granted' }).unwrap()
            toast.success('Permission updated', { id: loadingToastId })
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to update permission'
            toast.dismiss(loadingToastId)
            setRowError({ code, message })
        }
    }

    if (isLoading) {
        return <div className="flex justify-center py-10"><span className="loading loading-spinner text-green-800"></span></div>
    }
    if (isError) {
        return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-700">Unable to load permissions.</div>
    }

    return (
        <div>
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permissions by code or description..."
                aria-label="Search permissions"
                className="input input-bordered input-sm w-full mb-3"
            />

            <div className="max-h-96 overflow-y-auto pr-1">
                {byModule.map(([module, rows]) => (
                    <div key={module} className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{module}</h4>
                        {rows.map((p) => (
                            <div key={p.code}>
                                <div
                                    className={`flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 ${p.source !== 'role' ? 'bg-amber-50' : ''}`}
                                >
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs text-gray-800 truncate">{p.code}</div>
                                        <div className="text-xs text-gray-500 truncate">{p.description}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`badge badge-sm ${SOURCE_BADGE[p.source]}`}>
                                            {p.effective ? 'allowed' : 'denied'}
                                        </span>
                                        <select
                                            value={p.source}
                                            onChange={(e) => apply(p.code, e.target.value as 'role' | 'granted' | 'revoked')}
                                            aria-label={`Override for ${p.code}`}
                                            className="select select-bordered select-xs"
                                        >
                                            <option value="role">Default (role)</option>
                                            <option value="granted">Grant</option>
                                            <option value="revoked">Revoke</option>
                                        </select>
                                    </div>
                                </div>
                                {rowError?.code === p.code && (
                                    <p
                                        role="alert"
                                        className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 my-1 text-xs text-red-700"
                                    >
                                        {rowError.message}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
                {byModule.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-6">No permissions match that search.</p>
                )}
            </div>
        </div>
    )
}

export default UserPermissionsTab
