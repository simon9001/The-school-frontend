import React from 'react'
import { Scale, GraduationCap, BookOpenCheck, Wallet } from 'lucide-react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetDashboardSummaryQuery } from './DashboardApi'

const StatCard: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode; tone: string }> = ({ label, value, icon, tone }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${tone}`}>{icon}</div>
        <div>
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-xl font-bold text-gray-800">{value}</div>
        </div>
    </div>
)

const formatMoney = (amount: number) => `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Dashboard: React.FC = () => {
    const { data, isLoading, isError } = useGetDashboardSummaryQuery()

    return (
        <DashboardLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
                <p className="text-sm text-gray-500">Financial, enrollment, and academic snapshot{data ? ` as of ${data.asOfDate}` : ''}</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError || !data ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
                    Unable to load the dashboard summary. Confirm the backend is running.
                </div>
            ) : (
                <div className="space-y-8">
                    <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Financial Health</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                label="Trial Balance"
                                value={data.financial.isBalanced ? 'Balanced' : 'Out of balance'}
                                icon={<Scale size={22} className="text-green-700" />}
                                tone="bg-green-50"
                            />
                            <StatCard
                                label="Total Debit / Credit"
                                value={`${formatMoney(data.financial.totalDebit)}`}
                                icon={<Wallet size={22} className="text-blue-700" />}
                                tone="bg-blue-50"
                            />
                            <StatCard
                                label="Total Fees Invoiced"
                                value={formatMoney(data.financial.totalInvoiced)}
                                icon={<Wallet size={22} className="text-amber-700" />}
                                tone="bg-amber-50"
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Enrollment</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                label="Active Students"
                                value={data.enrollment.totalActiveStudents}
                                icon={<GraduationCap size={22} className="text-purple-700" />}
                                tone="bg-purple-50"
                            />
                        </div>
                        {data.enrollment.byClass.length > 0 && (
                            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="text-sm font-medium text-gray-600 mb-2">By class</div>
                                <div className="flex flex-wrap gap-2">
                                    {data.enrollment.byClass.map((c) => (
                                        <span key={c.classId} className="badge badge-outline">{c.className}: {c.count}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Academic</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <StatCard
                                label="Exams Recorded"
                                value={data.academic.totalExamsRecorded}
                                icon={<BookOpenCheck size={22} className="text-teal-700" />}
                                tone="bg-teal-50"
                            />
                            <StatCard
                                label="Most Recent Exam"
                                value={data.academic.mostRecentExam
                                    ? `${data.academic.mostRecentExam.examName} — mean ${data.academic.mostRecentExam.overallMeanMarks}`
                                    : 'No results yet'}
                                icon={<BookOpenCheck size={22} className="text-teal-700" />}
                                tone="bg-teal-50"
                            />
                        </div>
                    </section>
                </div>
            )}
        </DashboardLayout>
    )
}

export default Dashboard
