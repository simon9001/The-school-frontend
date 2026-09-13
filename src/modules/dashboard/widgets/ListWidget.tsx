import React from 'react'
import type { ListRow, WidgetTone } from '../types'

export const TONE_DOT: Record<WidgetTone, string> = {
    default: 'bg-gray-300',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
}

const ListWidget: React.FC<{ rows: ListRow[]; emptyText: string }> = ({ rows, emptyText }) => {
    if (rows.length === 0) return <div className="text-sm text-gray-400">{emptyText}</div>

    return (
        <div className="space-y-2">
            {rows.map((r, i) => (
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
    )
}

export default ListWidget
