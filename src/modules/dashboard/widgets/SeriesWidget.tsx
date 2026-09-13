import React from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import type { ChartForm, ChartSeries, SeriesPoint, ValueFormat } from '../types'
import { AXIS_PROPS, CHART_COLORS, GRID_PROPS, TOOLTIP_PROPS, formatAxisTick, formatValue, toRechartsRows } from './chartTheme'

interface SeriesWidgetProps {
    form: ChartForm
    valueFormat: ValueFormat
    series: ChartSeries[]
    points: SeriesPoint[]
    emptyText: string
    title: string
}

const CHART_HEIGHT = 200

const SeriesWidget: React.FC<SeriesWidgetProps> = ({ form, valueFormat, series, points, emptyText, title }) => {
    // All-zero is indistinguishable from no data to a reader, and a flat line at
    // zero looks like a broken chart rather than an empty period.
    const hasData = points.some((point) => series.some((s) => (point.values[s.key] ?? 0) !== 0))
    if (points.length === 0 || !hasData) {
        return <div className="text-sm text-gray-400">{emptyText}</div>
    }

    const rows = toRechartsRows(points)
    const tickFormatter = (value: number) => formatAxisTick(value, valueFormat)
    // Recharts' Tooltip formatter type is (value: TooltipValueType | undefined) =>
    // ReactNode; our own data is always numeric, so coerce before formatting.
    const tooltipFormatter = (value: TooltipValueType | undefined) => formatValue(Number(value), valueFormat)
    const label = `${title}. ${series.map((s) => s.label).join(' and ')} across ${points.length} points.`

    return (
        <div role="img" aria-label={label} style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
                {form === 'line' ? (
                    <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="label" {...AXIS_PROPS} />
                        <YAxis tickFormatter={tickFormatter} width={44} {...AXIS_PROPS} />
                        <Tooltip formatter={tooltipFormatter} {...TOOLTIP_PROPS} />
                        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {series.map((s, i) => (
                            <Line
                                key={s.key}
                                dataKey={s.key}
                                name={s.label}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </LineChart>
                ) : (
                    <BarChart
                        data={rows}
                        layout={form === 'hbar' ? 'vertical' : 'horizontal'}
                        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                        barGap={2}
                    >
                        <CartesianGrid {...GRID_PROPS} />
                        {form === 'hbar' ? (
                            <>
                                <XAxis type="number" tickFormatter={tickFormatter} {...AXIS_PROPS} />
                                <YAxis type="category" dataKey="label" width={96} {...AXIS_PROPS} />
                            </>
                        ) : (
                            <>
                                <XAxis dataKey="label" {...AXIS_PROPS} />
                                <YAxis tickFormatter={tickFormatter} width={44} {...AXIS_PROPS} />
                            </>
                        )}
                        <Tooltip formatter={tooltipFormatter} {...TOOLTIP_PROPS} />
                        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {series.map((s, i) => (
                            <Bar
                                key={s.key}
                                dataKey={s.key}
                                name={s.label}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                radius={form === 'hbar' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    )
}

export default SeriesWidget
