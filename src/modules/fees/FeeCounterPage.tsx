import React, { useState } from 'react'
import { Search, UserSquare2, AlertCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllStudentsQuery } from '../students/StudentApi'
import { useGetInvoicesByStudentQuery, useGetPaymentsByStudentQuery } from './FeesApi'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const INVOICE_STATUS_BADGE: Record<string, string> = {
    open: 'badge-warning',
    partially_paid: 'badge-info',
    paid: 'badge-success',
    cancelled: 'badge-ghost',
}

// ---- Student fee card ----

const StudentFeeCard: React.FC<{ student: Student }> = ({ student }) => {
    const { data: invoices, isLoading: invoicesLoading } = useGetInvoicesByStudentQuery(student.id)
    const { data: payments, isLoading: paymentsLoading } = useGetPaymentsByStudentQuery(student.id)

    if (invoicesLoading || paymentsLoading) {
        return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
    }

    const totalBilled = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = totalBilled - totalPaid

    const hasNoInvoice = !invoices || invoices.length === 0

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{student.firstName} {student.lastName}</h2>
                        <p className="text-sm text-gray-500 font-mono">{student.admissionNo}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Balance</div>
                        <div className={`text-2xl font-bold font-mono ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {formatMoney(balance)}
                        </div>
                        <div className="text-xs text-gray-500">
                            Billed {formatMoney(totalBilled)} · Paid {formatMoney(totalPaid)}
                        </div>
                    </div>
                </div>
            </div>

            {hasNoInvoice ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-amber-900">No invoice has been raised for this student.</p>
                        <p className="text-sm text-amber-800 mt-1">
                            A payment can only be receipted against an invoice. Ask the Bursar to raise one for the
                            current term, then receipt the payment here.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-5 pt-4">Invoices</h3>
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Invoice No.</th>
                                    <th>Date</th>
                                    <th className="text-right">Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{inv.invoiceNo}</td>
                                        <td>{inv.invoiceDate}</td>
                                        <td className="text-right font-mono">{formatMoney(inv.totalAmount)}</td>
                                        <td><span className={`badge ${INVOICE_STATUS_BADGE[inv.status] ?? 'badge-ghost'} capitalize`}>{inv.status.replace('_', ' ')}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-5 pt-4">Payments</h3>
                {!payments || payments.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">No payments received yet.</div>
                ) : (
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{p.receiptNo}</td>
                                        <td>{p.paymentDate}</td>
                                        <td className="capitalize">{p.paymentMethod}</td>
                                        <td className="font-mono text-sm text-gray-500">{p.referenceNo ?? '—'}</td>
                                        <td className="text-right font-mono">{formatMoney(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

// ---- Page ----

const FeeCounterPage: React.FC = () => {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Student | null>(null)
    const { data: students, isLoading } = useGetAllStudentsQuery()

    // Matches how a parent identifies a child at the counter: by name, or by
    // the admission number printed on the fee slip they are holding.
    const term = search.trim().toLowerCase()
    const matches = term.length < 2
        ? []
        : (students ?? []).filter((s) =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(term) ||
            s.admissionNo.toLowerCase().includes(term),
        ).slice(0, 8)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <UserSquare2 className="text-green-800" size={24} />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Fee Counter</h1>
                    <p className="text-sm text-gray-500">Find a student to view their balance and receipt a payment</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        autoFocus
                        className="input input-bordered w-full pl-10"
                        placeholder="Search by student name or admission number"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
                    />
                </label>

                {isLoading && <p className="text-sm text-gray-400 mt-3">Loading students…</p>}

                {!selected && term.length >= 2 && (
                    matches.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-3">No student matches “{search}”.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-lg">
                            {matches.map((s) => (
                                <li key={s.id}>
                                    <button
                                        onClick={() => setSelected(s)}
                                        className="w-full text-left px-4 py-2 hover:bg-green-50 flex justify-between items-center"
                                    >
                                        <span className="font-medium text-gray-800">{s.firstName} {s.lastName}</span>
                                        <span className="font-mono text-sm text-gray-500">{s.admissionNo}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )
                )}
            </div>

            {selected
                ? <StudentFeeCard student={selected} />
                : <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">Search for a student to begin.</div>}
        </DashboardLayout>
    )
}

export default FeeCounterPage
