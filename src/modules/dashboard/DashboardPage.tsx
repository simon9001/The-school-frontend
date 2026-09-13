import React from 'react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetDashboardSummaryQuery } from './DashboardApi'
import WidgetCard from './widgets/WidgetCard'

const Dashboard: React.FC = () => {
    const { data, isLoading, isError } = useGetDashboardSummaryQuery()

    return (
        <DashboardLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
                <p className="text-sm text-gray-500">Your snapshot{data ? ` as of ${data.asOfDate}` : ''}</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError || !data ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
                    Unable to load the dashboard summary. Confirm the backend is running.
                </div>
            ) : data.sections.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Nothing to show here yet.</div>
            ) : (
                <div className="space-y-8">
                    {data.sections.map((section) => (
                        <section key={section.id}>
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">{section.title}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {section.widgets.map((widget) => (
                                    <WidgetCard key={widget.id} widget={widget} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </DashboardLayout>
    )
}

export default Dashboard
