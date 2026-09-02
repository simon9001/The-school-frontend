import React from 'react'
import { FileCheck2, XCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAuditLogQuery } from './IdentityApi'

const AuditLogPage: React.FC = () => {
    const { data: entries, isLoading, isError } = useGetAuditLogQuery({ limit: 200 })

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <FileCheck2 className="text-green-800" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Audit Log</h1>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load the audit log.</p></div>
            ) : !entries || entries.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No audit entries yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50"><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => (
                                    <tr key={e.entry.id} className="hover:bg-gray-50">
                                        <td className="text-sm text-gray-500 whitespace-nowrap">{new Date(e.entry.createdAt).toLocaleString()}</td>
                                        <td className="text-sm text-gray-800">{e.actorName ?? e.actorEmail ?? 'System'}</td>
                                        <td><span className="badge badge-outline badge-sm font-mono">{e.entry.action}</span></td>
                                        <td className="text-sm text-gray-600">{e.entry.entityType}#{e.entry.entityId}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default AuditLogPage
