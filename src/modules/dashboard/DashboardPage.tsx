import React from 'react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetDashboardSummaryQuery } from './DashboardApi'
import type { DashboardWidget, WidgetTone } from './types'

const TONE_TEXT: Record<WidgetTone, string> = {
    default: 'text-gray-800',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-600',
}

const TONE_DOT: Record<WidgetTone, string> = {
    default: 'bg-gray-300',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
}

const WidgetCard: React.FC<{ widget: DashboardWidget }> = ({ widget }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-600 mb-3">{widget.title}</div>

        {widget.kind === 'stats' ? (
            <div className="grid grid-cols-2 gap-4">
                {widget.stats.map((s, i) => (
                    <div key={i}>
                        <div className="text-xs text-gray-500">{s.label}</div>
                        <div className={`text-lg font-bold ${TONE_TEXT[s.tone ?? 'default']}`}>{s.value}</div>
                    </div>
                ))}
            </div>
        ) : widget.rows.length === 0 ? (
            <div className="text-sm text-gray-400">{widget.emptyText}</div>
        ) : (
            <div className="space-y-2">
                {widget.rows.map((r, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                        <div className="flex items-start gap-2 min-w-0">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[r.tone ?? 'default']}`} />
                            <div className="min-w-0">
                                <div className="font-medium text-gray-800 truncate">{r.label}</div>
                                {r.sublabel && <div className="text-gray-500 text-xs truncate">{r.sublabel}</div>}
                            </div>
                        </div>
                        {r.value && <div className="text-gray-600 text-xs whitespace-nowrap">{r.value}</div>}
                    </div>
                ))}
            </div>
        )}
    </div>
)

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
