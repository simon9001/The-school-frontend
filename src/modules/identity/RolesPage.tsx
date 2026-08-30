import React, { useState } from 'react'
import { ShieldCheck, X, XCircle, Eye } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllRolesQuery } from './IdentityApi'
import type { RoleWithPermissions } from './types'

const RolesPage: React.FC = () => {
    const { data: roles, isLoading, isError } = useGetAllRolesQuery()
    const [viewing, setViewing] = useState<RoleWithPermissions | null>(null)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <ShieldCheck className="text-green-800" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Roles</h1>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load roles.</p></div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>Name</th><th>Code</th><th>Description</th><th className="text-center">Permissions</th></tr>
                            </thead>
                            <tbody>
                                {roles?.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="font-medium text-gray-800">{r.name}</td>
                                        <td className="font-mono text-xs text-gray-500">{r.code}</td>
                                        <td className="text-sm text-gray-600 max-w-md">{r.description}</td>
                                        <td className="text-center">
                                            <button onClick={() => setViewing(r)} className="btn btn-ghost btn-xs text-green-800" title="View permissions">
                                                <Eye size={14} /> {r.permissions.length}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {viewing && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-lg">
                        <h2 className="text-xl font-bold text-green-800 mb-1">{viewing.name}</h2>
                        <p className="text-sm text-gray-500 mb-4">{viewing.permissions.length} permissions</p>
                        <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto">
                            {viewing.permissions.map((p) => <span key={p} className="badge badge-outline badge-sm font-mono">{p}</span>)}
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
