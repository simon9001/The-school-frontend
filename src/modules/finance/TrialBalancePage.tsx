import React, { useState } from 'react'
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetTrialBalanceQuery } from './JournalApi'
import { useGetAllFundsQuery } from './FundApi'
import PrintableReport from '../../components/PrintableReport'
import type { ReportColumn } from '../../components/PrintableReport'

const todayIso = () => new Date().toISOString().slice(0, 10)

const formatMoney = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type TrialBalanceRow = {
    accountId: number
    code: string
    name: string
    type: string
    totalDebit: number
    totalCredit: number
    balance: number
}

// Declared once and handed to PrintableReport, which renders the on-screen
// table from it and reuses the same value() for the PDF and CSV — so the three
// outputs cannot drift apart as columns change.
const columns: ReportColumn<TrialBalanceRow>[] = [
    { header: 'Code', value: (r) => r.code, className: 'font-mono text-sm' },
    { header: 'Account', value: (r) => r.name, className: 'font-medium text-gray-800' },
    {
        header: 'Type',
        value: (r) => r.type.replace('_', ' '),
        render: (r) => <span className="badge badge-outline capitalize">{r.type.replace('_', ' ')}</span>,
    },
    { header: 'Debit', value: (r) => formatMoney(r.totalDebit), align: 'right', className: 'font-mono' },
    { header: 'Credit', value: (r) => formatMoney(r.totalCredit), align: 'right', className: 'font-mono' },
    { header: 'Balance', value: (r) => formatMoney(r.balance), align: 'right', className: 'font-mono font-semibold' },
]

const TrialBalancePage: React.FC = () => {
    const [asOfDate, setAsOfDate] = useState(todayIso())
    const [fundId, setFundId] = useState<string>('')

    const { data: funds } = useGetAllFundsQuery()
    const { data, isLoading, isError } = useGetTrialBalanceQuery({
        asOfDate,
        fundId: fundId ? Number(fundId) : undefined,
    })

    const fundLabel = fundId
        ? funds?.find((f) => String(f.id) === fundId)?.name ?? 'Selected fund'
        : 'All funds'

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
                <PrintableReport
                    title="Trial Balance"
                    subtitle={`As at ${asOfDate} · ${fundLabel}`}
                    filename={`trial-balance-${asOfDate}`}
                    columns={columns}
                    rows={data.rows}
                    footerCells={['Total', '', '', formatMoney(data.totalDebit), formatMoney(data.totalCredit), '']}
                    emptyMessage={`No posted transactions as of this date${fundId ? ' for this fund' : ''}.`}
                >
                    <div className={`mb-4 rounded-lg p-4 flex items-center gap-3 ${data.isBalanced ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {data.isBalanced ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        <span className="font-medium">
                            {data.isBalanced ? 'Balanced' : 'Out of balance'} — Total Debit {formatMoney(data.totalDebit)} / Total Credit {formatMoney(data.totalCredit)}
                        </span>
                    </div>
                </PrintableReport>
            )}
        </DashboardLayout>
    )
}

export default TrialBalancePage
