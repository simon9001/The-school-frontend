import React, { useState } from 'react'
import { XCircle } from 'lucide-react'
import { useGetPaymentsInRangeQuery } from './FeesApi'
import { useGetAllStudentsQuery } from '../students/StudentApi'
import type { PaymentMethod } from './types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METHODS: PaymentMethod[] = ['cash', 'bank', 'mpesa', 'cheque']

const CollectionsTab: React.FC = () => {
    const today = new Date().toISOString().slice(0, 10)
    const [from, setFrom] = useState(today)
    const [to, setTo] = useState(today)

    const { data: payments, isLoading, isError } = useGetPaymentsInRangeQuery({ from, to })
    const { data: students } = useGetAllStudentsQuery()

    const studentLabel = (id: number) => {
        const s = students?.find((s) => s.id === id)
        return s ? `${s.firstName} ${s.lastName}` : `#${id}`
    }

    const rows = payments ?? []
    const total = rows.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalByMethod = METHODS.map((method) => ({
        method,
        amount: rows.filter((p) => p.paymentMethod === method).reduce((sum, p) => sum + Number(p.amount), 0),
        count: rows.filter((p) => p.paymentMethod === method).length,
    }))

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">From</label>
                    <input type="date" className="input input-bordered" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <input type="date" className="input input-bordered" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button onClick={() => { setFrom(today); setTo(today) }} className="btn btn-ghost">Today</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {totalByMethod.map(({ method, amount, count }) => (
                    <div key={method} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wide capitalize">{method}</div>
                        <div className="text-lg font-bold font-mono text-gray-800">{formatMoney(amount)}</div>
                        <div className="text-xs text-gray-400">{count} receipt{count === 1 ? '' : 's'}</div>
                    </div>
                ))}
                <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                    <div className="text-xs text-green-800 uppercase tracking-wide font-semibold">Total</div>
                    <div className="text-lg font-bold font-mono text-green-900">{formatMoney(total)}</div>
                    <div className="text-xs text-green-700">{rows.length} receipt{rows.length === 1 ? '' : 's'}</div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load collections.</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No payments received in this period.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Student</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{p.receiptNo}</td>
                                        <td>{p.paymentDate}</td>
                                        <td className="font-medium text-gray-800">{studentLabel(p.studentId)}</td>
                                        <td className="capitalize">{p.paymentMethod}</td>
                                        <td className="font-mono text-sm text-gray-500">{p.referenceNo ?? '—'}</td>
                                        <td className="text-right font-mono">{formatMoney(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CollectionsTab
