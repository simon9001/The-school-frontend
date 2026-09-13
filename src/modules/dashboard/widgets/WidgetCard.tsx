import React, { Suspense, lazy } from 'react'
import type { DashboardWidget } from '../types'
import StatsWidget from './StatsWidget'
import ListWidget from './ListWidget'

// Recharts is ~100KB gzipped and only chart widgets need it, so it is split out
// of the main bundle. A role with no chart permissions never downloads it.
const SeriesWidget = lazy(() => import('./SeriesWidget'))

const ChartSkeleton: React.FC = () => (
    <div className="h-[200px] rounded bg-gray-50 animate-pulse" aria-hidden="true" />
)

const WidgetBody: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
    switch (widget.kind) {
        case 'stats':
            return <StatsWidget stats={widget.stats} />
        case 'list':
            return <ListWidget rows={widget.rows} emptyText={widget.emptyText} />
        case 'series':
            return (
                <Suspense fallback={<ChartSkeleton />}>
                    <SeriesWidget
                        title={widget.title}
                        form={widget.form}
                        valueFormat={widget.valueFormat}
                        series={widget.series}
                        points={widget.points}
                        emptyText={widget.emptyText}
                    />
                </Suspense>
            )
    }
}

const WidgetCard: React.FC<{ widget: DashboardWidget }> = ({ widget }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-600 mb-3">{widget.title}</div>
        <WidgetBody widget={widget} />
    </div>
)

export default WidgetCard
