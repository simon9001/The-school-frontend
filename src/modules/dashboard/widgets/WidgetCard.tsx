import React from 'react'
import type { DashboardWidget } from '../types'
import StatsWidget from './StatsWidget'
import ListWidget from './ListWidget'

const WidgetBody: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
    switch (widget.kind) {
        case 'stats':
            return <StatsWidget stats={widget.stats} />
        case 'list':
            return <ListWidget rows={widget.rows} emptyText={widget.emptyText} />
        default:
            return null
    }
}

const WidgetCard: React.FC<{ widget: DashboardWidget }> = ({ widget }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-600 mb-3">{widget.title}</div>
        <WidgetBody widget={widget} />
    </div>
)

export default WidgetCard
