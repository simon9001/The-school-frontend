import React from 'react'
import type { StatItem, WidgetTone } from '../types'

export const TONE_TEXT: Record<WidgetTone, string> = {
    default: 'text-gray-800',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-600',
}

const StatsWidget: React.FC<{ stats: StatItem[] }> = ({ stats }) => (
    <div className="grid grid-cols-2 gap-4">
        {stats.map((s, i) => (
            <div key={i}>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className={`text-lg font-bold ${TONE_TEXT[s.tone ?? 'default']}`}>{s.value}</div>
            </div>
        ))}
    </div>
)

export default StatsWidget
