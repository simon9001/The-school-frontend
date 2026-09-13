import type { SeriesPoint, ValueFormat } from '../types'

/**
 * One palette for every chart, so twelve cards read as one system. The order is
 * fixed and never cycled: slot 1 is the app's own green-800 primary, and slot 2
 * is blue rather than amber both because it separates far better for red-green
 * colour vision (ΔE 25.9 vs 14.7) and because amber would imply
 * "expenditure = warning", which status colours are reserved for.
 *
 * Validated with the dataviz skill's validator, not by eye: all six checks pass
 * on the light surface for adjacent pairs across all 8 slots, and for ALL pairs
 * across the first 4 — which is the case a 4-slice breakdown chart hits. Beyond
 * 4 simultaneous categories, add a secondary encoding (direct labels) rather
 * than trusting colour alone.
 */
export const CHART_COLORS = [
    '#166534', // green-800 — the app's primary
    '#1d4ed8', // blue-700
    '#d97706', // amber-600
    '#0d9488', // teal-600
    '#be123c', // rose-700
    '#0369a1', // sky-700
    '#4d7c0f', // lime-700
    '#9333ea', // purple-600
]

export function formatValue(value: number, format: ValueFormat): string {
    switch (format) {
        case 'currency':
            return `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        case 'percent':
            return `${value.toFixed(1)}%`
        case 'count':
            return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    }
}

/** Axis labels get far less room than a tooltip, so money is abbreviated. */
export function formatAxisTick(value: number, format: ValueFormat): string {
    if (format === 'percent') return `${Math.round(value)}%`

    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`
    if (abs >= 1_000) return `${trimZero(value / 1_000)}K`
    return String(Math.round(value))
}

const trimZero = (n: number) => String(Number(n.toFixed(1)))

/**
 * Recharts wants one flat object per point; the API deliberately carries the
 * series keys nested so the contract is not shaped by this library.
 *
 * Every value is coerced with `?? 0`, and any `seriesKeys` the point omits are
 * filled with 0. Defence in depth on the render path: the backend's zeroFill
 * guarantees each declared key is present, but if one ever were not, Recharts
 * would hand `undefined` to the tooltip formatter and the card would read
 * "KES NaN". SeriesWidget's own hasData check already coerces the same values,
 * so leaving this one uncoerced was the inconsistency. Keys the series did not
 * declare are still passed through, so nothing is silently dropped.
 */
export function toRechartsRows(
    points: SeriesPoint[],
    seriesKeys: readonly string[] = [],
): Array<Record<string, string | number>> {
    return points.map((point) => {
        const row: Record<string, string | number> = { label: point.label }
        for (const key of seriesKeys) row[key] = point.values[key] ?? 0
        for (const [key, value] of Object.entries(point.values)) row[key] = value ?? 0
        return row
    })
}

export const GRID_PROPS = { stroke: '#f3f4f6', strokeDasharray: '3 3' } as const
export const AXIS_PROPS = {
    tick: { fontSize: 11, fill: '#6b7280' },
    stroke: '#e5e7eb',
    tickLine: false,
} as const
export const TOOLTIP_PROPS = {
    contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' },
} as const
