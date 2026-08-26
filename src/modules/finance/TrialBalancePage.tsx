import React, { useState } from 'react'
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetTrialBalanceQuery } from './JournalApi'
import { useGetAllFundsQuery } from './FundApi'

const todayIso = () => new Date().toISOString().slice(0, 10)

const formatMoney = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TrialBalancePage: React.FC = () => {
    const [asOfDate, setAsOfDate] = useState(todayIso())
    const [fundId, setFundId] = useState<string>('')

    const { data: funds } = useGetAllFundsQuery()
    const { data, isLoading, isError } = useGetTrialBalanceQuery({
        asOfDate,
        fundId: fundId ? Number(fundId) : undefined,
    })

    return (
        <DashboardLayout>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Scale className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Trial Balance</h1>
                </div>

                <div className="flex items-center gap-3">
                    <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="select select-bordered select-sm">
                        <option value="">All funds</option>
                        {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="input input-bordered input-sm"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError || !data ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
                    Unable to load the trial balance.
                </div>
            ) : (
                <>
                    <div className={`mb-4 rounded-lg p-4 flex items-center gap-3 ${data.isBalanced ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {data.isBalanced ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        <span className="font-medium">
                            {data.isBalanced ? 'Balanced' : 'Out of balance'} — Total Debit {formatMoney(data.totalDebit)} / Total Credit {formatMoney(data.totalCredit)}
                        </span>
                    </div>

                    {data.rows.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                            No posted transactions as of this date{fundId ? ' for this fund' : ''}.
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="table table-zebra w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th>Code</th>
                                            <th>Account</th>
                                            <th>Type</th>
                                            <th className="text-right">Debit</th>
                                            <th className="text-right">Credit</th>
                                            <th className="text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.rows.map((row) => (
                                            <tr key={row.accountId} className="hover:bg-gray-50">
                                                <td className="font-mono text-sm">{row.code}</td>
                                                <td className="font-medium text-gray-800">{row.name}</td>
                                                <td><span className="badge badge-outline capitalize">{row.type.replace('_', ' ')}</span></td>
                                                <td className="text-right font-mono">{formatMoney(row.totalDebit)}</td>
                                                <td className="text-right font-mono">{formatMoney(row.totalCredit)}</td>
                                                <td className="text-right font-mono font-semibold">{formatMoney(row.balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-bold">
                                            <td colSpan={3}>Total</td>
                                            <td className="text-right font-mono">{formatMoney(data.totalDebit)}</td>
                                            <td className="text-right font-mono">{formatMoney(data.totalCredit)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}

export default TrialBalancePage
